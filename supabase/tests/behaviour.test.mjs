// What the backend must do, checked against a real Postgres running the same
// SQL that goes into Supabase. These mirror the tests the phone-only data
// layer passes (src/data/__tests__/local.test.ts).
//
//   npm run test:server
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, MIN, track } from './harness.mjs';

const QW = { p_area: 'to-queen-west', p_source: 'picked' };

describe('nearby', () => {
  test('is empty until placed, then busy, one card per person, never you', async () => {
    const api = await freshDb();
    const me = await api.signUp();
    await api.rpc('pulse');
    assert.deepEqual(await api.rpc('get_nearby'), []);

    await api.rpc('set_area', QW);
    await api.rpc('pulse');
    let feed = await api.rpc('get_nearby');
    // who's mid-song is down to chance; about one street in a hundred starts with nobody playing, so give it a minute
    for (let i = 0; i < 20 && !feed.some((s) => s.status === 'playing'); i++) {
      await api.clock.advance(30_000);
      await api.rpc('pulse');
      feed = await api.rpc('get_nearby');
    }
    assert.ok(feed.length >= 8, `only ${feed.length} nearby`);
    assert.equal(new Set(feed.map((s) => s.person.id)).size, feed.length);
    assert.ok(!feed.some((s) => s.person.id === me));
    assert.ok(feed.some((s) => s.status === 'playing'));
    const firstQuiet = feed.findIndex((s) => s.status !== 'playing');
    assert.ok(feed.slice(firstQuiet).every((s) => s.status !== 'playing'), 'mid-song first');
    // a sighting carries a person and a song, and nothing about where
    assert.deepEqual(Object.keys(feed[0]).sort(), ['id', 'link', 'minutesAgo', 'note', 'person', 'saved', 'status', 'track']);
    assert.ok(!JSON.stringify(feed).includes('to-queen-west'));
  });

  test('fills the street once when several phones ask together, and changes over time', async () => {
    const api = await freshDb();
    await api.signUp();
    await api.rpc('set_area', QW);
    await Promise.all([api.rpc('pulse'), api.rpc('pulse'), api.rpc('pulse')]);
    const first = await api.rpc('get_nearby');
    assert.ok(first.length >= 8 && first.length <= 12, `${first.length}`);

    const snap = (f) => f.map((s) => `${s.person.id}:${s.track.id}:${s.status}`).join('|');
    const seen = new Set();
    for (let i = 0; i < 80; i++) {
      await api.clock.advance(30_000);
      await api.rpc('pulse');
      const feed = await api.rpc('get_nearby');
      feed.forEach((s) => seen.add(s.person.id));
      assert.ok(feed.length >= 5);
    }
    assert.notEqual(snap(await api.rpc('get_nearby')), snap(first));
    assert.ok(seen.size > 12, 'people came and went');
  });

  test('follows you to a new area', async () => {
    const api = await freshDb();
    await api.signUp();
    await api.rpc('set_area', QW);
    await api.rpc('pulse');
    await api.rpc('set_area', { p_area: 'cell:45.50:-73.55', p_source: 'gps' });
    assert.deepEqual(await api.rpc('get_nearby'), []);
    await api.clock.advance(10_000);
    await api.rpc('pulse');
    assert.ok((await api.rpc('get_nearby')).length >= 8);
  });
});

describe('two real accounts', () => {
  test('see each other only while on air, and going off air removes every trace', async () => {
    const api = await freshDb({ seed: false });
    const a = await api.signUp({ handle: 'anna' });
    await api.rpc('set_area', QW);
    await api.rpc('set_now_playing', { p_track: track('t1'), p_note: null });
    const b = await api.signUp({ handle: 'ben' });
    await api.rpc('set_area', QW);
    assert.deepEqual(await api.rpc('get_nearby'), []); // anna is off air

    await api.as(a);
    await api.rpc('set_sharing', { p_on: true });
    await api.as(b);
    let feed = await api.rpc('get_nearby');
    assert.equal(feed.length, 1);
    assert.equal(feed[0].person.id, a);
    assert.equal(feed[0].status, 'playing');
    assert.equal(feed[0].note, null);

    await api.as(a);
    await api.clock.advance(MIN);
    await api.rpc('set_now_playing', { p_track: track('t2'), p_note: '  trust me ' });
    await api.as(b);
    feed = await api.rpc('get_nearby');
    assert.equal(feed[0].status, 'shared');
    assert.equal(feed[0].note, 'trust me');

    // different area: not nearby
    await api.rpc('set_area', { p_area: 'to-annex', p_source: 'picked' });
    assert.deepEqual(await api.rpc('get_nearby'), []);
    await api.clock.advance(6 * MIN); // areas can't be hopped between faster than this
    await api.rpc('set_area', QW);

    await api.as(a);
    await api.rpc('set_sharing', { p_on: false });
    await api.as(b);
    assert.deepEqual(await api.rpc('get_nearby'), []);
  });

  test('nothing works for someone who is not logged in', async () => {
    const api = await freshDb();
    await api.as(null);
    assert.equal((await api.rpc('get_session')).me, null);
    assert.deepEqual(await api.rpc('get_nearby'), []);
    assert.equal(await api.rpc('get_room', { p_person: 'maren' }), null);
    assert.equal(await api.rpc('get_person', { p_id: 'maren' }), null);
    assert.equal((await api.rpc('get_city_feed', { p_scope: 'Toronto' })).posts.length, 0);
    assert.equal(await api.fails('set_sharing', { p_on: true }), 'not-signed-in');
    assert.equal(await api.fails('send_song', { p_to: 'maren', p_track: track('t1'), p_note: null }), 'not-signed-in');
    assert.equal(await api.fails('post_to_city', { p_track: track('t1'), p_note: 'hi' }), 'not-signed-in');
  });
});

