import { areaById, areaFromCoords } from '../areas';
import { LocalApi } from '../local/LocalApi';
import { rng } from '@/sim/simulator';
import seedTracks from '@/seed/tracks.json';
import { residents, tastes } from '@/seed/listeners';
import { seedPosts } from '@/seed/posts';
import type { Track } from '@/music/types';
import { memoryDriver } from './helpers/nodeDriver';
import { nodeSecurity } from './helpers/nodeSecurity';

const tracks = seedTracks as Record<string, Track>;
const MIN = 60_000;
const START = Date.UTC(2026, 10, 12, 17, 0, 0);

async function fresh(seed = 7) {
  const clock = { now: START };
  const api = new LocalApi(memoryDriver(), () => clock.now, rng(seed), nodeSecurity);
  await api.init();
  return { api, clock };
}
const PW = 'correct horse 9';
const newbie = { name: 'Test Person', handle: 'test.person', badge: 'TP', badgeColor: '#fff', homeCity: 'Toronto', password: PW };

describe('seed content', () => {
  it('gives every resident a taste made of tracks that exist', () => {
    expect(residents.length).toBeGreaterThanOrEqual(36);
    for (const r of residents) {
      const t = tastes[r.id];
      expect(t).toBeDefined();
      expect(t.plays.length).toBeGreaterThanOrEqual(4);
      for (const id of [...t.plays, ...t.shares.map((s) => s.trackId)]) expect(tracks[id]).toBeDefined();
    }
    expect(new Set(residents.map((r) => r.handle)).size).toBe(residents.length);
  });
});

describe('areas', () => {
  it('turns coordinates into a named neighbourhood and nothing finer', () => {
    const a = areaFromCoords(43.6472, -79.4075); // a street corner on Queen West
    expect(a).toEqual({ id: 'to-queen-west', name: 'Queen West', city: 'Toronto' });
    expect(JSON.stringify(a)).not.toMatch(/43\.|79\./);
  });

  it('falls back to a coarse grid square outside the GTA', () => {
    const a = areaFromCoords(45.5019, -73.5674); // Montréal
    expect(a.id).toBe('cell:45.50:-73.55');
    expect(a.city).toBeNull();
    expect(areaById(a.id).name).toMatch(/off our map/);
  });
});

describe('accounts', () => {
  it('starts signed out, then signs a new account in', async () => {
    const { api } = await fresh();
    expect((await api.getSession()).me).toBeNull();
    const me = await api.createAccount(newbie);
    const s = await api.getSession();
    expect(s.me?.id).toBe(me.id);
    expect(s.sharing).toBe(false); // sharing is opt-in
    expect(s.area).toBeNull();
  });

  it('will not give out a handle twice, or accept a flimsy password', async () => {
    const { api } = await fresh();
    await api.createAccount(newbie);
    await expect(api.createAccount({ ...newbie, name: 'Someone Else' })).rejects.toMatchObject({ code: 'handle-taken' });
    await expect(api.createAccount({ ...newbie, handle: '@Test.Person' })).rejects.toMatchObject({ code: 'handle-taken' });
    await expect(api.createAccount({ ...newbie, handle: 'maren' + 'onthe501' })).rejects.toMatchObject({ code: 'handle-taken' });
    await expect(api.createAccount({ ...newbie, handle: 'other', password: 'short' })).rejects.toMatchObject({ code: 'weak-password' });
    await expect(api.createAccount({ ...newbie, handle: '!' })).rejects.toMatchObject({ code: 'bad-handle' });
    expect((await api.createAccount({ ...newbie, handle: 'Other.One' })).handle).toBe('other.one');
  });

  it('logs in with the right password and only the right password', async () => {
    const { api } = await fresh();
    const me = await api.createAccount(newbie);
    expect((await api.getSession()).needsPassword).toBe(false);
    await api.signOut();
    expect((await api.getSession()).me).toBeNull();

    await expect(api.logIn('test.person', 'wrong horse 9')).rejects.toMatchObject({ code: 'wrong-password' });
    await expect(api.logIn('nobody.here', PW)).rejects.toMatchObject({ code: 'no-such-account' });
    expect((await api.getSession()).me).toBeNull();
    expect((await api.logIn('  @Test.Person ', PW)).id).toBe(me.id);
    expect((await api.getSession()).me?.id).toBe(me.id);
  });

  it('never stores the password itself', async () => {
    const driver = memoryDriver();
    const api = new LocalApi(driver, () => START, rng(1), nodeSecurity);
    await api.init();
    await api.createAccount(newbie);
    const row = (await driver.all<Record<string, unknown>>("SELECT * FROM users WHERE handle = 'test.person'"))[0];
    expect(JSON.stringify(row)).not.toContain(PW);
    expect(String(row.pass_hash)).toMatch(/^[0-9a-f]{64}$/);
    expect(String(row.pass_salt).length).toBeGreaterThanOrEqual(16);
    // same password, different account: different salt, different hash
    await api.createAccount({ ...newbie, handle: 'twin' });
    const twin = (await driver.all<Record<string, unknown>>("SELECT * FROM users WHERE handle = 'twin'"))[0];
    expect(twin.pass_hash).not.toBe(row.pass_hash);
  });

  it('locks a handle for a bit after five wrong guesses', async () => {
    const { api, clock } = await fresh();
    await api.createAccount(newbie);
    await api.signOut();
    for (let i = 0; i < 4; i++) await expect(api.logIn('test.person', 'nope nope nope')).rejects.toMatchObject({ code: 'wrong-password' });
    await expect(api.logIn('test.person', 'nope nope nope')).rejects.toMatchObject({ code: 'locked' });
    await expect(api.logIn('test.person', PW)).rejects.toMatchObject({ code: 'locked' }); // even the right one, for now
    clock.now += 31_000;
    await api.logIn('test.person', PW);
    expect((await api.getSession()).me).not.toBeNull();
  });

  it('only lets residents be borrowed without a password', async () => {
    const { api } = await fresh();
    const me = await api.createAccount(newbie);
    await api.signIn('maren');
    expect((await api.getSession()).me?.id).toBe('maren');
    await expect(api.signIn(me.id)).rejects.toMatchObject({ code: 'password-needed' });
    await expect(api.logIn('marenonthe501', 'anything at all')).rejects.toMatchObject({ code: 'resident' });
    await expect(api.changePassword(null, 'a new password')).rejects.toMatchObject({ code: 'resident' });
  });

  it('changes a password only if you know the old one', async () => {
    const { api } = await fresh();
    await api.createAccount(newbie);
    await expect(api.changePassword('not it at all', 'brand new pass')).rejects.toMatchObject({ code: 'wrong-password' });
    await expect(api.changePassword(PW, 'short')).rejects.toMatchObject({ code: 'weak-password' });
    await api.changePassword(PW, 'brand new pass');
    await api.signOut();
    await expect(api.logIn('test.person', PW)).rejects.toMatchObject({ code: 'wrong-password' });
    await api.logIn('test.person', 'brand new pass');
  });

  it('lets an account from before passwords set one on its first log-in', async () => {
    const driver = memoryDriver();
    const api = new LocalApi(driver, () => START, rng(1), nodeSecurity);
    await api.init();
    await driver.run(
      "INSERT INTO users (id, name, handle, badge, badge_color, home_city, seeded, sharing, created_at) VALUES ('old1', 'Old Timer', 'old.timer', 'OT', '#fff', 'Toronto', 0, 0, 1)",
    );
    await expect(api.logIn('old.timer', 'short')).rejects.toMatchObject({ code: 'weak-password' });
    await api.logIn('old.timer', 'my first password');
    expect((await api.getSession()).needsPassword).toBe(false);
    await api.signOut();
    await expect(api.logIn('old.timer', 'someone else trying')).rejects.toMatchObject({ code: 'wrong-password' });
    await api.logIn('old.timer', 'my first password');
  });

  it('lists your accounts plus a few residents to borrow', async () => {
    const { api } = await fresh();
    const me = await api.createAccount(newbie);
    const accounts = await api.listAccounts();
    expect(accounts[0].id).toBe(me.id);
    expect(accounts.map((a) => a.id)).toEqual(expect.arrayContaining(['maren', 'dev', 'tobi', 'priya']));
  });
});

