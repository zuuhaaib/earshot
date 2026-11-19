// Fixes from the security review: planted song links, off-air listening in
// rooms, and hopping between areas to find someone.
//
//   npm run test:server
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, MIN, track } from './harness.mjs';

const QW = { p_area: 'to-queen-west', p_source: 'picked' };

describe('song links come only from the services earshot uses', () => {
  test('artwork or audio from anywhere else is refused, so a real song cannot be planted for everyone', async () => {
    const api = await freshDb({ seed: false });
    const someone = await api.signUp({ handle: 'someone' });
    const real = track('itunes:1693813373', 'Big Thief', 'Vampire Empire');
    const planted = [
      { ...real, artworkUrl: 'https://evil.example/cover.jpg' },
      { ...real, artworkUrl: 'http://is1-ssl.mzstatic.com/x.jpg' }, // not https
      { ...real, artworkUrl: 'https://evil.example/.mzstatic.com/x.jpg' },
      { ...real, artworkUrl: 'https://user@evil.example/is1-ssl.mzstatic.com/x.jpg' },
      { ...real, previewUrl: 'https://evil.example/listen.m4a' },
      { ...real, previewUrl: 'https://itunes.apple.com.evil.example/a.m4a' },
    ];
    for (const t of planted) {
      assert.equal(await api.fails('post_to_city', { p_track: t, p_note: 'listen' }), 'bad-track', JSON.stringify(t));
      assert.equal(await api.fails('set_now_playing', { p_track: t, p_note: null }), 'bad-track');
    }
    assert.equal((await api.db.query("select count(*)::int as n from app.tracks where id = 'itunes:1693813373'")).rows[0].n, 0, 'nothing was stored');

    // the real thing still goes through, and so do Last.fm and Spotify covers with no preview
    await api.rpc('set_now_playing', { p_track: real, p_note: null });
    for (const cover of ['https://lastfm.freetls.fastly.net/i/u/300x300/abc.jpg', 'https://i.scdn.co/image/abc']) {
      await api.rpc('set_now_playing', { p_track: { ...track(`other-${cover.length}`), artworkUrl: cover, previewUrl: null }, p_note: null });
    }
    assert.equal(someone.length > 0, true);
  });
});

describe('rooms only show what you played on air', () => {
  test('off-air listening stays out of your room, and going off air later keeps what was public', async () => {
    const api = await freshDb({ seed: false });
    const me = await api.signUp({ handle: 'me' });
    await api.rpc('set_area', QW);
    await api.rpc('set_now_playing', { p_track: track('private-1'), p_note: null }); // off air
    await api.rpc('set_sharing', { p_on: true });
    await api.rpc('set_now_playing', { p_track: track('public-1'), p_note: null });
    await api.rpc('set_sharing', { p_on: false });
    await api.rpc('set_now_playing', { p_track: track('private-2'), p_note: null });

    await api.signUp({ handle: 'visitor' });
    const room = await api.rpc('get_room', { p_person: me });
    assert.deepEqual(room.room.sections.find((s) => s.kind === 'recent').trackIds, ['public-1']);
  });
});

describe('changing area', () => {
  test('moving is fine, but not more than once every five minutes or twelve times a day', async () => {
    const api = await freshDb({ seed: false });
    await api.signUp({ handle: 'mover' });
    await api.rpc('set_area', QW); // the first placing isn't a move
    await api.rpc('set_area', QW); // nor is staying put
    await api.rpc('set_area', { p_area: 'to-annex', p_source: 'gps' });
    assert.equal(await api.fails('set_area', { p_area: 'to-danforth', p_source: 'picked' }), 'moving-too-fast');
    assert.equal(await api.fails('set_area', { p_area: 'to-danforth', p_source: 'gps' }), 'moving-too-fast', 'claiming GPS does not get round it');

    const areas = ['to-downtown', 'to-kensington', 'to-yorkville', 'to-little-italy', 'to-liberty', 'to-parkdale', 'to-roncy', 'to-junction', 'to-st-clair', 'to-leslieville', 'to-danforth', 'to-beaches'];
    let moved = 1;
    for (const area of areas) {
      await api.clock.advance(6 * MIN);
      if ((await api.fails('set_area', { p_area: area, p_source: 'picked' })) === null) moved++;
    }
    assert.equal(moved, 12, 'twelve moves in a day');
    await api.clock.advance(24 * 60 * MIN);
    assert.equal(await api.fails('set_area', { p_area: 'to-annex', p_source: 'picked' }), null, 'a new day');
  });
});