describe('sending a song', () => {
  test('reaches them; accepting opens a chat with the song on top', async () => {
    const api = await freshDb({ seed: false });
    const a = await api.signUp({ handle: 'anna' });
    const b = await api.signUp({ handle: 'ben' });
    await api.as(a);
    const sent = await api.rpc('send_song', { p_to: b, p_track: track('t1'), p_note: '  for the streetcar ' });
    assert.equal(sent.kind, 'request');
    assert.deepEqual(await api.rpc('get_link', { p_person: b }), { kind: 'sent', id: sent.id });
    assert.deepEqual((await api.rpc('get_inbox')).sent.map((r) => r.to.id), [b]);

    await api.as(b);
    assert.equal(await api.rpc('get_inbox_count'), 1);
    const [waiting] = (await api.rpc('get_inbox')).waiting;
    assert.equal(waiting.from.id, a);
    assert.equal(waiting.track.id, 't1');
    assert.equal(waiting.note, 'for the streetcar');
    assert.deepEqual(await api.rpc('get_link', { p_person: a }), { kind: 'incoming', id: sent.id });

    await api.rpc('answer_song', { p_request: sent.id, p_accept: true });
    await api.clock.advance(1000);
    await api.rpc('send_message', { p_chat: sent.id, p_body: 'ok this is very good' });
    const chat = await api.rpc('get_chat', { p_chat: sent.id });
    assert.equal(chat.opener.track.id, 't1');
    assert.equal(chat.other.id, a);
    assert.deepEqual(chat.messages.map((m) => m.body), ['ok this is very good']);

    await api.as(a);
    assert.deepEqual(await api.rpc('get_link', { p_person: b }), { kind: 'chat', id: sent.id });
    const inbox = await api.rpc('get_inbox');
    assert.deepEqual(inbox.sent, []);
    assert.equal(inbox.chats[0].unread, 1);
    assert.equal(inbox.chats[0].last.mine, false);
    assert.equal(await api.rpc('get_inbox_count'), 1);
    await api.rpc('mark_chat_read', { p_chat: sent.id });
    assert.equal(await api.rpc('get_inbox_count'), 0);

    // once you're talking, another song goes into the chat rather than a new request
    await api.clock.advance(1000);
    assert.deepEqual(await api.rpc('send_song', { p_to: b, p_track: track('t2'), p_note: 'and this' }), { kind: 'chat', id: sent.id });
    const after = await api.rpc('get_chat', { p_chat: sent.id });
    assert.equal(after.messages.at(-1).body, 'and this');
    assert.equal(after.messages.at(-1).track.id, 't2');
    assert.equal(after.opener.track.id, 't1');
  });

  test('tells nobody about a decline', async () => {
    const api = await freshDb({ seed: false });
    const a = await api.signUp({ handle: 'anna' });
    const b = await api.signUp({ handle: 'ben' });
    await api.as(a);
    const sent = await api.rpc('send_song', { p_to: b, p_track: track('t1'), p_note: null });
    await api.as(b);
    await api.rpc('answer_song', { p_request: sent.id, p_accept: false });
    assert.deepEqual(await api.rpc('get_inbox'), { waiting: [], chats: [], sent: [] });
    assert.deepEqual(await api.rpc('get_link', { p_person: a }), { kind: 'none' });

    await api.as(a);
    const inbox = await api.rpc('get_inbox');
    assert.deepEqual(inbox.sent.map((r) => r.id), [sent.id]); // still just "sent"
    assert.deepEqual(await api.rpc('get_link', { p_person: b }), { kind: 'sent', id: sent.id });
    assert.equal(await api.rpc('get_chat', { p_chat: sent.id }), null);
  });

  test('one unanswered song per person, none to yourself, and chats stay private', async () => {
    const api = await freshDb({ seed: false });
    const a = await api.signUp({ handle: 'anna' });
    const b = await api.signUp({ handle: 'ben' });
    const c = await api.signUp({ handle: 'cat' });
    await api.as(a);
    const args = { p_track: track('t1'), p_note: null };
    const sent = await api.rpc('send_song', { p_to: b, ...args });
    assert.equal(await api.fails('send_song', { p_to: b, ...args }), 'already-sent');
    assert.equal(await api.fails('send_song', { p_to: a, ...args }), 'self');
    assert.equal(await api.fails('send_song', { p_to: 'nobody', ...args }), 'unknown-person');
    await api.as(b);
    assert.equal(await api.fails('send_song', { p_to: a, ...args }), 'they-sent-first');
    await api.rpc('answer_song', { p_request: sent.id, p_accept: true });

    await api.as(c); // a third person can't read, write or answer
    assert.equal(await api.rpc('get_chat', { p_chat: sent.id }), null);
    assert.equal(await api.fails('send_message', { p_chat: sent.id, p_body: 'hello?' }), 'not-your-chat');
    assert.equal(await api.fails('answer_song', { p_request: sent.id, p_accept: true }), 'not-waiting');
    assert.deepEqual(await api.rpc('get_inbox'), { waiting: [], chats: [], sent: [] });
  });

  test('remembers what they had on when you sent it', async () => {
    const api = await freshDb();
    await api.signUp();
    await api.rpc('set_area', QW);
    await api.rpc('pulse');
    const someone = (await api.rpc('get_nearby'))[0];
    const sent = await api.rpc('send_song', { p_to: someone.person.id, p_track: track('t1'), p_note: null });
    assert.deepEqual((await api.rpc('get_nearby')).find((s) => s.id === someone.id).link, { kind: 'sent', id: sent.id });
    await api.as(someone.person.id);
    assert.equal((await api.rpc('get_inbox')).waiting[0].about.id, someone.track.id);
  });
});