describe('nearby', () => {
  it('is empty until the phone has been placed somewhere', async () => {
    const { api } = await fresh();
    await api.createAccount(newbie);
    await api.refreshNearby();
    expect(await api.getNearby()).toEqual([]);
  });

  it('is busy the first time you look, with one card per person and never you', async () => {
    const { api } = await fresh();
    const me = await api.createAccount(newbie);
    await api.setArea('to-queen-west', 'picked');
    await api.refreshNearby();
    const feed = await api.getNearby();
    expect(feed.length).toBeGreaterThanOrEqual(8);
    expect(new Set(feed.map((s) => s.person.id)).size).toBe(feed.length);
    expect(feed.find((s) => s.person.id === me.id)).toBeUndefined();
    expect(feed.some((s) => s.status === 'playing')).toBe(true);
    expect(feed.some((s) => s.status === 'played')).toBe(true);
    // whoever is mid-song is listed first
    const firstQuiet = feed.findIndex((s) => s.status !== 'playing');
    expect(feed.slice(firstQuiet).every((s) => s.status !== 'playing')).toBe(true);
    // a sighting carries a person and a song, and nothing about where
    expect(Object.keys(feed[0]).sort()).toEqual(['id', 'link', 'minutesAgo', 'note', 'person', 'saved', 'status', 'track']);
  });

  it('fills the street once even if two screens ask at the same moment', async () => {
    const { api } = await fresh();
    await api.createAccount(newbie);
    await api.setArea('to-queen-west', 'picked');
    await Promise.all([api.refreshNearby(), api.refreshNearby(), api.refreshNearby()]);
    const feed = await api.getNearby();
    expect(feed.length).toBeGreaterThanOrEqual(8);
    expect(feed.length).toBeLessThanOrEqual(12);
  });

  it('changes as time passes', async () => {
    const { api, clock } = await fresh();
    await api.createAccount(newbie);
    await api.setArea('to-annex', 'picked');
    await api.refreshNearby();
    const snap = async () => (await api.getNearby()).map((s) => `${s.person.id}:${s.track.id}:${s.status}`).join('|');
    const before = await snap();
    const seen = new Set<string>();
    for (let i = 0; i < 80; i++) {
      clock.now += 30_000;
      await api.refreshNearby();
      const feed = await api.getNearby();
      feed.forEach((s) => seen.add(s.person.id));
      expect(feed.length).toBeGreaterThanOrEqual(5);
    }
    expect(await snap()).not.toBe(before);
    expect(seen.size).toBeGreaterThan(12); // people came and went
  });

  it('follows you to a new area, including one off the map', async () => {
    const { api } = await fresh();
    await api.createAccount(newbie);
    await api.setArea('to-queen-west', 'picked');
    await api.refreshNearby();
    await api.setArea(areaFromCoords(45.5019, -73.5674).id, 'gps');
    expect(await api.getNearby()).toEqual([]);
    await api.refreshNearby();
    expect((await api.getNearby()).length).toBeGreaterThanOrEqual(8);
  });
});

