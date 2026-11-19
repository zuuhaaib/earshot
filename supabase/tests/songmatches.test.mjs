// Songs that found each other: when two people in the same area play the same
// song, both are told about the other, by name. Who hears, what it says, and
// who must never be matched.
//
//   npm run test:server
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, MIN, START, track } from './harness.mjs';

const PG_NET = `
  create schema if not exists net;
  create table net.sent (url text, body jsonb);
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds integer default 5000)
    returns bigint language plpgsql as $$ begin insert into net.sent values (url, body); return 1; end $$;
`;
const QW = { p_area: 'to-queen-west', p_source: 'picked' };
const SONG = track('wind', 'Big Thief', 'I Want Wind to Blow');

/** Someone in Queen West with a phone that can be notified. */
async function person(api, handle, name, { optIn = true, sharing = true } = {}) {
  const id = await api.signUp({ handle, name });
  await api.rpc('register_push_token', { p_token: `ExponentPushToken[${handle}]` });
  await api.rpc('set_area', QW);
  await api.rpc('set_sharing', { p_on: sharing });
  await api.rpc('set_song_matches', { p_on: optIn });
  return id;
}
/** Anna and Ben in Queen West. START is noon in Toronto. */
async function neighbours({ anna = {}, ben = {} } = {}) {
  const api = await freshDb({ seed: false });
  await api.db.exec(PG_NET);
  return { api, anna: await person(api, 'anna', 'Anna Lee', anna), ben: await person(api, 'ben', 'Ben Ito', ben) };
}
const play = async (api, who, t = SONG) => {
  await api.as(who);
  await api.rpc('set_now_playing', { p_track: t, p_note: null });
};
/** Match notifications sent since last asked, as "who: body -> link", sorted. */
async function matches(api) {
  const rows = (await api.db.query('select body from net.sent')).rows;
  await api.db.exec('delete from net.sent');
  return rows
    .flatMap((r) => r.body)
    .filter((m) => m.title === 'songs that found each other')
    .map((m) => `${m.to.slice('ExponentPushToken['.length, -1)}: ${m.body} -> ${m.data.url}`)
    .sort();
}
const songOf = (m) => m.split(' played ')[1].split(' this ')[0].split(' just ')[0];