describe('residents noticing you', () => {
  test('one sends you a song once you are on air, and says one thing if you accept', async () => {
    const api = await freshDb();
    await api.signUp();
    await api.rpc('set_area', QW);
    await api.rpc('set_sharing', { p_on: true });
    await api.rpc('pulse');
    assert.deepEqual((await api.rpc('get_inbox')).waiting, []);

    await api.rpc('set_now_playing', { p_track: track('mine', 'My Band', 'My Song'), p_note: null });
    for (let i = 0; i < 40 && !(await api.rpc('get_inbox')).waiting.length; i++) {
      await api.clock.advance(15_000);
      await api.rpc('pulse');
    }
    const [hello] = (await api.rpc('get_inbox')).waiting;
    assert.ok(hello, 'nobody wrote');
    assert.equal(hello.from.seeded, true);
    assert.ok(!hello.note.includes('{'), 'template filled in');
    assert.equal(hello.about.id, 'mine');

    for (let i = 0; i < 20; i++) {
      await api.clock.advance(15_000);
      await api.rpc('pulse');
    }
    assert.equal((await api.rpc('get_inbox')).waiting.length, 1); // only one at a time

    await api.rpc('answer_song', { p_request: hello.id, p_accept: true });
    await api.clock.advance(15_000);
    await api.rpc('pulse');
    let chat = await api.rpc('get_chat', { p_chat: hello.id });
    assert.equal(chat.messages.length, 1);
    assert.equal(chat.messages[0].fromId, hello.from.id);
    await api.clock.advance(15_000);
    await api.rpc('pulse');
    chat = await api.rpc('get_chat', { p_chat: hello.id });
    assert.equal(chat.messages.length, 1); // and then they go quiet
  });
});

