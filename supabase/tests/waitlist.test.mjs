// The waitlist on earshot.lol: anyone can join without an account, the list can't be read back from outside,
// and a bot can't fill it.
//
//   npm run test:server
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, MIN } from './harness.mjs';

const rows = async (api) => (await api.db.query('select email, phone, area from app.waitlist order by email')).rows;

describe('joining the waitlist', () => {
  test('works without an account, and joining twice changes nothing', async () => {
    const api = await freshDb({ seed: false });
    await api.as(null);
    await api.rpc('join_waitlist', { p_email: '  Maya@Example.com ', p_phone: 'iphone', p_area: 'Little Portugal' });
    await api.rpc('join_waitlist', { p_email: 'maya@example.com', p_phone: 'android', p_area: '' }); // no error, no change
    await api.rpc('join_waitlist', { p_email: 'adam@example.com', p_phone: 'android', p_area: '  ' });
    assert.deepEqual(await rows(api), [
      { email: 'adam@example.com', phone: 'android', area: null },
      { email: 'maya@example.com', phone: 'iphone', area: 'Little Portugal' },
    ]);
  });

  test('refuses what isn’t an email, a phone it doesn’t know, or an essay for a neighbourhood', async () => {
    const api = await freshDb({ seed: false });
    for (const p_email of ['', 'maya', 'maya@', '@example.com', 'maya@example', 'ma ya@example.com', `${'a'.repeat(250)}@example.com`]) {
      assert.equal(await api.fails('join_waitlist', { p_email, p_phone: 'iphone' }), 'bad-email', p_email);
    }
    assert.equal(await api.fails('join_waitlist', { p_email: 'maya@example.com', p_phone: 'blackberry' }), 'bad-phone');
    assert.equal(await api.fails('join_waitlist', { p_email: 'maya@example.com', p_phone: 'iphone', p_area: 'x'.repeat(61) }), 'bad-area');
    assert.deepEqual(await rows(api), []);
  });

  test('a bot filling it in a hurry is slowed down; real people a minute later get in', async () => {
    const api = await freshDb({ seed: false });
    for (let i = 0; i < 120; i++) await api.rpc('join_waitlist', { p_email: `bot${i}@example.com`, p_phone: 'iphone' });
    assert.equal(await api.fails('join_waitlist', { p_email: 'one-more@example.com', p_phone: 'iphone' }), 'busy');
    await api.clock.advance(MIN + 1);
    assert.equal(await api.fails('join_waitlist', { p_email: 'one-more@example.com', p_phone: 'iphone' }), null);
  });

  test('the list itself is out of reach from outside', async () => {
    const api = await freshDb({ seed: false });
    const res = await api.db.query("select has_table_privilege('anon', 'app.waitlist', 'select') as a, has_schema_privilege('anon', 'app', 'usage') as b");
    assert.deepEqual(res.rows[0], { a: false, b: false });
  });
});
