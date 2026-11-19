// A real Postgres, in this process, with earshot's schema loaded: the same SQL
// you run in Supabase. Supabase's own parts (the auth schema, the roles) are
// stood in for here, and two private helpers are swapped so tests can choose
// who is calling and what time it is.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
export const START = Date.UTC(2026, 10, 12, 17, 0, 0);
export const MIN = 60_000;

const SUPABASE_STANDINS = `
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('test.uid', true), '')::uuid
  $$;
  -- Realtime: notices are written down here instead of being sent anywhere.
  create schema realtime;
  create table realtime.messages (topic text, extension text);
  alter table realtime.messages enable row level security;
  create table realtime.sent (n serial primary key, topic text, event text, payload jsonb, private boolean);
  create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language plpgsql as $$
  begin insert into realtime.sent (payload, event, topic, private) values ($1, $2, $3, $4); end $$;
  create function realtime.topic() returns text language sql stable as $$
    select nullif(current_setting('test.topic', true), '')
  $$;
`;

const TEST_OVERRIDES = `
  -- tests choose the caller by profile id (so they can act as residents too) and control the clock
  create or replace function app.me() returns text language sql stable as $$
    select nullif(current_setting('test.me', true), '')
  $$;
  create or replace function app.now_ms() returns bigint language sql volatile as $$
    select current_setting('test.now')::bigint
  $$;
`;

export async function freshDb({ seed = true, schema = 'schema.sql' } = {}) {
  const db = new PGlite();
  await db.exec(SUPABASE_STANDINS);
  await db.exec(readFileSync(join(here, '..', schema), 'utf8'));
  // (the old accounts-only script has no private schema to override)
  if (schema === 'schema.sql') await db.exec(TEST_OVERRIDES);
  const clock = {
    now: START,
    async set(ms) {
      this.now = ms;
      await db.exec(`select set_config('test.now', '${ms}', false)`);
    },
    advance(ms) {
      return this.set(this.now + ms);
    },
  };
  await clock.set(START);
  if (seed) await db.exec(readFileSync(join(here, '..', 'seed.sql'), 'utf8'));

  let n = 0;
  const api = {
    db,
    clock,
    /** Act as this profile id from now on (null: nobody). */
    async as(id) {
      await db.exec(`select set_config('test.me', '${id ?? ''}', false)`);
    },
    /** Make a real (non-resident) account, the way the sign-up trigger would, and act as it. */
    async signUp({ handle = `tester${++n}`, name = 'Test Person', homeCity = 'Toronto', onboard = true } = {}) {
      const uid = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
      await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
        uid,
        `${handle}@example.com`,
        onboard ? { handle, name, badge: 'TP', badge_color: '#ffffff', home_city: homeCity } : { full_name: name },
      ]);
      await api.as(uid);
      return uid;
    },
    /** Call one of the app's functions, the way the phone does. */
    async rpc(fn, args = {}) {
      const names = Object.keys(args);
      const sql = `select public.${fn}(${names.map((k, i) => `${k} => $${i + 1}`).join(', ')}) as r`;
      const res = await db.query(sql, names.map((k) => args[k]));
      return res.rows[0].r;
    },
    /** The notices sent since this was last asked, as "topic what", in order. */
    async notices() {
      const res = await db.query("select topic, payload ->> 'what' as what from realtime.sent order by n");
      await db.exec('delete from realtime.sent');
      return res.rows.map((r) => `${r.topic} ${r.what}`);
    },
    /** The error code a call fails with. */
    async fails(fn, args = {}) {
      try {
        await api.rpc(fn, args);
      } catch (e) {
        return e.message;
      }
      return null;
    },
  };
  return api;
}

export const track = (id, artist = 'Test Artist', title = `Song ${id}`) => ({
  id,
  sourceId: id,
  title,
  artist,
  album: 'An Album',
  year: 2020,
  genre: 'Alternative',
  artworkUrl: 'https://is1-ssl.mzstatic.com/image/thumb/test/600x600bb.jpg',
  previewUrl: 'https://audio-ssl.itunes.apple.com/itunes-assets/test/a.m4a',
});