describe('crate', () => {
  test('saves and unsaves per account, and marks saved songs in the feeds', async () => {
    const api = await freshDb();
    const me = await api.signUp();
    await api.rpc('set_area', QW);
    await api.rpc('pulse');
    const first = (await api.rpc('get_nearby'))[0];
    assert.equal(first.saved, false);
    assert.equal(await api.rpc('toggle_save', { p_track: first.track }), true);
    assert.deepEqual((await api.rpc('get_crate')).map((t) => t.id), [first.track.id]);
    assert.equal((await api.rpc('get_nearby')).find((s) => s.id === first.id).saved, true);

    await api.signUp({ handle: 'other' });
    assert.deepEqual(await api.rpc('get_crate'), []);
    await api.as(me);
    assert.equal(await api.rpc('toggle_save', { p_track: first.track }), false);
    assert.deepEqual(await api.rpc('get_crate'), []);
  });

  test('keeps the first copy of a track, so nobody can deface a song everyone uses', async () => {
    const api = await freshDb();
    await api.signUp();
    // a copy with someone else's artwork is refused outright; the title on its own can't overwrite the real one
    assert.equal(await api.fails('toggle_save', { p_track: { ...track('sidhu-295'), title: 'VANDALISED', artworkUrl: 'https://evil.example/x.jpg' } }), 'bad-track');
    await api.rpc('toggle_save', { p_track: { ...track('sidhu-295'), title: 'VANDALISED' } });
    const [saved] = await api.rpc('get_crate');
    assert.equal(saved.title, '295');
    assert.ok(!saved.artworkUrl.includes('evil'));
    assert.equal(await api.fails('toggle_save', { p_track: { id: 'x' } }), 'bad-track');
  });
});

describe('rooms', () => {
  test('every resident has a decorated room made of things that exist', async () => {
    const api = await freshDb();
    await api.signUp();
    const residents = (await api.db.query("select id from app.profiles where seeded order by id")).rows.map((r) => r.id);
    assert.ok(residents.length >= 36);
    for (const id of residents) {
      const view = await api.rpc('get_room', { p_person: id });
      assert.ok(view, id);
      assert.equal(view.mine, false);
      assert.ok(view.room.sections.length >= 5, id);
      for (const s of view.room.sections) {
        if (s.kind === 'intro') s.songs.forEach((x) => assert.ok(view.tracks[x.trackId], `${id} intro ${x.trackId}`));
        if (s.kind === 'pinned') assert.ok(view.tracks[s.trackId], `${id} pinned`);
        if (s.kind === 'wall' || s.kind === 'shelf') s.trackIds.forEach((t) => assert.ok(view.tracks[t], `${id} ${s.kind} ${t}`));
        if (s.kind === 'guestbook') s.entries.forEach((e) => assert.ok(view.people[e.fromId] && view.tracks[e.trackId], `${id} guestbook`));
        if (s.kind === 'recent' && s.visibility === 'hidden') assert.deepEqual(s.trackIds, []);
        if (s.kind === 'recent' && s.visibility === 'shown') assert.ok(s.trackIds.length > 0, `${id} has listening history`);
      }
    }
  });

  test('a new account starts plain, can make the room its own, and only its own', async () => {
    const api = await freshDb();
    const me = await api.signUp();
    const before = await api.rpc('get_room', { p_person: me });
    assert.equal(before.mine, true);
    assert.deepEqual(before.room.sections.map((s) => s.kind), ['intro', 'pinned', 'wall', 'recent', 'guestbook']);

    const picked = track('itunes:999', 'Someone', 'A Song From Search');
    await api.rpc('save_room', {
      p_room: {
        ...before.room,
        theme: { ...before.room.theme, paper: '#161616', displayFont: 'hand', layout: 'poster' },
        sections: [{ kind: 'shelf', title: 'songs for the dentist', trackIds: ['itunes:999', 'sidhu-295'] }, ...before.room.sections.reverse()],
      },
      p_tracks: [picked],
    });
    const after = await api.rpc('get_room', { p_person: me });
    assert.equal(after.room.theme.paper, '#161616');
    assert.equal(after.room.theme.layout, 'poster');
    assert.deepEqual(after.room.sections.map((s) => s.kind), ['shelf', 'guestbook', 'recent', 'wall', 'pinned', 'intro']);
    assert.equal(after.tracks['itunes:999'].title, 'A Song From Search');

    const theirs = await api.rpc('get_room', { p_person: 'maren' });
    assert.equal(await api.fails('save_room', { p_room: theirs.room, p_tracks: [] }), 'not-your-room');
    assert.equal(await api.fails('save_room', { p_room: { personId: me, theme: {}, sections: 'nope' }, p_tracks: [] }), 'bad-room');
    assert.equal((await api.rpc('get_room', { p_person: 'maren' })).room.theme.paper, theirs.room.theme.paper);
  });

  test('shows what you really played, unless you hide it, and never sends hidden songs', async () => {
    const api = await freshDb();
    const me = await api.signUp();
    await api.rpc('set_area', QW);
    await api.rpc('set_sharing', { p_on: true }); // only on-air listening shows in a room
    await api.rpc('set_now_playing', { p_track: track('sidhu-295'), p_note: null });
    await api.clock.advance(MIN);
    await api.rpc('set_now_playing', { p_track: track('alvvays-archie'), p_note: null });
    const recent = async () => (await api.rpc('get_room', { p_person: me })).room.sections.find((s) => s.kind === 'recent');
    assert.deepEqual((await recent()).trackIds, ['alvvays-archie', 'sidhu-295']);

    const room = (await api.rpc('get_room', { p_person: me })).room;
    await api.rpc('save_room', { p_room: { ...room, sections: room.sections.map((s) => (s.kind === 'recent' ? { ...s, visibility: 'hidden' } : s)) }, p_tracks: [] });
    assert.deepEqual((await recent()).trackIds, []);
    await api.signUp({ handle: 'visitor' });
    const seen = await api.rpc('get_room', { p_person: me });
    assert.deepEqual(seen.room.sections.find((s) => s.kind === 'recent').trackIds, []);
    assert.ok(!JSON.stringify(seen).includes('alvvays-archie'));
  });

  test('visitors sign the guestbook once; the owner can tear a page out but not forge one', async () => {
    const api = await freshDb();
    const me = await api.signUp();
    assert.equal(await api.fails('sign_guestbook', { p_person: me, p_track: track('sidhu-295'), p_why: 'for me' }), 'own-guestbook');
    const v1 = await api.signUp({ handle: 'visitor.one' });
    await api.rpc('sign_guestbook', { p_person: me, p_track: track('sidhu-295'), p_why: 'first try' });
    await api.rpc('sign_guestbook', { p_person: me, p_track: track('alvvays-archie'), p_why: 'no, this one' });
    assert.equal(await api.fails('sign_guestbook', { p_person: me, p_track: track('alvvays-archie'), p_why: '  ' }), 'say-why');
    const v2 = await api.signUp({ handle: 'visitor.two' });
    await api.rpc('sign_guestbook', { p_person: me, p_track: track('burial-archangel'), p_why: 'for the bus' });

    await api.as(me);
    const book = async () => (await api.rpc('get_room', { p_person: me })).room.sections.find((s) => s.kind === 'guestbook');
    assert.deepEqual((await book()).entries.map((e) => [e.fromId, e.trackId]), [[v2, 'burial-archangel'], [v1, 'alvvays-archie']]);

    const room = (await api.rpc('get_room', { p_person: me })).room;
    await api.rpc('save_room', {
      p_room: {
        ...room,
        sections: room.sections.map((s) =>
          s.kind === 'guestbook'
            ? { ...s, entries: [{ fromId: v1, trackId: 'alvvays-archie', why: 'i love you' }, { fromId: 'tobi', trackId: 'sidhu-295', why: 'fake' }] }
            : s,
        ),
      },
      p_tracks: [],
    });
    const entries = (await book()).entries;
    assert.equal(entries.length, 1);
    assert.equal(entries[0].fromId, v1);
    assert.equal(entries[0].why, 'no, this one');
  });
});

