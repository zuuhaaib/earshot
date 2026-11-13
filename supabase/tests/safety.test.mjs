// Safety: blocking, reporting and deleting your account.
//
//   npm run test:server
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, track } from './harness.mjs';

const QW = { p_area: 'to-queen-west', p_source: 'picked' };

/** Anna and Ben, both on air on the same street with a song on. */
async function neighbours() {
  const api = await freshDb({ seed: false });
  const anna = await api.signUp({ handle: 'anna' });
  await api.rpc('set_area', QW);
  await api.rpc('set_sharing', { p_on: true });
  await api.rpc('set_now_playing', { p_track: track('a1'), p_note: null });
  const ben = await api.signUp({ handle: 'ben' });
  await api.rpc('set_area', QW);
  await api.rpc('set_sharing', { p_on: true });
  await api.rpc('set_now_playing', { p_track: track('b1'), p_note: null });
  return { api, anna, ben };
}

/** ...who have also accepted a song and started talking. */
async function talking() {
  const n = await neighbours();
  await n.api.as(n.anna);
  const sent = await n.api.rpc('send_song', { p_to: n.ben, p_track: track('s1'), p_note: 'hello' });
  await n.api.as(n.ben);
  await n.api.rpc('answer_song', { p_request: sent.id, p_accept: true });
  await n.api.rpc('send_message', { p_chat: sent.id, p_body: 'thanks' });
  return { ...n, chat: sent.id };
}

