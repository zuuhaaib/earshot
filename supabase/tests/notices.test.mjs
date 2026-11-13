// Change notices: who gets told that something changed, and who must not be.
//
//   npm run test:server
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, track } from './harness.mjs';

const QW = { p_area: 'to-queen-west', p_source: 'picked' };
const sorted = (list) => [...list].sort();

async function twoPeople() {
  const api = await freshDb({ seed: false });
  const anna = await api.signUp({ handle: 'anna' });
  const ben = await api.signUp({ handle: 'ben', homeCity: 'Mississauga' });
  await api.notices();
  return { api, anna, ben };
}

describe('change notices', () => {
  test('a song sent, accepted and talked about reaches both people and nobody else', async () => {
    const { api, anna, ben } = await twoPeople();
    const both = sorted([`person:${anna} inbox`, `person:${ben} inbox`]);

    await api.as(anna);
    const sent = await api.rpc('send_song', { p_to: ben, p_track: track('t1'), p_note: 'this one' });
    assert.deepEqual(sorted(await api.notices()), both);

    await api.as(ben);
    await api.rpc('answer_song', { p_request: sent.id, p_accept: true });
    assert.deepEqual(sorted(await api.notices()), both);

    await api.rpc('send_message', { p_chat: sent.id, p_body: 'ok this is very good' });
    assert.deepEqual(sorted(await api.notices()), both);
  });

  test('declining tells the sender nothing at all', async () => {
    const { api, anna, ben } = await twoPeople();
    await api.as(anna);
    const sent = await api.rpc('send_song', { p_to: ben, p_track: track('t1'), p_note: null });
    await api.notices();

    await api.as(ben);
    await api.rpc('answer_song', { p_request: sent.id, p_accept: false });
    assert.deepEqual(await api.notices(), [`person:${ben} inbox`]);
  });

  test('what you play is announced to your area only while you are on air', async () => {
    const { api, anna } = await twoPeople();
    await api.as(anna);
    await api.rpc('set_area', QW);
    await api.rpc('set_now_playing', { p_track: track('t1'), p_note: null });
    assert.deepEqual(await api.notices(), [], 'off air: silent');

    await api.rpc('set_sharing', { p_on: true });
    assert.deepEqual(await api.notices(), ['area:to-queen-west nearby']);

    await api.rpc('set_now_playing', { p_track: track('t2'), p_note: null });
    assert.deepEqual(await api.notices(), ['area:to-queen-west nearby'], 'once per change, not once per row');

    await api.rpc('set_area', { p_area: 'to-annex', p_source: 'picked' });
    assert.deepEqual(sorted(await api.notices()), ['area:to-annex nearby', 'area:to-queen-west nearby']);

    await api.rpc('set_sharing', { p_on: false });
    // every street that still showed a card of yours is told, so the cards go
    assert.deepEqual(sorted(await api.notices()), ['area:to-annex nearby', 'area:to-queen-west nearby']);
  });

  test('city posts, threads and replies are announced to their city', async () => {
    const { api, anna, ben } = await twoPeople();
    await api.as(anna);
    const post = await api.rpc('post_to_city', { p_track: track('t1'), p_note: 'for the streetcar' });
    assert.deepEqual(await api.notices(), ['city:toronto city']);
    await api.rpc('remove_post', { p_post: post });
    assert.deepEqual(await api.notices(), ['city:toronto city']);

    const thread = await api.rpc('start_thread', { p_artist: 'Joni Mitchell', p_title: 'Best live recording?', p_body: '' });
    assert.deepEqual(await api.notices(), ['city:toronto artist']);
    await api.as(ben);
    await api.rpc('reply_to_thread', { p_thread: thread, p_body: 'Miles of Aisles', p_track: null });
    assert.deepEqual(await api.notices(), ['city:toronto artist'], 'a reply is news where the thread lives');
  });

  test('a notice carries the kind of change and nothing else', async () => {
    const { api, anna, ben } = await twoPeople();
    await api.as(anna);
    await api.rpc('send_song', { p_to: ben, p_track: track('t1'), p_note: 'a private note' });
    const rows = (await api.db.query('select event, payload, private from realtime.sent')).rows;
    assert.ok(rows.length > 0);
    for (const r of rows) assert.deepEqual([r.event, r.payload, r.private], ['changed', { what: 'inbox' }, true]);
  });

  test('you may listen to your own channel, your own area and a city, and nothing else', async () => {
    const { api, anna, ben } = await twoPeople();
    await api.as(anna);
    await api.rpc('set_area', QW);
    const may = (topic) => api.rpc('may_listen', { p_topic: topic });
    assert.equal(await may(`person:${anna}`), true);
    assert.equal(await may(`person:${ben}`), false);
    assert.equal(await may('area:to-queen-west'), true);
    assert.equal(await may('area:to-annex'), false);
    assert.equal(await may('city:toronto'), true);
    assert.equal(await may('anything-else'), false);

    await api.as(null);
    assert.equal(await may(`person:${anna}`), false);
    assert.equal(await may('city:toronto'), false);

    // and Realtime is told to ask that question of signed-in people only
    const policies = (await api.db.query("select roles::text as roles, cmd, qual from pg_policies where schemaname = 'realtime' and tablename = 'messages'")).rows;
    assert.equal(policies.length, 1);
    assert.equal(policies[0].roles, '{authenticated}');
    assert.equal(policies[0].cmd, 'SELECT');
    assert.ok(policies[0].qual.includes('may_listen'));
    assert.equal((await api.db.query("select has_function_privilege('anon', 'public.may_listen(text)', 'execute') as ok")).rows[0].ok, false);
  });

  test('a notice that cannot be sent never undoes the change behind it', async () => {
    const { api, anna, ben } = await twoPeople();
    await api.db.exec('drop table realtime.sent');
    await api.as(anna);
    const sent = await api.rpc('send_song', { p_to: ben, p_track: track('t1'), p_note: null });
    await api.as(ben);
    assert.equal((await api.rpc('get_inbox')).waiting[0].id, sent.id);
  });
});
