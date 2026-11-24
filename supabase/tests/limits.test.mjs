// Daily limits, one notification per burst of messages, and the checks on
// profile details that arrive straight from a sign-up.
//
//   npm run test:server
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, MIN, track } from './harness.mjs';

const DAY = 24 * 60 * MIN;
const PG_NET = `
  create schema if not exists net;
  create table net.sent (url text, body jsonb);
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds integer default 5000)
    returns bigint language plpgsql as $$ begin insert into net.sent values (url, body); return 1; end $$;
`;

/** Call fn n times; return how many went through before the first refusal, and the refusal. */
async function until(api, n, fn, args) {
  for (let i = 0; i < n; i++) {
    const err = await api.fails(fn, typeof args === 'function' ? args(i) : args);
    if (err) return [i, err];
  }
  return [n, null];
}

/** Two people with an open chat. */
async function talking(api) {
  const anna = await api.signUp({ handle: 'anna' });
  const ben = await api.signUp({ handle: 'ben' });
  const sent = await api.rpc('send_song', { p_to: anna, p_track: track('t1'), p_note: null });
  await api.as(anna);
  await api.rpc('answer_song', { p_request: sent.id, p_accept: true });
  return { anna, ben, chat: sent.id };
}

describe('daily limits', () => {
  test('city posts: ten a day, then a new day', async () => {
    const api = await freshDb({ seed: false });
    await api.signUp({ handle: 'poster' });
    assert.deepEqual(await until(api, 11, 'post_to_city', (i) => ({ p_track: track(`p${i}`), p_note: 'listen' })), [10, 'too-many']);
    await api.clock.advance(DAY + MIN);
    assert.equal(await api.fails('post_to_city', { p_track: track('next'), p_note: 'listen' }), null);
  });

  test('threads: five a day; replies: sixty a day', async () => {
    const api = await freshDb({ seed: false });
    await api.signUp({ handle: 'talker' });
    assert.deepEqual(await until(api, 6, 'start_thread', (i) => ({ p_artist: 'Joni Mitchell', p_title: `Thread ${i}`, p_body: '' })), [5, 'too-many']);
    const thread = (await api.db.query('select id::text as id from app.threads limit 1')).rows[0].id;
    assert.deepEqual(await until(api, 61, 'reply_to_thread', (i) => ({ p_thread: thread, p_body: `reply ${i}`, p_track: null })), [60, 'too-many']);
  });

  test('songs to new people: thirty a day', async () => {
    const api = await freshDb({ seed: false });
    const people = [];
    for (let i = 0; i < 31; i++) people.push(await api.signUp({ handle: `listener${i}` }));
    await api.signUp({ handle: 'sender' });
    assert.deepEqual(await until(api, 31, 'send_song', (i) => ({ p_to: people[i], p_track: track(`s${i}`), p_note: null })), [30, 'too-many']);
  });

  test('chat messages: no limit a person would hit, only a bot (thirty a minute, three thousand a day)', async () => {
    const api = await freshDb({ seed: false });
    const { anna, chat } = await talking(api);
    assert.deepEqual(await until(api, 31, 'send_message', (i) => ({ p_chat: chat, p_body: `m${i}` })), [30, 'too-many']);
    await api.clock.advance(MIN + 1000);
    assert.equal(await api.fails('send_message', { p_chat: chat, p_body: 'a minute later' }), null);

    // a day's worth, stood in for directly rather than sent one by one
    await api.db.query(
      `insert into app.messages (request_id, from_id, body, created_at)
       select $1::bigint, $2, 'x', $3::bigint - g * 1000 from generate_series(120, 3120) g`,
      [chat, anna, api.clock.now],
    );
    assert.equal(await api.fails('send_message', { p_chat: chat, p_body: 'one more' }), 'too-many');
  });
});

describe('a burst of messages buzzes the other phone once', () => {
  test('rapid-fire messages buzz once; a normal back-and-forth buzzes every time', async () => {
    const api = await freshDb({ seed: false });
    await api.db.exec(PG_NET);
    const { ben, chat } = await talking(api);
    await api.as(ben);
    await api.rpc('register_push_token', { p_token: 'ExponentPushToken[ben]' });
    await api.db.exec('delete from net.sent');
    const pushes = async () => (await api.db.query("select count(*)::int as n from net.sent where body::text like '%/chat/%'")).rows[0].n;

    await api.as((await api.db.query("select id from app.profiles where handle = 'anna'")).rows[0].id);
    for (let i = 0; i < 6; i++) {
      await api.rpc('send_message', { p_chat: chat, p_body: `spam ${i}` });
      await api.clock.advance(2_000);
    }
    assert.equal(await pushes(), 1, 'six messages two seconds apart: one buzz');
    await api.clock.advance(15_000);
    for (let i = 0; i < 3; i++) {
      await api.rpc('send_message', { p_chat: chat, p_body: `hello ${i}` });
      await api.clock.advance(20_000);
    }
    assert.equal(await pushes(), 4, 'three messages twenty seconds apart: three more buzzes');
  });
});

describe('profile details from a sign-up get the same checks as editing', () => {
  test('a made-up city or a junk colour falls back to the defaults', async () => {
    const api = await freshDb({ seed: false });
    await api.db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
      '00000000-0000-4000-8000-0000000000cc',
      'odd@example.com',
      { handle: 'odd.one', name: 'Odd One', badge: 'OO', badge_color: 'red; ' + 'x'.repeat(5000), home_city: 'Atlantis' },
    ]);
    const row = (await api.db.query("select badge_color, home_city from app.profiles where handle = 'odd.one'")).rows[0];
    assert.deepEqual(row, { badge_color: '#F7A6BF', home_city: 'Toronto' });
  });

  test('a good colour is kept, and a bad one in an edit leaves the old one alone', async () => {
    const api = await freshDb({ seed: false });
    await api.signUp({ handle: 'tidy' }); // signs up with #ffffff
    await api.rpc('update_profile', { p_name: 'Tidy', p_tagline: '', p_bio: '', p_badge: 'TI', p_badge_color: '#7FCFA9' });
    await api.rpc('update_profile', { p_name: 'Tidy', p_tagline: '', p_bio: '', p_badge: 'TI', p_badge_color: 'not-a-colour' });
    assert.equal((await api.db.query("select badge_color from app.profiles where handle = 'tidy'")).rows[0].badge_color, '#7FCFA9');
  });
});
