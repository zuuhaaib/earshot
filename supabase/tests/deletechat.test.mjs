// Deleting a chat: one-sided, silent, and not a block.
//
//   npm run test:server
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, track } from './harness.mjs';

/** Anna and Ben, with an accepted song and two messages between them. */
async function talking() {
  const api = await freshDb({ seed: false });
  const anna = await api.signUp({ handle: 'anna' });
  const ben = await api.signUp({ handle: 'ben' });
  await api.as(anna);
  const sent = await api.rpc('send_song', { p_to: ben, p_track: track('s1'), p_note: 'hello' });
  await api.as(ben);
  await api.rpc('answer_song', { p_request: sent.id, p_accept: true });
  await api.rpc('send_message', { p_chat: sent.id, p_body: 'thanks' });
  await api.clock.advance(1000);
  await api.as(anna);
  await api.rpc('send_message', { p_chat: sent.id, p_body: 'any time' });
  await api.clock.advance(1000);
  return { api, anna, ben, chat: sent.id };
}
const bodies = async (api, chat) => (await api.rpc('get_chat', { p_chat: chat })).messages.map((m) => m.body);
const stored = async (api) => (await api.db.query('select count(*)::int as n from app.messages')).rows[0].n;

describe('deleting a chat', () => {
  test('empties it for you and takes it out of your inbox, and leaves theirs alone', async () => {
    const { api, anna, ben, chat } = await talking();
    await api.as(anna);
    await api.rpc('delete_chat', { p_chat: chat });
    assert.deepEqual((await api.rpc('get_inbox')).chats, []);
    assert.equal(await api.rpc('get_inbox_count'), 0);
    assert.deepEqual(await bodies(api, chat), []);

    await api.as(ben);
    assert.equal((await api.rpc('get_inbox')).chats.length, 1);
    assert.deepEqual(await bodies(api, chat), ['thanks', 'any time']);
    assert.equal(await stored(api), 2, 'nothing of his was removed');
  });

  test('is not a block: you still see each other, and a new message brings the chat back with only what is new', async () => {
    const { api, anna, ben, chat } = await talking();
    await api.as(anna);
    await api.rpc('delete_chat', { p_chat: chat });
    assert.equal((await api.rpc('get_link', { p_person: ben })).kind, 'chat');
    assert.notEqual(await api.rpc('get_person', { p_id: ben }), null);
    assert.deepEqual(await api.rpc('get_blocked'), []);

    await api.clock.advance(1000);
    await api.as(ben);
    await api.rpc('send_message', { p_chat: chat, p_body: 'still there?' });
    await api.as(anna);
    const inbox = await api.rpc('get_inbox');
    assert.deepEqual(inbox.chats.map((c) => [c.last.text, c.unread]), [['still there?', 1]]);
    assert.deepEqual(await bodies(api, chat), ['still there?']);
    assert.deepEqual(await (async () => { await api.as(ben); return bodies(api, chat); })(), ['thanks', 'any time', 'still there?']);
  });

  test('lets you start again yourself, with a message or a song', async () => {
    const { api, anna, ben, chat } = await talking();
    await api.as(anna);
    await api.rpc('delete_chat', { p_chat: chat });
    await api.clock.advance(1000);
    const again = await api.rpc('send_song', { p_to: ben, p_track: track('s2'), p_note: 'one more' });
    assert.deepEqual(again, { kind: 'chat', id: chat });
    assert.equal((await api.rpc('get_inbox')).chats.length, 1);
    assert.deepEqual(await bodies(api, chat), ['one more']);
  });

  test('tells the other person nothing', async () => {
    const { api, anna, ben, chat } = await talking();
    await api.notices();
    await api.as(anna);
    await api.rpc('delete_chat', { p_chat: chat });
    assert.ok(!(await api.notices()).some((n) => n.startsWith(`person:${ben}`)));
  });

  test('removes the old messages for good once both people have deleted it', async () => {
    const { api, anna, ben, chat } = await talking();
    await api.as(anna);
    await api.rpc('delete_chat', { p_chat: chat });
    await api.clock.advance(1000);
    await api.as(ben);
    await api.rpc('send_message', { p_chat: chat, p_body: 'after anna deleted' });
    await api.clock.advance(1000);
    assert.equal(await stored(api), 3);
    await api.rpc('delete_chat', { p_chat: chat });
    // Ben can see nothing; Anna can still see the one sent after her delete, so only that survives
    assert.equal(await stored(api), 1);
    await api.as(anna);
    assert.deepEqual(await bodies(api, chat), ['after anna deleted']);
  });

  test('only works on a chat you are in', async () => {
    const { api, chat } = await talking();
    await api.signUp({ handle: 'carl' });
    assert.equal(await api.fails('delete_chat', { p_chat: chat }), 'not-your-chat');
    assert.equal(await api.fails('delete_chat', { p_chat: 'nonsense' }), 'not-your-chat');
    await api.as(null);
    assert.equal(await api.fails('delete_chat', { p_chat: chat }), 'not-signed-in');
  });
});