describe('city', () => {
  test('a city sees its own posts, newest first; the GTA sees everything; more arrive later', async () => {
    const api = await freshDb();
    await api.signUp();
    const toronto = await api.rpc('get_city_feed', { p_scope: 'Toronto' });
    assert.ok(toronto.posts.length >= 15);
    assert.ok(toronto.posts.every((p) => p.city === 'Toronto'));
    const times = toronto.posts.map((p) => p.postedAt);
    assert.deepEqual(times, [...times].sort((a, b) => b - a));
    const vaughan = await api.rpc('get_city_feed', { p_scope: 'Vaughan' });
    assert.ok(vaughan.posts.length >= 4 && vaughan.posts.every((p) => p.city === 'Vaughan'));
    const gta = await api.rpc('get_city_feed', { p_scope: 'GTA' });
    assert.ok(gta.posts.length > toronto.posts.length + vaughan.posts.length);
    assert.deepEqual((await api.rpc('get_city_feed', { p_scope: 'Oakville' })).posts, []);

    await api.clock.advance(3 * 60 * MIN);
    assert.equal((await api.rpc('get_city_feed', { p_scope: 'GTA' })).posts.length, gta.posts.length + 8);
  });

  test('says which artists a city is paying attention to', async () => {
    const api = await freshDb();
    await api.signUp();
    const { trending } = await api.rpc('get_city_feed', { p_scope: 'Brampton' });
    assert.ok(trending.length >= 3 && trending.length <= 6);
    assert.ok(trending.map((t) => t.artist).includes('Sidhu Moose Wala'));
    assert.ok(trending.every((t) => t.posts + t.plays > 0 && t.artworkUrl.startsWith('http')));
  });

  test('posts go to your home city, not where you are; only you can take yours down', async () => {
    const api = await freshDb();
    const me = await api.signUp({ homeCity: 'Vaughan' });
    await api.rpc('set_area', QW); // standing in Toronto
    assert.equal(await api.fails('post_to_city', { p_track: track('sidhu-295'), p_note: '   ' }), 'say-why');
    await api.clock.advance(MIN);
    const id = await api.rpc('post_to_city', { p_track: track('sidhu-295'), p_note: ' for the 400 northbound ' });
    const mine = (await api.rpc('get_city_feed', { p_scope: 'Vaughan' })).posts[0];
    assert.equal(mine.id, id);
    assert.equal(mine.note, 'for the 400 northbound');
    assert.equal(mine.mine, true);
    assert.ok(!(await api.rpc('get_city_feed', { p_scope: 'Toronto' })).posts.some((p) => p.id === id));

    await api.signUp({ handle: 'other' });
    await api.rpc('set_area', QW);
    assert.deepEqual(await api.rpc('get_nearby'), []); // posting is not sharing nearby
    await api.rpc('remove_post', { p_post: id });
    assert.equal((await api.rpc('get_city_feed', { p_scope: 'Vaughan' })).posts[0].id, id);
    await api.as(me);
    await api.rpc('remove_post', { p_post: id });
    assert.ok(!(await api.rpc('get_city_feed', { p_scope: 'Vaughan' })).posts.some((p) => p.id === id));

    assert.equal(await api.fails('set_home_city', { p_city: 'Atlantis' }), 'unknown-city');
    await api.rpc('set_home_city', { p_city: 'Markham' });
    assert.equal((await api.rpc('get_session')).me.homeCity, 'Markham');
  });
});