describe('sharing between two accounts on one phone', () => {
  it('shows your song to the other person only while you are on air', async () => {
    const { api, clock } = await fresh();
    const me = await api.createAccount(newbie);
    await api.setArea('to-queen-west', 'picked');
    const song = tracks['alvvays-archie'];

    // off air: you can play things, and nobody sees them
    await api.setNowPlaying(song);
    expect((await api.getSession()).nowPlaying?.track.id).toBe(song.id);
    await api.signIn('maren');
    expect((await api.getNearby()).find((s) => s.person.id === me.id)).toBeUndefined();

    // on air: there you are
    await api.logIn('test.person', PW);
    await api.setSharing(true);
    await api.signIn('maren');
    const mine = (await api.getNearby()).find((s) => s.person.id === me.id);
    expect(mine).toMatchObject({ status: 'playing', track: { id: song.id }, note: null });

    // a note turns it into a shared track
    await api.logIn('test.person', PW);
    clock.now += MIN;
    await api.setNowPlaying(tracks['sidhu-295'], '  trust me  ');
    await api.signIn('maren');
    expect((await api.getNearby()).find((s) => s.person.id === me.id)).toMatchObject({ status: 'shared', note: 'trust me' });

    // off air again: gone at once, history included
    await api.logIn('test.person', PW);
    await api.setSharing(false);
    await api.signIn('maren');
    expect((await api.getNearby()).find((s) => s.person.id === me.id)).toBeUndefined();
  });

  it('does not let the simulation drive whoever is signed in', async () => {
    const { api, clock } = await fresh();
    await api.signIn('maren');
    await api.setArea('to-queen-west', 'picked');
    for (let i = 0; i < 40; i++) {
      clock.now += MIN;
      await api.refreshNearby();
      expect((await api.getNearby()).find((s) => s.person.id === 'maren')).toBeUndefined();
    }
    expect((await api.getSession()).nowPlaying).toBeNull();
  });
});

describe('crate', () => {
  it('saves and unsaves, per account, and marks saved songs in the feed', async () => {
    const { api } = await fresh();
    await api.createAccount(newbie);
    await api.setArea('to-queen-west', 'picked');
    await api.refreshNearby();
    const first = (await api.getNearby())[0];
    expect(first.saved).toBe(false);

    expect(await api.toggleSave(first.track)).toBe(true);
    expect((await api.getCrate()).map((t) => t.id)).toEqual([first.track.id]);
    expect((await api.getNearby()).find((s) => s.id === first.id)?.saved).toBe(true);

    await api.signIn('dev');
    expect(await api.getCrate()).toEqual([]);

    await api.logIn('test.person', PW);
    expect(await api.toggleSave(first.track)).toBe(false);
    expect(await api.getCrate()).toEqual([]);
  });
});

