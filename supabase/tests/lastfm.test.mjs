// The server following Last.fm for people who are sharing, so their song keeps
// up while the app is closed.
//
//   npm run test:server
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, MIN, track } from './harness.mjs';

const QW = { p_area: 'to-queen-west', p_source: 'gps' };
const open = async (api, id) =>
  (await api.db.query('select track_id from app.plays where user_id = $1 and ended_at is null', [id])).rows.map((r) => r.track_id);
const plays = async (api, id) => (await api.db.query('select count(*)::int as n from app.plays where user_id = $1', [id])).rows[0].n;

describe('Last.fm, checked by the server', () => {
  test('only people sharing with a linked username are due, and the checking functions are server-only', async () => {
    const api = await freshDb({ seed: false });
    const quiet = await api.signUp({ handle: 'quiet' });
    await api.rpc('set_lastfm', { p_user: 'quietone' }); // linked, but not sharing
    const ana = await api.signUp({ handle: 'ana' });
    await api.rpc('set_area', QW);
    await api.rpc('set_sharing', { p_on: true });
    assert.equal(await api.fails('set_lastfm', { p_user: 'not a name!' }), 'bad-username');
    assert.deepEqual(await api.rpc('lastfm_due', { p_limit: 10 }), [], 'sharing but not linked');
    await api.rpc('set_lastfm', { p_user: 'ana_listens' });

    assert.deepEqual(await api.rpc('lastfm_due', { p_limit: 10 }), [{ id: ana, user: 'ana_listens', key: null }]);
    assert.ok(quiet);

    const may = async (role, fn) => (await api.db.query(`select has_function_privilege('${role}', '${fn}', 'execute') as ok`)).rows[0].ok;
    for (const fn of ['public.lastfm_due(integer)', 'public.lastfm_set(text, text, jsonb)']) {
      assert.equal(await may('authenticated', fn), false, `${fn} is not for phones`);
      assert.equal(await may('service_role', fn), true);
    }
    assert.equal(await may('authenticated', 'public.set_lastfm(text)'), true);
  });

  test('puts songs on and takes them off, without doubling up with the phone or touching a hand-picked song', async () => {
    const api = await freshDb({ seed: false });
    const ana = await api.signUp({ handle: 'ana' });
    await api.rpc('set_area', QW);
    await api.rpc('set_sharing', { p_on: true });
    await api.rpc('set_lastfm', { p_user: 'ana_listens' });
    const a = track('itunes:1', 'Racing Mount Pleasant', 'Regulate');

    await api.rpc('lastfm_set', { p_id: ana, p_key: 'racing mount pleasant|regulate', p_track: a });
    assert.deepEqual(await open(api, ana), ['itunes:1']);
    await api.rpc('set_now_playing', { p_track: a, p_note: null }); // the phone, open, saw the same song
    assert.equal(await plays(api, ana), 1, 'still one play');

    await api.clock.advance(4 * MIN);
    await api.rpc('lastfm_set', { p_id: ana, p_key: null, p_track: null });
    assert.deepEqual(await open(api, ana), [], 'Last.fm went quiet, so the song came off');

    const mine = track('itunes:2');
    await api.rpc('set_now_playing', { p_track: mine, p_note: null });
    await api.rpc('lastfm_set', { p_id: ana, p_key: null, p_track: null });
    assert.deepEqual(await open(api, ana), ['itunes:2'], 'a song picked by hand stays');

    // a cover from nowhere earshot trusts: nothing goes on, nothing breaks, and that song isn't tried again
    await api.rpc('lastfm_set', { p_id: ana, p_key: 'x|y', p_track: { ...track('lastfm:x'), artworkUrl: 'https://evil.example/a.jpg' } });
    assert.deepEqual(await open(api, ana), ['itunes:2']);
    assert.equal((await api.rpc('lastfm_due', { p_limit: 10 }))[0].key, 'x|y');

    // unlinking stops it
    await api.rpc('set_lastfm', { p_user: null });
    assert.deepEqual(await api.rpc('lastfm_due', { p_limit: 10 }), []);
  });
});