describe('artist rooms', () => {
  test('a room per city, a GTA room that rolls them up, and replies that arrive later', async () => {
    const api = await freshDb();
    await api.signUp();
    const toronto = await api.rpc('get_artist_space', { p_artist: 'Big Thief', p_scope: 'Toronto' });
    assert.equal(toronto.artist, 'Big Thief');
    assert.equal(toronto.threads.length, 2);
    assert.ok(toronto.tracks.length >= 3);
    assert.ok(toronto.listeners.map((p) => p.id).includes('maren'));
    assert.ok(toronto.listeners.map((p) => p.id).includes('tessa'));

    const inToronto = await api.rpc('get_artist_space', { p_artist: 'steely dan', p_scope: 'Toronto' });
    assert.equal(inToronto.artist, 'Steely Dan');
    assert.deepEqual(inToronto.threads, []);
    assert.equal(inToronto.elsewhere, 1);
    const gta = await api.rpc('get_artist_space', { p_artist: 'Steely Dan', p_scope: 'GTA' });
    assert.equal(gta.threads.length, 1);
    assert.equal(gta.threads[0].city, 'Vaughan');

    const alone = () => api.rpc('get_artist_space', { p_artist: 'Big Thief', p_scope: 'Toronto' }).then((s) => s.threads.find((t) => t.title.includes('alone')));
    const before = await alone();
    await api.clock.advance(10 * MIN);
    const after = await alone();
    assert.equal(after.replies, before.replies + 1);
    assert.equal(after.last.person.id, 'tessa');

    const thread = await api.rpc('get_thread', { p_thread: before.id });
    const at = thread.replies.map((r) => r.at);
    assert.deepEqual(at, [...at].sort((a, b) => a - b));
    assert.equal(await api.rpc('get_thread', { p_thread: '999999' }), null);
  });

  test('you can start a thread in your home city and reply with a song', async () => {
    const api = await freshDb();
    const me = await api.signUp({ homeCity: 'Markham' });
    assert.equal(await api.fails('start_thread', { p_artist: 'Joni Mitchell', p_title: '  ', p_body: '' }), 'needs-title');
    const id = await api.rpc('start_thread', { p_artist: 'Joni Mitchell', p_title: 'Best live recording?', p_body: 'asking for a friend' });
    assert.deepEqual((await api.rpc('get_artist_space', { p_artist: 'Joni Mitchell', p_scope: 'Toronto' })).threads, []);
    const mine = (await api.rpc('get_artist_space', { p_artist: 'Joni Mitchell', p_scope: 'Markham' })).threads[0];
    assert.equal(mine.id, id);
    assert.equal(mine.starter.id, me);

    await api.signUp({ handle: 'replier' });
    await api.clock.advance(MIN);
    await api.rpc('reply_to_thread', { p_thread: id, p_body: 'the one from the radio session', p_track: track('joni-a-case-of-you') });
    await api.rpc('reply_to_thread', { p_thread: id, p_body: '   ', p_track: null });
    const thread = await api.rpc('get_thread', { p_thread: id });
    assert.equal(thread.replies.length, 1);
    assert.equal(thread.replies[0].track.id, 'joni-a-case-of-you');
    assert.equal(await api.fails('reply_to_thread', { p_thread: '424242', p_body: 'hello?', p_track: null }), 'thread-gone');
  });
});