describe('sending a song', () => {
  const song = tracks['alvvays-archie'];

  it('reaches them, and accepting opens a chat with the song on top', async () => {
    const { api, clock } = await fresh();
    const me = await api.createAccount(newbie);
    const sent = await api.sendSong('maren', song, '  for the streetcar ');
    expect(sent.kind).toBe('request');
    expect(await api.getLink('maren')).toEqual({ kind: 'sent', id: sent.id });
    expect((await api.getInbox()).sent.map((r) => r.to.id)).toEqual(['maren']);

    // the other side
    await api.signIn('maren');
    expect(await api.getInboxCount()).toBe(1);
    const waiting = (await api.getInbox()).waiting;
    expect(waiting).toHaveLength(1);
    expect(waiting[0]).toMatchObject({ from: { id: me.id }, track: { id: song.id }, note: 'for the streetcar' });
    expect(await api.getLink(me.id)).toEqual({ kind: 'incoming', id: sent.id });

    await api.answerSong(sent.id, true);
    expect((await api.getInbox()).waiting).toEqual([]);
    clock.now += 1000;
    await api.sendMessage(sent.id, 'ok this is very good');
    const chat = await api.getChat(sent.id);
    expect(chat?.opener.track.id).toBe(song.id);
    expect(chat?.other.id).toBe(me.id);
    expect(chat?.messages.map((m) => m.body)).toEqual(['ok this is very good']);

    // back to the sender: it's a chat now, with something unread
    await api.logIn('test.person', PW);
    expect(await api.getLink('maren')).toEqual({ kind: 'chat', id: sent.id });
    const inbox = await api.getInbox();
    expect(inbox.sent).toEqual([]);
    expect(inbox.chats[0]).toMatchObject({ id: sent.id, other: { id: 'maren' }, unread: 1, last: { mine: false } });
    expect(await api.getInboxCount()).toBe(1);
    await api.markChatRead(sent.id);
    expect(await api.getInboxCount()).toBe(0);

    // once you're talking, another song goes into the chat rather than a new request
    clock.now += 1000;
    expect(await api.sendSong('maren', tracks['sidhu-295'], 'and this')).toEqual({ kind: 'chat', id: sent.id });
    const after = await api.getChat(sent.id);
    expect(after?.messages.at(-1)).toMatchObject({ body: 'and this', track: { id: 'sidhu-295' } });
    expect(after?.opener.track.id).toBe(song.id); // the first song stays pinned
  });

  it('tells nobody about a decline', async () => {
    const { api } = await fresh();
    const me = await api.createAccount(newbie);
    const sent = await api.sendSong('dev', song);
    await api.signIn('dev');
    await api.answerSong(sent.id, false);
    expect(await api.getInbox()).toEqual({ waiting: [], chats: [], sent: [] });
    expect(await api.getLink(me.id)).toEqual({ kind: 'none' });

    await api.logIn('test.person', PW);
    const inbox = await api.getInbox();
    expect(inbox.sent.map((r) => r.id)).toEqual([sent.id]); // still just "sent"
    expect(inbox.chats).toEqual([]);
    expect(await api.getLink('dev')).toEqual({ kind: 'sent', id: sent.id });
    expect(await api.getChat(sent.id)).toBeNull();
  });

  it('allows one unanswered song per person, and none to yourself', async () => {
    const { api } = await fresh();
    const me = await api.createAccount(newbie);
    await api.sendSong('tobi', song);
    await expect(api.sendSong('tobi', song)).rejects.toMatchObject({ code: 'already-sent' });
    await expect(api.sendSong(me.id, song)).rejects.toMatchObject({ code: 'self' });
    await expect(api.sendSong('nobody', song)).rejects.toMatchObject({ code: 'unknown-person' });
    await api.signIn('tobi');
    await expect(api.sendSong(me.id, song)).rejects.toMatchObject({ code: 'they-sent-first' });
  });

  it('remembers what they had on when you sent it', async () => {
    const { api } = await fresh();
    await api.createAccount(newbie);
    await api.setArea('to-queen-west', 'picked');
    await api.refreshNearby();
    const someone = (await api.getNearby())[0];
    const sent = await api.sendSong(someone.person.id, song);
    expect((await api.getNearby()).find((s) => s.id === someone.id)?.link).toEqual({ kind: 'sent', id: sent.id });
    await api.signIn(someone.person.id);
    expect((await api.getInbox()).waiting[0].about?.id).toBe(someone.track.id);
    // anyone you've sent a song to can be borrowed, so both sides are testable
    expect((await api.listAccounts()).map((a) => a.id)).toContain(someone.person.id);
  });

  it('keeps chats private to the two people in them', async () => {
    const { api } = await fresh();
    await api.createAccount(newbie);
    const sent = await api.sendSong('maren', song);
    await api.signIn('maren');
    await api.answerSong(sent.id, true);
    await api.signIn('dev');
    expect(await api.getChat(sent.id)).toBeNull();
    await expect(api.sendMessage(sent.id, 'hello?')).rejects.toThrow();
    await expect(api.answerSong(sent.id, true)).rejects.toThrow();
  });
});

