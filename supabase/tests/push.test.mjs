// Push notifications: who is told what, and who is never told anything.
//
//   npm run test:server
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, MIN, track } from './harness.mjs';

// pg_net, stood in for: outgoing requests are written down instead of sent.
const PG_NET = `
  create schema if not exists net;
  create table net.sent (url text, body jsonb);
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds integer default 5000)
    returns bigint language plpgsql as $$ begin insert into net.sent values (url, body); return 1; end $$;
`;
const TOKEN_A = 'ExponentPushToken[anna-phone]';
const TOKEN_B = 'ExponentPushToken[ben-phone]';

async function twoPhones() {
  const api = await freshDb({ seed: false });
  await api.db.exec(PG_NET);
  const anna = await api.signUp({ handle: 'anna', name: 'Anna Lee' });
  await api.rpc('register_push_token', { p_token: TOKEN_A });
  const ben = await api.signUp({ handle: 'ben', name: 'Ben Ito' });
  await api.rpc('register_push_token', { p_token: TOKEN_B });
  return { api, anna, ben };
}
/** Notifications sent since last asked, as [token, title, body, url]. */
async function pushes(api) {
  const rows = (await api.db.query("select body from net.sent where url = 'https://exp.host/--/api/v2/push/send'")).rows;
  await api.db.exec('delete from net.sent');
  return rows.flatMap((r) => r.body.map((m) => [m.to, m.title, m.body, m.data.url]));
}

describe('push notifications', () => {
  test('a song, a yes and a message each reach the right phone', async () => {
    const { api, anna, ben } = await twoPhones();
    await api.as(anna);
    const sent = await api.rpc('send_song', { p_to: ben, p_track: track('t1', 'Big Thief', 'Not'), p_note: 'this one' });
    assert.deepEqual(await pushes(api), [[TOKEN_B, 'Anna Lee sent you a song', 'Not. Yes, or let it pass.', '/inbox']]);

    await api.as(ben);
    await api.rpc('answer_song', { p_request: sent.id, p_accept: true });
    assert.deepEqual(await pushes(api), [[TOKEN_A, 'Ben Ito said yes', 'To Not. Your chat is open.', `/chat/${sent.id}`]]);

    await api.rpc('send_message', { p_chat: sent.id, p_body: 'see you at the show' });
    assert.deepEqual(await pushes(api), [[TOKEN_A, 'Ben Ito', 'see you at the show', `/chat/${sent.id}`]]);

    await api.clock.advance(MIN);
    await api.rpc('send_message', { p_chat: sent.id, p_body: 'x'.repeat(300) });
    assert.equal((await pushes(api))[0][2], `${'x'.repeat(179)}…`, 'a long message is cut short');
  });

  test('a no is never announced', async () => {
    const { api, anna, ben } = await twoPhones();
    await api.as(anna);
    const sent = await api.rpc('send_song', { p_to: ben, p_track: track('t1'), p_note: null });
    await pushes(api);
    await api.as(ben);
    await api.rpc('answer_song', { p_request: sent.id, p_accept: false });
    assert.deepEqual(await pushes(api), []);
  });

  test('someone you blocked can still type, but you are never notified', async () => {
    const { api, anna, ben } = await twoPhones();
    await api.as(anna);
    const sent = await api.rpc('send_song', { p_to: ben, p_track: track('t1'), p_note: null });
    await api.as(ben);
    await api.rpc('answer_song', { p_request: sent.id, p_accept: true });
    await api.as(anna);
    await api.rpc('block_person', { p_person: ben });
    await pushes(api);
    await api.as(ben);
    await api.rpc('send_message', { p_chat: sent.id, p_body: 'hello?' });
    assert.deepEqual(await pushes(api), []);
  });

  test('a phone goes with whoever is logged in on it, and logging out stops it', async () => {
    const { api, anna, ben } = await twoPhones();
    // Ben logs in on Anna's phone: that phone is now his
    await api.as(ben);
    await api.rpc('register_push_token', { p_token: TOKEN_A });
    await api.as(anna);
    await api.rpc('send_song', { p_to: ben, p_track: track('t1'), p_note: null });
    assert.deepEqual((await pushes(api)).map((p) => p[0]).sort(), [TOKEN_A, TOKEN_B]);

    await api.as(ben);
    await api.rpc('forget_push_token', { p_token: TOKEN_A });
    await api.rpc('forget_push_token', { p_token: 'ExponentPushToken[someone-else]' }); // not his: nothing happens
    await api.as(anna);
    await api.rpc('send_message', { p_chat: 'x', p_body: 'x' }).catch(() => {});
    const remaining = (await api.db.query('select token from app.push_tokens order by token')).rows.map((r) => r.token);
    assert.deepEqual(remaining, [TOKEN_B]);
  });

  test('only real tokens, only from signed-in people, and deleting the account removes them', async () => {
    const { api, anna } = await twoPhones();
    await api.as(anna);
    assert.equal(await api.fails('register_push_token', { p_token: 'https://evil.example' }), 'bad-token');
    await api.as(null);
    assert.equal(await api.fails('register_push_token', { p_token: TOKEN_A }), 'not-signed-in');
    await api.as(anna);
    await api.rpc('delete_account');
    assert.equal((await api.db.query('select count(*)::int as n from app.push_tokens')).rows[0].n, 1);
  });

  test('a broken push service never stops a song being sent', async () => {
    const api = await freshDb({ seed: false }); // no pg_net here at all
    const anna = await api.signUp({ handle: 'anna' });
    const ben = await api.signUp({ handle: 'ben' });
    await api.rpc('register_push_token', { p_token: TOKEN_B });
    await api.as(anna);
    assert.equal(await api.fails('send_song', { p_to: ben, p_track: track('t1'), p_note: null }), null);
  });
});