describe('blocking', () => {
  test('hides two people from each other nearby, in rooms and by lookup', async () => {
    const { api, anna, ben } = await neighbours();
    await api.as(anna);
    assert.equal((await api.rpc('get_nearby')).length, 1);
    await api.rpc('block_person', { p_person: ben });

    assert.deepEqual(await api.rpc('get_nearby'), []);
    assert.equal(await api.rpc('get_room', { p_person: ben }), null);
    assert.equal(await api.rpc('get_person', { p_id: ben }), null);
    assert.deepEqual((await api.rpc('get_blocked')).map((p) => p.handle), ['ben']);

    await api.as(ben);
    assert.deepEqual(await api.rpc('get_nearby'), []);
    assert.equal(await api.rpc('get_room', { p_person: anna }), null);
    assert.equal(await api.rpc('get_person', { p_id: anna }), null);
    assert.deepEqual(await api.rpc('get_blocked'), [], 'being blocked is not something you can look up');
  });

  test('stops songs both ways, and looks the same as someone who is not there', async () => {
    const { api, anna, ben } = await neighbours();
    await api.as(anna);
    await api.rpc('block_person', { p_person: ben });
    const gone = await api.fails('send_song', { p_to: 'nobody-at-all', p_track: track('s1'), p_note: null });
    assert.equal(await api.fails('send_song', { p_to: ben, p_track: track('s1'), p_note: null }), gone);
    await api.as(ben);
    assert.equal(await api.fails('send_song', { p_to: anna, p_track: track('s1'), p_note: null }), gone);
    assert.equal(await api.fails('sign_guestbook', { p_person: anna, p_track: track('s1'), p_why: 'hi' }), 'no-such-room');
  });

  test('takes their songs and chat out of your inbox, and leaves theirs looking untouched', async () => {
    const { api, anna, ben, chat } = await talking();
    await api.as(anna);
    assert.equal((await api.rpc('get_inbox')).chats.length, 1);
    await api.rpc('block_person', { p_person: ben });
    assert.deepEqual((await api.rpc('get_inbox')).chats, []);
    assert.equal(await api.rpc('get_inbox_count'), 0);
    assert.equal(await api.rpc('get_chat', { p_chat: chat }), null);
    assert.equal(await api.fails('send_message', { p_chat: chat, p_body: 'one more thing' }), 'not-your-chat');

    // Ben still has the conversation and can type into it. Anna never sees it.
    await api.as(ben);
    assert.equal((await api.rpc('get_inbox')).chats.length, 1);
    assert.equal(await api.fails('send_message', { p_chat: chat, p_body: 'hello?' }), null);
    await api.as(anna);
    assert.equal(await api.rpc('get_inbox_count'), 0);
  });

  test('a waiting song from someone you block disappears from your inbox', async () => {
    const { api, anna, ben } = await neighbours();
    await api.as(ben);
    await api.rpc('send_song', { p_to: anna, p_track: track('s1'), p_note: 'hey' });
    await api.as(anna);
    assert.equal(await api.rpc('get_inbox_count'), 1);
    await api.rpc('block_person', { p_person: ben });
    assert.equal(await api.rpc('get_inbox_count'), 0);
    assert.deepEqual((await api.rpc('get_inbox')).waiting, []);
    await api.as(ben);
    assert.equal((await api.rpc('get_inbox')).sent.length, 1, 'his side still just says sent');
  });

  test('hides city posts, threads and replies, and tears out guestbook signatures', async () => {
    const { api, anna, ben } = await neighbours();
    await api.as(ben);
    await api.rpc('post_to_city', { p_track: track('b2'), p_note: 'ben says listen' });
    const bens = await api.rpc('start_thread', { p_artist: 'Joni Mitchell', p_title: 'Ben’s thread', p_body: '' });
    await api.rpc('sign_guestbook', { p_person: anna, p_track: track('b3'), p_why: 'nice room' });
    await api.as(anna);
    const annas = await api.rpc('start_thread', { p_artist: 'Joni Mitchell', p_title: 'Anna’s thread', p_body: '' });
    await api.as(ben);
    await api.rpc('reply_to_thread', { p_thread: annas, p_body: 'ben was here', p_track: null });

    await api.as(anna);
    const entries = async () => (await api.rpc('get_room', { p_person: anna })).room.sections.find((s) => s.kind === 'guestbook').entries;
    assert.equal((await entries()).length, 1);
    await api.rpc('block_person', { p_person: ben });

    assert.deepEqual((await api.rpc('get_city_feed', { p_scope: 'Toronto' })).posts, []);
    const space = await api.rpc('get_artist_space', { p_artist: 'Joni Mitchell', p_scope: 'Toronto' });
    assert.deepEqual(space.threads.map((t) => [t.title, t.replies, t.last]), [['Anna’s thread', 0, null]]);
    assert.equal(await api.rpc('get_thread', { p_thread: bens }), null);
    assert.deepEqual((await api.rpc('get_thread', { p_thread: annas })).replies, []);
    assert.deepEqual(await entries(), []);
  });

  test('can be undone, and you cannot block yourself or nobody', async () => {
    const { api, anna, ben } = await talking();
    await api.as(anna);
    assert.equal(await api.fails('block_person', { p_person: anna }), 'self');
    assert.equal(await api.fails('block_person', { p_person: 'nobody-at-all' }), 'unknown-person');
    await api.rpc('block_person', { p_person: ben });
    await api.rpc('block_person', { p_person: ben }); // twice is fine
    await api.rpc('unblock_person', { p_person: ben });
    assert.deepEqual(await api.rpc('get_blocked'), []);
    assert.equal((await api.rpc('get_nearby')).length, 1);
    assert.equal((await api.rpc('get_inbox')).chats.length, 1);
  });

  test('tells the blocked person nothing', async () => {
    const { api, anna, ben } = await talking();
    await api.notices();
    await api.as(anna);
    await api.rpc('block_person', { p_person: ben });
    assert.ok(!(await api.notices()).some((n) => n.startsWith(`person:${ben}`)));
  });
});