describe('accounts', () => {
  test('a Google sign-in gets a placeholder profile and is asked to finish it', async () => {
    const api = await freshDb();
    await api.signUp({ handle: 'tess', name: 'Tess From Google', onboard: false });
    let s = await api.rpc('get_session');
    assert.equal(s.needsProfile, true);
    assert.equal(s.me.name, 'Tess From Google');
    assert.match(s.me.handle, /^[a-z0-9._]{2,28}$/);

    assert.equal(await api.fails('complete_profile', { p_name: 'Tess', p_handle: 'marenonthe501', p_badge: 'TG', p_badge_color: '#fff', p_home_city: 'Vaughan' }), 'handle-taken');
    assert.equal(await api.fails('complete_profile', { p_name: 'Tess', p_handle: 'x', p_badge: 'TG', p_badge_color: '#fff', p_home_city: 'Vaughan' }), 'bad-handle');
    s = await api.rpc('complete_profile', { p_name: 'Tess G', p_handle: 'Tess.G', p_badge: 'tg', p_badge_color: '#B9A7E8', p_home_city: 'Vaughan' });
    assert.equal(s.needsProfile, false);
    assert.deepEqual([s.me.name, s.me.handle, s.me.badge, s.me.homeCity], ['Tess G', 'tess.g', 'TG', 'Vaughan']);

    // finishing is a one-time step: a finished profile can't use it to change handle later
    assert.equal(await api.fails('complete_profile', { p_name: 'Tess G', p_handle: 'someone.else', p_badge: 'TG', p_badge_color: '#B9A7E8', p_home_city: 'Vaughan' }), 'already-finished');
    assert.equal((await api.rpc('get_session')).me.handle, 'tess.g');
  });

  test('an account made with a handle can never use the finish step to change it', async () => {
    const api = await freshDb({ seed: false });
    await api.signUp({ handle: 'original.name' });
    assert.equal(await api.fails('complete_profile', { p_name: 'Same', p_handle: 'brand.new', p_badge: 'SP', p_badge_color: '#ffffff', p_home_city: 'Toronto' }), 'already-finished');
    assert.equal((await api.rpc('get_session')).me.handle, 'original.name');
  });

  test('two people who sign in with the same email name still get different handles', async () => {
    const api = await freshDb({ seed: false });
    await api.signUp({ handle: 'sam', onboard: false });
    const first = (await api.rpc('get_session')).me.handle;
    // a second auth user whose email also starts "sam"
    await api.db.query("insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-4000-8000-0000000000aa', 'sam@other.example', '{}')");
    await api.as('00000000-0000-4000-8000-0000000000aa');
    const second = (await api.rpc('get_session')).me.handle;
    assert.notEqual(first, second);
    assert.equal(await api.rpc('handle_available', { wanted: first }), false);
    assert.equal(await api.rpc('handle_available', { wanted: 'nobody.has.this' }), true);
  });

  test('profile edits stick, and stay within limits', async () => {
    const api = await freshDb({ seed: false });
    await api.signUp();
    await api.rpc('update_profile', { p_name: ' New Name ', p_tagline: 'listens too loud', p_bio: 'hello', p_badge: 'nn', p_badge_color: '#000000' });
    const me = (await api.rpc('get_session')).me;
    assert.deepEqual([me.name, me.tagline, me.badge], ['New Name', 'listens too loud', 'NN']);
    assert.equal(await api.fails('update_profile', { p_name: '  ', p_tagline: '', p_bio: '', p_badge: 'x', p_badge_color: '#000' }), 'bad-name');
  });
});