describe('residents noticing you', () => {
  it('sends you a song once you are on air, and says one thing if you accept', async () => {
    const { api, clock } = await fresh();
    await api.createAccount(newbie);
    await api.setArea('to-queen-west', 'picked');
    await api.setSharing(true);
    await api.refreshNearby();
    expect((await api.getInbox()).waiting).toEqual([]); // nothing on yet, nothing to notice

    await api.setNowPlaying(tracks['big-thief-not']);
    for (let i = 0; i < 40 && !(await api.getInbox()).waiting.length; i++) {
      clock.now += 15_000;
      await api.refreshNearby();
    }
    const [hello] = (await api.getInbox()).waiting;
    expect(hello).toBeDefined();
    expect(hello.from.seeded).toBe(true);
    expect(hello.note).not.toMatch(/\{/); // the template was filled in
    expect(hello.about?.id).toBe('big-thief-not');

    // only one at a time
    for (let i = 0; i < 20; i++) {
      clock.now += 15_000;
      await api.refreshNearby();
    }
    expect((await api.getInbox()).waiting).toHaveLength(1);

    await api.answerSong(hello.id, true);
    clock.now += 15_000;
    await api.refreshNearby();
    const chat = await api.getChat(hello.id);
    expect(chat?.messages).toHaveLength(1);
    expect(chat?.messages[0].fromId).toBe(hello.from.id);
    clock.now += 15_000;
    await api.refreshNearby();
    expect((await api.getChat(hello.id))?.messages).toHaveLength(1); // and then they go quiet
  });

  it('leaves borrowed residents alone', async () => {
    const { api, clock } = await fresh();
    await api.signIn('maren');
    await api.setArea('to-queen-west', 'picked');
    await api.setNowPlaying(tracks['big-thief-not']);
    for (let i = 0; i < 30; i++) {
      clock.now += 15_000;
      await api.refreshNearby();
    }
    expect((await api.getInbox()).waiting).toEqual([]);
  });
});

describe('rooms', () => {
  it('gives every resident a decorated room made of things that exist', async () => {
    const { api } = await fresh();
    const looksSeen = new Set<string>();
    for (const r of residents) {
      const view = await api.getRoom(r.id);
      expect(view).not.toBeNull();
      const { room, tracks, people } = view!;
      expect(room.sections.length).toBeGreaterThanOrEqual(5);
      looksSeen.add(`${room.theme.paper}|${room.theme.ink}|${room.theme.displayFont}|${room.theme.texture}|${room.theme.layout}`);
      for (const s of room.sections) {
        if (s.kind === 'intro') {
          expect(s.songs).toHaveLength(3);
          s.songs.forEach((x) => expect(tracks[x.trackId]).toBeDefined());
        }
        if (s.kind === 'pinned') {
          expect(tracks[s.trackId!]).toBeDefined();
          expect(s.note.length).toBeGreaterThan(40);
        }
        if (s.kind === 'wall' || s.kind === 'shelf') s.trackIds.forEach((t) => expect(tracks[t]).toBeDefined());
        if (s.kind === 'guestbook') {
          expect(s.entries.length).toBeGreaterThanOrEqual(2);
          s.entries.forEach((e) => {
            expect(people[e.fromId]).toBeDefined();
            expect(e.fromId).not.toBe(r.id);
          });
        }
      }
    }
    expect(looksSeen.size).toBeGreaterThanOrEqual(30); // no two rooms alike, near enough
  });

  it('starts a new account with a plain room it can make its own', async () => {
    const { api } = await fresh();
    const me = await api.createAccount(newbie);
    const before = await api.getRoom(me.id);
    expect(before?.mine).toBe(true);
    expect(before?.room.sections.map((s) => s.kind)).toEqual(['intro', 'pinned', 'wall', 'recent', 'guestbook']);

    const picked: Track = { ...tracks['alvvays-archie'], id: 'itunes:999', sourceId: '999', title: 'A Song From Search' };
    const room = before!.room;
    await api.saveRoom(
      {
        ...room,
        theme: { ...room.theme, paper: '#161616', ink: '#FFD23F', displayFont: 'hand', texture: 'grid', layout: 'poster' },
        sections: [
          { kind: 'shelf', title: 'songs for the dentist', trackIds: ['itunes:999', 'sidhu-295'] },
          ...room.sections.reverse(),
        ],
      },
      [picked],
    );
    const after = await api.getRoom(me.id);
    expect(after?.room.theme).toMatchObject({ paper: '#161616', displayFont: 'hand', layout: 'poster' });
    expect(after?.room.sections.map((s) => s.kind)).toEqual(['shelf', 'guestbook', 'recent', 'wall', 'pinned', 'intro']);
    expect(after?.tracks['itunes:999'].title).toBe('A Song From Search');
  });

  it('only lets you decorate your own', async () => {
    const { api } = await fresh();
    await api.createAccount(newbie);
    const theirs = (await api.getRoom('maren'))!;
    expect(theirs.mine).toBe(false);
    await expect(api.saveRoom(theirs.room)).rejects.toThrow();
  });

  it('shows what you have really played, unless you hide it', async () => {
    const { api, clock } = await fresh();
    const me = await api.createAccount(newbie);
    await api.setNowPlaying(tracks['sidhu-295']);
    clock.now += MIN;
    await api.setNowPlaying(tracks['alvvays-archie']);
    const recent = async () => (await api.getRoom(me.id))!.room.sections.find((s) => s.kind === 'recent');
    expect(await recent()).toMatchObject({ visibility: 'shown', trackIds: ['alvvays-archie', 'sidhu-295'] });

    const room = (await api.getRoom(me.id))!.room;
    await api.saveRoom({ ...room, sections: room.sections.map((s) => (s.kind === 'recent' ? { ...s, visibility: 'hidden' as const } : s)) });
    expect(await recent()).toMatchObject({ visibility: 'hidden', trackIds: [] });
    await api.signIn('maren');
    expect((await api.getRoom(me.id))!.room.sections.find((s) => s.kind === 'recent')).toMatchObject({ trackIds: [] });
  });

  it('lets visitors sign the guestbook once, and the owner tear a page out', async () => {
    const { api } = await fresh();
    const me = await api.createAccount(newbie);
    await expect(api.signGuestbook(me.id, tracks['sidhu-295'], 'for me')).rejects.toThrow();

    await api.signIn('maren');
    await api.signGuestbook(me.id, tracks['sidhu-295'], 'first try');
    await api.signGuestbook(me.id, tracks['alvvays-archie'], 'no, this one');
    await api.signIn('dev');
    await api.signGuestbook(me.id, tracks['burial-archangel'], 'for the bus');

    await api.logIn('test.person', PW);
    const book = () => api.getRoom(me.id).then((v) => v!.room.sections.find((s) => s.kind === 'guestbook'));
    let g = await book();
    expect(g?.kind === 'guestbook' && g.entries.map((e) => [e.fromId, e.trackId])).toEqual([
      ['dev', 'burial-archangel'],
      ['maren', 'alvvays-archie'],
    ]);

    // the owner can remove an entry but can't forge or edit one
    const room = (await api.getRoom(me.id))!.room;
    await api.saveRoom({
      ...room,
      sections: room.sections.map((s) =>
        s.kind === 'guestbook'
          ? { ...s, entries: [{ fromId: 'maren', trackId: 'alvvays-archie', why: 'i love you' }, { fromId: 'tobi', trackId: 'sidhu-295', why: 'fake' }] }
          : s,
      ),
    });
    g = await book();
    expect(g?.kind === 'guestbook' && g.entries).toMatchObject([{ fromId: 'maren', why: 'no, this one' }]);
  });

  it('updates your name, badge and tagline everywhere', async () => {
    const { api } = await fresh();
    await api.createAccount(newbie);
    await api.updateProfile({ name: 'New Name', tagline: 'listens too loud', bio: 'hello', badge: 'nn', badgeColor: '#000000' });
    expect((await api.getSession()).me).toMatchObject({ name: 'New Name', tagline: 'listens too loud', badge: 'NN' });
  });
});

describe('housekeeping', () => {
  it('tells subscribers when things change, and stops when asked', async () => {
    const { api } = await fresh();
    let calls = 0;
    const stop = api.subscribe('session', () => calls++);
    await api.createAccount(newbie);
    expect(calls).toBe(1);
    stop();
    await api.signOut();
    expect(calls).toBe(1);
  });

  it('resets to a fresh install', async () => {
    const { api } = await fresh();
    await api.createAccount(newbie);
    await api.setArea('to-queen-west', 'picked');
    await api.resetEverything();
    const s = await api.getSession();
    expect(s.me).toBeNull();
    expect(s.area).toBeNull();
    expect(await api.getPerson('maren')).not.toBeNull();
  });
});

describe('seeded stickers', () => {
  it('all have a real colour and sit somewhere sensible', async () => {
    const { api } = await fresh();
    for (const r of residents) {
      const { room } = (await api.getRoom(r.id))!;
      for (const s of room.sections) {
        for (const st of s.stickers ?? []) {
          expect(st.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
          expect(st.x).toBeGreaterThanOrEqual(-0.2);
          expect(st.x).toBeLessThanOrEqual(1);
          expect(st.size).toBeGreaterThanOrEqual(32);
          expect(Math.abs(st.rotate)).toBeLessThanOrEqual(40);
        }
      }
    }
  });
});

describe('city', () => {
  it('seeds posts by real residents about real tracks, in their own home city', async () => {
    const homes = new Map(residents.map((r) => [r.id, r.homeCity]));
    for (const p of seedPosts) {
      expect(homes.has(p.by)).toBe(true);
      expect(tracks[p.trackId]).toBeDefined();
      expect(p.note.length).toBeGreaterThan(20);
    }
    expect(new Set(seedPosts.map((p) => p.note)).size).toBe(seedPosts.length);
  });

  it('shows a city its own posts, newest first, and the GTA everything', async () => {
    const { api } = await fresh();
    await api.createAccount(newbie);
    const toronto = await api.getCityFeed('Toronto');
    expect(toronto.posts.length).toBeGreaterThanOrEqual(15);
    expect(toronto.posts.every((p) => p.city === 'Toronto' && p.person.homeCity === 'Toronto')).toBe(true);
    expect(toronto.posts.map((p) => p.postedAt)).toEqual([...toronto.posts.map((p) => p.postedAt)].sort((a, b) => b - a));

    const vaughan = await api.getCityFeed('Vaughan');
    expect(vaughan.posts.length).toBeGreaterThanOrEqual(4);
    expect(vaughan.posts.every((p) => p.city === 'Vaughan')).toBe(true);

    const gta = await api.getCityFeed('GTA');
    expect(gta.posts.length).toBeGreaterThan(toronto.posts.length + vaughan.posts.length);
    expect(new Set(gta.posts.map((p) => p.city)).size).toBeGreaterThanOrEqual(5);
    expect((await api.getCityFeed('Oakville')).posts).toEqual([]);
  });

  it('lets more posts arrive as time passes', async () => {
    const { api, clock } = await fresh();
    await api.createAccount(newbie);
    const before = (await api.getCityFeed('GTA')).posts.length;
    clock.now += 3 * 60 * MIN;
    const after = (await api.getCityFeed('GTA')).posts;
    expect(after.length).toBe(before + 8);
    expect(after.every((p) => p.postedAt <= clock.now)).toBe(true);
  });

  it('says which artists a city is paying attention to', async () => {
    const { api } = await fresh();
    await api.createAccount(newbie);
    const { trending } = await api.getCityFeed('Brampton');
    expect(trending.length).toBeGreaterThanOrEqual(3);
    expect(trending.length).toBeLessThanOrEqual(6);
    expect(trending.map((t) => t.artist)).toContain('Sidhu Moose Wala');
    expect(trending.every((t) => t.posts + t.plays > 0 && t.artworkUrl.startsWith('http'))).toBe(true);
    // the region ranks more than any one city does
    const gta = (await api.getCityFeed('GTA')).trending;
    expect(gta[0].posts).toBeGreaterThanOrEqual(2);
  });

  it('posts to your home city, not to wherever you happen to be', async () => {
    const { api, clock } = await fresh();
    const me = await api.createAccount({ ...newbie, homeCity: 'Vaughan' });
    await api.setArea('to-queen-west', 'picked'); // standing in Toronto
    await expect(api.postToCity(tracks['sidhu-295'], '   ')).rejects.toThrow();
    clock.now += MIN;
    const id = await api.postToCity(tracks['sidhu-295'], ' for the 400 northbound ');

    const vaughan = await api.getCityFeed('Vaughan');
    expect(vaughan.posts[0]).toMatchObject({ id, city: 'Vaughan', note: 'for the 400 northbound', mine: true, person: { id: me.id } });
    expect((await api.getCityFeed('Toronto')).posts.find((p) => p.id === id)).toBeUndefined();
    // posting to the city is not sharing nearby
    await api.signIn('maren');
    expect((await api.getNearby()).find((s) => s.person.id === me.id)).toBeUndefined();
    expect((await api.getCityFeed('Vaughan')).posts[0]).toMatchObject({ id, mine: false });

    // only the author can take it down
    await api.removePost(id);
    expect((await api.getCityFeed('Vaughan')).posts[0].id).toBe(id);
    await api.logIn('test.person', PW);
    await api.removePost(id);
    expect((await api.getCityFeed('Vaughan')).posts.find((p) => p.id === id)).toBeUndefined();
  });

  it('lets you move home, which changes where your next post goes', async () => {
    const { api, clock } = await fresh();
    await api.createAccount(newbie);
    await expect(api.setHomeCity('Atlantis')).rejects.toThrow();
    await api.setHomeCity('Markham');
    expect((await api.getSession()).me?.homeCity).toBe('Markham');
    clock.now += MIN;
    const id = await api.postToCity(tracks['alvvays-archie'], 'new in town');
    expect((await api.getCityFeed('Markham')).posts[0].id).toBe(id);
  });
});

describe('artist rooms', () => {
  it('has a room per city, and a GTA room that rolls them all up', async () => {
    const { api } = await fresh();
    await api.createAccount(newbie);
    const toronto = await api.getArtistSpace('Big Thief', 'Toronto');
    expect(toronto.artist).toBe('Big Thief');
    expect(toronto.threads.length).toBe(2);
    expect(toronto.threads.every((t) => t.city === 'Toronto')).toBe(true);
    expect(toronto.threads[0].last).not.toBeNull();
    expect(toronto.tracks.length).toBeGreaterThanOrEqual(3);
    expect(toronto.listeners.map((p) => p.id)).toContain('maren');

    // Steely Dan's only thread was started in Vaughan
    const inToronto = await api.getArtistSpace('steely dan', 'Toronto');
    expect(inToronto.artist).toBe('Steely Dan'); // the source's spelling, whatever was asked for
    expect(inToronto.threads).toEqual([]);
    expect(inToronto.elsewhere).toBe(1);
    expect((await api.getArtistSpace('Steely Dan', 'Vaughan')).threads).toHaveLength(1);
    const gta = await api.getArtistSpace('Steely Dan', 'GTA');
    expect(gta.threads).toHaveLength(1);
    expect(gta.threads[0].city).toBe('Vaughan');
    expect(gta.elsewhere).toBe(0);
  });

  it('still has somewhere to go for an artist nobody has talked about', async () => {
    const { api } = await fresh();
    await api.createAccount(newbie);
    const space = await api.getArtistSpace('Joni Mitchell', 'GTA');
    expect(space.threads).toEqual([]);
    expect(space.tracks.length).toBeGreaterThanOrEqual(1);
    const unknown = await api.getArtistSpace('A Band From Search', 'Toronto');
    expect(unknown).toMatchObject({ artist: 'A Band From Search', threads: [], tracks: [], listeners: [] });
  });

  it('reads like a conversation: in order, by real people, some with songs', async () => {
    const { api } = await fresh();
    await api.createAccount(newbie);
    const [summary] = (await api.getArtistSpace('Sidhu Moose Wala', 'Brampton')).threads;
    const thread = (await api.getThread(summary.id))!;
    expect(thread.starter.id).toBe('priya');
    expect(thread.replies.length).toBe(summary.replies);
    expect(thread.replies.map((r) => r.at)).toEqual([...thread.replies.map((r) => r.at)].sort((a, b) => a - b));
    expect(thread.replies.every((r) => r.at >= thread.startedAt)).toBe(true);
    expect(thread.replies.some((r) => r.track?.id === 'sidhu-295')).toBe(true);
    expect(await api.getThread('999999')).toBeNull();
  });

  it('keeps moving: replies that were due arrive later', async () => {
    const { api, clock } = await fresh();
    await api.createAccount(newbie);
    const find = async () => (await api.getArtistSpace('Big Thief', 'Toronto')).threads.find((t) => t.title.includes('alone'))!;
    const before = await find();
    clock.now += 10 * MIN;
    const after = await find();
    expect(after.replies).toBe(before.replies + 1);
    expect(after.last?.person.id).toBe('tessa');
  });

  it('lets you start a thread in your home city and reply with a song', async () => {
    const { api, clock } = await fresh();
    const me = await api.createAccount({ ...newbie, homeCity: 'Markham' });
    await expect(api.startThread('Joni Mitchell', '  ', 'no title')).rejects.toThrow();
    const id = await api.startThread('Joni Mitchell', 'Best live recording?', 'asking for a friend');
    expect((await api.getArtistSpace('Joni Mitchell', 'Toronto')).threads).toEqual([]);
    expect((await api.getArtistSpace('Joni Mitchell', 'Markham')).threads[0]).toMatchObject({ id, city: 'Markham', replies: 0, starter: { id: me.id } });
    expect((await api.getArtistSpace('Joni Mitchell', 'GTA')).threads).toHaveLength(1);

    await api.signIn('maren');
    clock.now += MIN;
    await api.replyToThread(id, 'the one from the radio session', tracks['joni-a-case-of-you']);
    await api.replyToThread(id, '   ');
    const thread = (await api.getThread(id))!;
    expect(thread.replies).toHaveLength(1);
    expect(thread.replies[0]).toMatchObject({ person: { id: 'maren' }, body: 'the one from the radio session', track: { id: 'joni-a-case-of-you' } });
    await expect(api.replyToThread('424242', 'hello?')).rejects.toThrow();
  });

  it('seeds threads about artists we have, by residents who exist', async () => {
    const { seedThreads } = jest.requireActual('@/seed/threads') as typeof import('@/seed/threads');
    const ids = new Set(residents.map((r) => r.id));
    for (const th of seedThreads) {
      expect(tracks[th.artistOf]).toBeDefined();
      expect(ids.has(th.by)).toBe(true);
      expect(th.replies.length).toBeGreaterThanOrEqual(3);
      for (const r of th.replies) {
        expect(ids.has(r.by)).toBe(true);
        if (r.trackId) expect(tracks[r.trackId]).toBeDefined();
        if (r.after !== undefined) expect(r.after).toBeLessThan(th.daysAgo * 24);
      }
    }
  });
});

describe('seeded listening history', () => {
  it('covers everything in a resident’s rotation, so artist rooms know their listeners', async () => {
    const { api } = await fresh();
    await api.createAccount(newbie);
    const fans = (await api.getArtistSpace('Big Thief', 'Toronto')).listeners.map((p) => p.id);
    expect(fans).toEqual(expect.arrayContaining(['maren', 'tessa']));
    // but history is never "nearby"
    await api.setArea('to-queen-west', 'picked');
    expect(await api.getNearby()).toEqual([]);
  });
});

describe('accounts from the backend', () => {
  const cloud = {
    id: '3f2b6c1e-9a47-4d5e-8b21-0c9d7e6f5a43',
    name: 'Cloud Person',
    handle: 'cloud.person',
    badge: 'CP',
    badgeColor: '#000000',
    tagline: '',
    bio: '',
    homeCity: 'Vaughan',
  };

  it('signs the phone in as a verified backend account, and keeps its details current', async () => {
    const { api } = await fresh();
    await api.adoptAccount(cloud);
    expect(await api.getSession()).toMatchObject({ me: { id: cloud.id, handle: 'cloud.person', homeCity: 'Vaughan', seeded: false }, needsPassword: true });
    expect((await api.getRoom(cloud.id))?.mine).toBe(true); // gets a starter room like anyone else

    await api.signOut();
    await api.adoptAccount({ ...cloud, name: 'Renamed Elsewhere', homeCity: 'Markham' });
    expect((await api.getSession()).me).toMatchObject({ id: cloud.id, name: 'Renamed Elsewhere', homeCity: 'Markham' });
    await expect(api.adoptAccount({ ...cloud, id: 'maren' })).rejects.toMatchObject({ code: 'resident' });
  });

  it('gives way on a handle when the backend says someone else owns it', async () => {
    const { api } = await fresh();
    const local = await api.createAccount({ ...newbie, handle: 'cloud.person' });
    await api.adoptAccount(cloud);
    expect((await api.getPerson(cloud.id))?.handle).toBe('cloud.person');
    expect((await api.getPerson(local.id))?.handle).toBe('cloud.person.old');
  });

  it('moves a phone-only account’s whole life over to its new backend account', async () => {
    const { api, clock } = await fresh();
    const old = await api.createAccount(newbie);
    await api.updateProfile({ name: 'Test Person', tagline: 'kept my tagline', bio: 'and my bio', badge: 'TP', badgeColor: '#fff' });
    await api.setArea('to-queen-west', 'picked');
    await api.setSharing(true);
    await api.setNowPlaying(tracks['sidhu-295']);
    await api.toggleSave(tracks['alvvays-archie']);
    const sent = await api.sendSong('maren', tracks['big-thief-not'], 'hello');
    const postId = await api.postToCity(tracks['feist-mushaboom'], 'for toronto');
    const threadId = await api.startThread('Joni Mitchell', 'Best live recording?', '');
    await api.signGuestbook('dev', tracks['burial-archangel'], 'for the bus');
    const room = (await api.getRoom(old.id))!.room;
    await api.saveRoom({ ...room, theme: { ...room.theme, paper: '#161616' } });
    await api.signIn('maren');
    await api.answerSong(sent.id, true);
    clock.now += MIN;
    await api.sendMessage(sent.id, 'hi back');

    // they verify an email; the backend account arrives and takes everything over
    await api.adoptAccount({ ...cloud, handle: 'test.person' });
    await api.moveAccountData(old.id, cloud.id);

    expect(await api.getPerson(old.id)).toBeNull();
    const s = await api.getSession();
    expect(s.me).toMatchObject({ id: cloud.id, handle: 'test.person', tagline: 'kept my tagline', bio: 'and my bio' });
    expect(s.sharing).toBe(true);
    expect(s.nowPlaying?.track.id).toBe('sidhu-295');
    expect((await api.getCrate()).map((t) => t.id)).toEqual(['alvvays-archie']);
    expect((await api.getRoom(cloud.id))!.room.theme.paper).toBe('#161616');
    const inbox = await api.getInbox();
    expect(inbox.chats[0]).toMatchObject({ id: sent.id, other: { id: 'maren' }, unread: 1 });
    expect((await api.getChat(sent.id))?.opener.from.id).toBe(cloud.id);
    expect((await api.getCityFeed('Toronto')).posts.find((p) => p.id === postId)).toMatchObject({ mine: true, person: { id: cloud.id } });
    expect((await api.getThread(threadId))?.starter.id).toBe(cloud.id);
    const devBook = (await api.getRoom('dev'))!.room.sections.find((x) => x.kind === 'guestbook');
    expect(devBook?.kind === 'guestbook' && devBook.entries[0].fromId).toBe(cloud.id);

    await expect(api.moveAccountData('maren', cloud.id)).rejects.toMatchObject({ code: 'resident' });
    await expect(api.moveAccountData('nobody', cloud.id)).rejects.toMatchObject({ code: 'no-such-account' });
  });
});