describe('songs that found each other', () => {
  test('both people are told about each other, by name, and pointed at each other’s room', async () => {
    const { api, anna, ben } = await neighbours();
    await play(api, ben);
    await api.clock.advance(2 * 60 * MIN);
    await play(api, anna);
    assert.deepEqual(await matches(api), [
      `anna: Ben Ito near Queen West played I Want Wind to Blow this afternoon. So did you. -> /room/${ben}`,
      `ben: Anna Lee near Queen West played I Want Wind to Blow just now. So did you. -> /room/${anna}`,
    ]);
  });

  test('it takes two: nobody is matched unless both switched it on', async () => {
    for (const off of [{ anna: { optIn: false } }, { ben: { optIn: false } }]) {
      const { api, anna, ben } = await neighbours(off);
      await play(api, ben);
      await api.clock.advance(MIN);
      await play(api, anna);
      assert.deepEqual(await matches(api), []);
    }
  });

  test('listening that was never on air is never matched, either way round', async () => {
    const one = await neighbours({ ben: { sharing: false } });
    await play(one.api, one.ben);
    await one.api.clock.advance(MIN);
    await play(one.api, one.anna);
    assert.deepEqual(await matches(one.api), [], 'Ben was off air');

    const two = await neighbours();
    await play(two.api, two.ben);
    await two.api.as(two.anna);
    await two.api.rpc('set_sharing', { p_on: false });
    await two.api.clock.advance(MIN);
    await play(two.api, two.anna);
    assert.deepEqual(await matches(two.api), [], 'Anna was off air');
  });

  test('with several matches you hear about the latest, and each of them hears about you', async () => {
    const { api, anna, ben } = await neighbours();
    // Carl switches it on only after playing, so he and Ben haven't already been matched on this song today
    const carl = await person(api, 'carl', 'Carl Mo', { optIn: false });
    await play(api, ben);
    await api.clock.advance(10 * MIN);
    await play(api, carl);
    await api.rpc('set_song_matches', { p_on: true });
    await api.clock.advance(10 * MIN);
    await play(api, anna);
    assert.deepEqual(await matches(api), [
      `anna: Carl Mo near Queen West played I Want Wind to Blow just now. So did you. -> /room/${carl}`,
      `ben: Anna Lee near Queen West played I Want Wind to Blow just now. So did you. -> /room/${anna}`,
      `carl: Anna Lee near Queen West played I Want Wind to Blow just now. So did you. -> /room/${anna}`,
    ]);
  });

  test('a different song, too long ago, a different area, or someone blocked: no match', async () => {
    let n = await neighbours();
    await play(n.api, n.ben, track('other', 'Someone', 'Another Song'));
    await n.api.clock.advance(MIN);
    await play(n.api, n.anna);
    assert.deepEqual(await matches(n.api), [], 'different song');

    n = await neighbours();
    await play(n.api, n.ben);
    await n.api.clock.advance(13 * 60 * MIN);
    await play(n.api, n.anna);
    assert.deepEqual(await matches(n.api), [], 'more than twelve hours ago');

    n = await neighbours();
    await play(n.api, n.ben);
    await n.api.as(n.anna);
    await n.api.rpc('set_area', { p_area: 'to-annex', p_source: 'picked' });
    await n.api.clock.advance(MIN);
    await play(n.api, n.anna);
    assert.deepEqual(await matches(n.api), [], 'different area');

    n = await neighbours();
    await play(n.api, n.ben);
    await n.api.as(n.anna);
    await n.api.rpc('block_person', { p_person: n.ben });
    await n.api.clock.advance(MIN);
    await play(n.api, n.anna);
    assert.deepEqual(await matches(n.api), [], 'blocked');
  });

  test('quiet: once per song a day, and three a day at most', async () => {
    const { api, anna, ben } = await neighbours();
    for (const id of ['a', 'b', 'c', 'd']) await play(api, ben, track(id, 'Artist', `Song ${id}`));
    await api.clock.advance(MIN);
    for (const id of ['a', 'a', 'b', 'c', 'd']) {
      await play(api, anna, track('gap', 'Gap', 'Gap'));
      await play(api, anna, track(id, 'Artist', `Song ${id}`));
    }
    const sent = await matches(api);
    assert.deepEqual(sent.filter((m) => m.startsWith('anna:')).map(songOf), ['Song a', 'Song b', 'Song c']);
    assert.deepEqual(sent.filter((m) => m.startsWith('ben:')).map(songOf), ['Song a', 'Song b', 'Song c']);

    await api.clock.advance(25 * 60 * MIN);
    await play(api, ben, track('d', 'Artist', 'Song d'));
    await play(api, anna, track('gap', 'Gap', 'Gap'));
    await play(api, anna, track('d', 'Artist', 'Song d'));
    assert.equal((await matches(api)).filter((m) => m.startsWith('anna:')).length, 1, 'a new day, a new allowance');
  });

  test('says when in Toronto time, and somewhere off the map is just "near you"', async () => {
    const api = await freshDb({ seed: false });
    const at = (h) => START + (h - 12) * 60 * MIN; // START is noon in Toronto
    const words = async (then, now) => (await api.db.query('select app.when_words($1, $2) as w', [then, now])).rows[0].w;
    assert.equal(await words(at(9), at(13)), 'this morning');
    assert.equal(await words(at(14), at(15)), 'this afternoon');
    assert.equal(await words(at(19), at(22)), 'this evening');
    assert.equal(await words(at(2), at(9)), 'in the small hours');
    assert.equal(await words(at(-1), at(8)), 'last night');
    assert.equal(await words(at(15), at(15) + 10 * MIN), 'just now');
    const name = async (id) => (await api.db.query('select app.area_name($1) as n', [id])).rows[0].n;
    assert.equal(await name('to-york-u'), 'York University');
    assert.equal(await name('cell:45.50:-73.55'), 'you');
  });

  test('a broken notification never stops a song being played', async () => {
    const api = await freshDb({ seed: false }); // no pg_net at all
    const anna = await api.signUp({ handle: 'anna' });
    await api.rpc('set_area', QW);
    await api.rpc('set_sharing', { p_on: true });
    await api.rpc('set_song_matches', { p_on: true });
    const ben = await api.signUp({ handle: 'ben' });
    await api.rpc('set_area', QW);
    await api.rpc('set_sharing', { p_on: true });
    await api.rpc('set_song_matches', { p_on: true });
    await play(api, ben);
    await play(api, anna);
    const s = await api.rpc('get_session');
    assert.equal(s.nowPlaying.track.id, 'wind');
    assert.equal(s.songMatches, true);
  });
});