describe('what the outside world can reach', () => {
  test('nothing in the private schema, and only signed-in people may call the app functions', async () => {
    const api = await freshDb({ seed: false });
    const q = async (sql) => (await api.db.query(sql)).rows[0].ok;
    assert.equal(await q("select has_schema_privilege('authenticated', 'app', 'usage') as ok"), false);
    assert.equal(await q("select has_schema_privilege('anon', 'app', 'usage') as ok"), false);
    assert.equal(await q("select has_function_privilege('anon', 'public.get_nearby()', 'execute') as ok"), false);
    assert.equal(await q("select has_function_privilege('anon', 'public.send_song(text, jsonb, text)', 'execute') as ok"), false);
    assert.equal(await q("select has_function_privilege('anon', 'public.handle_available(text)', 'execute') as ok"), true);
    assert.equal(await q("select has_function_privilege('anon', 'public.get_session()', 'execute') as ok"), true);
    // and those, plus joining the waitlist from earshot.lol, are all a logged-out caller can run
    const callable = (await api.db.query("select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') order by 1")).rows.map((r) => r.proname);
    assert.deepEqual(callable, ["get_session", "handle_available", "join_waitlist"]);
    assert.equal(await q("select has_function_privilege('authenticated', 'public.get_nearby()', 'execute') as ok"), true);
    assert.equal(await q("select has_function_privilege('authenticated', 'public.handle_new_user()', 'execute') as ok"), false);
    // every table has row-level security on and no policy, so direct access shows nothing
    const open = (await api.db.query("select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'app' and c.relkind = 'r' and not c.relrowsecurity")).rows;
    assert.deepEqual(open, []);
    assert.equal((await api.db.query("select count(*)::int as n from pg_policies where schemaname = 'app'")).rows[0].n, 0);
  });

  test('upgrades a project that ran the first, accounts-only script', async () => {
    const { readFileSync } = await import('node:fs');
    const api = await freshDb({ seed: false, schema: 'tests/schema.v1.sql' });
    await api.db.query("insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-4000-8000-0000000000bb', 'old@example.com', $1)", [
      { handle: 'old.timer', name: 'Old Timer', badge: 'OT', badge_color: '#fff', home_city: 'Vaughan' },
    ]);
    await api.db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
    await api.db.exec(`create or replace function app.me() returns text language sql stable as $$ select nullif(current_setting('test.me', true), '') $$;
      create or replace function app.now_ms() returns bigint language sql volatile as $$ select current_setting('test.now')::bigint $$;`);
    await api.as('00000000-0000-4000-8000-0000000000bb');
    const s = await api.rpc('get_session');
    assert.deepEqual([s.me.handle, s.me.name, s.me.homeCity, s.needsProfile], ['old.timer', 'Old Timer', 'Vaughan', false]);
    assert.equal((await api.db.query("select auth_id::text as a from app.profiles where handle = 'old.timer'")).rows[0].a, '00000000-0000-4000-8000-0000000000bb');
    assert.equal((await api.db.query("select to_regclass('public.profiles') is null as ok")).rows[0].ok, true);
  });
});

describe('moving the residents out (remove-residents.sql)', () => {
  test('removes every resident and what they made, and leaves real people and the app working', async () => {
    const { readFileSync } = await import('node:fs');
    const api = await freshDb();
    const me = await api.signUp({ handle: 'real.one' });
    await api.rpc('set_area', QW);
    await api.rpc('set_sharing', { p_on: true });
    await api.rpc('set_now_playing', { p_track: track('mine'), p_note: null });
    await api.rpc('pulse');
    assert.ok((await api.rpc('get_nearby')).length >= 8);
    await api.rpc('post_to_city', { p_track: track('mine'), p_note: 'a real post' });
    await api.as('maren');
    await api.rpc('sign_guestbook', { p_person: me, p_track: track('gift'), p_why: 'from a resident' });

    await api.db.exec(readFileSync(new URL('../remove-residents.sql', import.meta.url), 'utf8'));

    const count = async (sql) => (await api.db.query(`select count(*)::int as n from ${sql}`)).rows[0].n;
    assert.equal(await count('app.profiles where seeded'), 0);
    assert.equal(await count('app.profiles'), 1);
    for (const t of ['presence', 'tastes', 'openers', 'threads', 'replies']) assert.equal(await count(`app.${t}`), 0, t);

    await api.as(me);
    await api.clock.advance(60_000);
    await api.rpc('pulse'); // nobody left to simulate; must not fail or invent anyone
    assert.deepEqual(await api.rpc('get_nearby'), []);
    assert.deepEqual((await api.rpc('get_city_feed', { p_scope: 'Toronto' })).posts.map((p) => p.note), ['a real post']);
    assert.deepEqual((await api.rpc('get_room', { p_person: me })).room.sections.find((s) => s.kind === 'guestbook').entries, []);
    await api.clock.advance(30 * 60_000);
    await api.rpc('pulse');
    assert.deepEqual((await api.rpc('get_inbox')).waiting, [], 'no resident turns up to send a song');
  });
});