describe('reporting', () => {
  test('keeps a copy taken from the database, including a chat you are in', async () => {
    const { api, anna, ben, chat } = await talking();
    await api.as(anna);
    await api.rpc('report_person', { p_person: ben, p_reason: 'harassment', p_note: ' would not stop ', p_context: { kind: 'chat', id: chat, messages: ['made up'] } });
    const r = (await api.db.query('select * from app.reports')).rows[0];
    assert.deepEqual([r.reporter_id, r.about_id, r.about_handle, r.reason, r.note], [anna, ben, 'ben', 'harassment', 'would not stop']);
    assert.deepEqual(r.context.messages.map((m) => m.body), ['thanks']);
    assert.equal(r.context.opener, 'hello');
  });

  test('will not copy a chat you are not part of', async () => {
    const { api, ben, chat } = await talking();
    const carl = await api.signUp({ handle: 'carl' });
    await api.rpc('report_person', { p_person: ben, p_reason: 'spam', p_note: '', p_context: { kind: 'chat', id: chat } });
    const r = (await api.db.query('select * from app.reports')).rows[0];
    assert.equal(r.reporter_id, carl);
    assert.equal(r.context.messages, undefined);
  });

  test('needs a real reason and a real person, and has a daily limit', async () => {
    const { api, anna, ben } = await neighbours();
    await api.as(anna);
    assert.equal(await api.fails('report_person', { p_person: ben, p_reason: 'because', p_note: '', p_context: null }), 'bad-reason');
    assert.equal(await api.fails('report_person', { p_person: anna, p_reason: 'spam', p_note: '', p_context: null }), 'self');
    assert.equal(await api.fails('report_person', { p_person: 'nobody-at-all', p_reason: 'spam', p_note: '', p_context: null }), 'unknown-person');
    for (let i = 0; i < 20; i++) await api.rpc('report_person', { p_person: ben, p_reason: 'spam', p_note: '', p_context: null });
    assert.equal(await api.fails('report_person', { p_person: ben, p_reason: 'spam', p_note: '', p_context: null }), 'too-many-reports');
    await api.clock.advance(25 * 60 * 60_000);
    assert.equal(await api.fails('report_person', { p_person: ben, p_reason: 'spam', p_note: '', p_context: null }), null);
  });

  test('cannot be read by anyone through the app', async () => {
    const { api } = await neighbours();
    const q = async (sql) => (await api.db.query(sql)).rows[0].ok;
    assert.equal(await q("select has_table_privilege('authenticated', 'app.reports', 'select') as ok"), false);
    assert.equal(await q("select has_table_privilege('authenticated', 'app.blocks', 'select') as ok"), false);
    assert.equal(await q("select relrowsecurity as ok from pg_class where oid = 'app.reports'::regclass"), true);
  });
});

describe('deleting your account', () => {
  test('removes everything of yours, the login too, and leaves other people intact', async () => {
    const { api, anna, ben, chat } = await talking();
    await api.as(anna);
    await api.rpc('post_to_city', { p_track: track('a2'), p_note: 'anna says listen' });
    await api.rpc('toggle_save', { p_track: track('a3') });
    await api.rpc('sign_guestbook', { p_person: ben, p_track: track('a4'), p_why: 'nice room' });
    await api.rpc('report_person', { p_person: ben, p_reason: 'other', p_note: 'kept for the record', p_context: null });
    const thread = await api.rpc('start_thread', { p_artist: 'Joni Mitchell', p_title: 'Anna’s thread', p_body: '' });

    await api.rpc('delete_account');

    const count = async (sql) => (await api.db.query(`select count(*)::int as n from ${sql}`)).rows[0].n;
    assert.equal(await count(`app.profiles where id = '${anna}'`), 0);
    assert.equal(await count(`auth.users where id = '${anna}'`), 0);
    for (const t of ['plays', 'saves', 'posts', 'threads', 'rooms']) assert.equal(await count(`app.${t} where user_id = '${anna}'`), 0, t);
    assert.equal(await count('app.requests'), 0);
    assert.equal(await count('app.messages'), 0);
    assert.equal(await count('app.reports'), 1, 'a report outlives the account that made it');

    assert.equal((await api.rpc('get_session')).me, null);
    assert.equal(await api.fails('get_crate'), null);

    await api.as(ben);
    assert.deepEqual(await api.rpc('get_nearby'), []);
    assert.deepEqual((await api.rpc('get_inbox')).chats, []);
    assert.equal(await api.rpc('get_chat', { p_chat: chat }), null);
    assert.equal(await api.rpc('get_thread', { p_thread: thread }), null);
    const room = await api.rpc('get_room', { p_person: ben });
    assert.deepEqual(room.room.sections.find((s) => s.kind === 'guestbook').entries, []);
    assert.equal((await api.rpc('get_session')).me.handle, 'ben');
  });

  test('is not something a resident or a logged-out caller can do', async () => {
    const api = await freshDb();
    await api.as('maren');
    assert.equal(await api.fails('delete_account'), 'resident');
    await api.as(null);
    assert.equal(await api.fails('delete_account'), 'not-signed-in');
    assert.equal((await api.db.query("select has_function_privilege('anon', 'public.delete_account()', 'execute') as ok")).rows[0].ok, false);
  });
});
