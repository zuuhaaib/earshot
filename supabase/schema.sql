-- earshot: the backend.
--
-- Run this in your Supabase project: SQL Editor → New query → paste → Run.
-- Then run supabase/seed.sql the same way. Both are safe to run again.
--
-- How it's put together:
--   * Sign-up, passwords, email codes, Google sign-in and login rate limits are
--     Supabase Auth's job.
--   * All of earshot's data lives in a schema called "app" that the outside
--     world cannot reach at all. Row-level security is on for every table and
--     there are no policies, so even a mistake in exposure shows nothing.
--   * The app talks to the database only through the functions in "public"
--     below. Each one works out who is calling from their login, and only does
--     what that person is allowed to do.
--
-- Times are milliseconds since 1970 (bigint), the same as the app uses.

create schema if not exists app;
revoke all on schema app from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- tables
-- ---------------------------------------------------------------------------

-- Moving up from the first version of this script: profiles lived in "public"
-- with a uuid id. They now live in "app" with a text id (residents have ids
-- like 'maren') and a separate link to the login.
do $$
begin
  if to_regclass('app.profiles') is null and to_regclass('public.profiles') is not null then
    drop policy if exists "profiles are readable by signed-in users" on public.profiles;
    drop policy if exists "people update their own profile" on public.profiles;
    alter table public.profiles drop constraint if exists profiles_id_fkey;
    alter table public.profiles alter column id type text using id::text;
    alter table public.profiles add column auth_id uuid;
    update public.profiles set auth_id = id::uuid;
    alter table public.profiles set schema app;
  end if;
end $$;

create table if not exists app.profiles (
  id text primary key,
  auth_id uuid,
  handle text not null,
  name text not null,
  badge text not null default '?',
  badge_color text not null default '#F7A6BF',
  tagline text not null default '',
  bio text not null default '',
  home_city text not null default 'Toronto',
  created_at timestamptz not null default now()
);
alter table app.profiles add column if not exists auth_id uuid;
alter table app.profiles add column if not exists seeded boolean not null default false;
-- false until someone who signed in with Google has picked their handle and badge
alter table app.profiles add column if not exists onboarded boolean not null default true;
alter table app.profiles add column if not exists sharing boolean not null default false;
-- The coarse area this person was last placed in. Never coordinates. Never sent to other people.
alter table app.profiles add column if not exists area_id text;
alter table app.profiles add column if not exists area_source text;
alter table app.profiles drop constraint if exists handle_shape;
alter table app.profiles add constraint handle_shape check (handle ~ '^[a-z0-9._]{2,28}$');
create unique index if not exists profiles_handle_unique on app.profiles (lower(handle));
create unique index if not exists profiles_auth_unique on app.profiles (auth_id) where auth_id is not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_auth_fkey') then
    alter table app.profiles add constraint profiles_auth_fkey foreign key (auth_id) references auth.users (id) on delete cascade;
  end if;
end $$;

create table if not exists app.tracks (
  id text primary key,
  source_id text not null,
  title text not null,
  artist text not null,
  album text not null default '',
  year integer,
  genre text not null default '',
  artwork_url text not null,
  preview_url text
);
create index if not exists tracks_by_artist on app.tracks (lower(artist));

-- Everything anyone has played or shared. area_id is null for private
-- listening: only rows with an area can ever show up in Nearby.
create table if not exists app.plays (
  id bigint generated always as identity primary key,
  user_id text not null references app.profiles (id) on delete cascade,
  track_id text not null references app.tracks (id),
  kind text not null check (kind in ('play', 'share')),
  note text,
  area_id text,
  started_at bigint not null,
  ended_at bigint
);
create index if not exists plays_by_area on app.plays (area_id, started_at);
create index if not exists plays_by_user on app.plays (user_id, started_at);

create table if not exists app.saves (
  user_id text not null references app.profiles (id) on delete cascade,
  track_id text not null references app.tracks (id),
  saved_at bigint not null,
  primary key (user_id, track_id)
);

create table if not exists app.requests (
  id bigint generated always as identity primary key,
  from_id text not null references app.profiles (id) on delete cascade,
  to_id text not null references app.profiles (id) on delete cascade,
  track_id text not null references app.tracks (id),
  note text,
  about_track_id text references app.tracks (id),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at bigint not null,
  answered_at bigint
);
create index if not exists requests_to on app.requests (to_id, status);
create index if not exists requests_from on app.requests (from_id, status);

create table if not exists app.messages (
  id bigint generated always as identity primary key,
  request_id bigint not null references app.requests (id) on delete cascade,
  from_id text not null references app.profiles (id) on delete cascade,
  body text,
  track_id text references app.tracks (id),
  created_at bigint not null
);
create index if not exists messages_by_chat on app.messages (request_id, created_at);

create table if not exists app.chat_reads (
  request_id bigint not null references app.requests (id) on delete cascade,
  user_id text not null references app.profiles (id) on delete cascade,
  read_at bigint not null,
  primary key (request_id, user_id)
);

-- Deleting a chat is one-sided: it empties the conversation for the person who
-- deleted it and leaves the other person's copy alone. Messages sent after
-- hidden_at show up again as a fresh conversation.
create table if not exists app.chat_hides (
  request_id bigint not null references app.requests (id) on delete cascade,
  user_id text not null references app.profiles (id) on delete cascade,
  hidden_at bigint not null,
  primary key (request_id, user_id)
);

create table if not exists app.rooms (
  user_id text primary key references app.profiles (id) on delete cascade,
  doc jsonb not null,
  updated_at bigint not null
);

create table if not exists app.posts (
  id bigint generated always as identity primary key,
  user_id text not null references app.profiles (id) on delete cascade,
  track_id text not null references app.tracks (id),
  note text not null,
  city text not null,
  created_at bigint not null,
  seeded boolean not null default false
);
create index if not exists posts_by_city on app.posts (city, created_at);

create table if not exists app.threads (
  id bigint generated always as identity primary key,
  artist_key text not null,
  artist text not null,
  city text not null,
  user_id text not null references app.profiles (id) on delete cascade,
  title text not null,
  body text not null default '',
  created_at bigint not null,
  seeded boolean not null default false
);
create index if not exists threads_by_artist on app.threads (artist_key, city);

create table if not exists app.replies (
  id bigint generated always as identity primary key,
  thread_id bigint not null references app.threads (id) on delete cascade,
  user_id text not null references app.profiles (id) on delete cascade,
  body text not null default '',
  track_id text references app.tracks (id),
  created_at bigint not null,
  seeded boolean not null default false
);
create index if not exists replies_by_thread on app.replies (thread_id, created_at);

-- The simulated neighbourhood: which residents are "around" which area and
-- until when, what they listen to, and what they send to people they notice.
create table if not exists app.presence (
  user_id text primary key references app.profiles (id) on delete cascade,
  area_id text not null,
  until bigint not null
);
create table if not exists app.tastes (
  user_id text not null references app.profiles (id) on delete cascade,
  track_id text not null references app.tracks (id),
  kind text not null check (kind in ('play', 'share')),
  note text,
  primary key (user_id, track_id, kind)
);
create table if not exists app.openers (
  user_id text primary key references app.profiles (id) on delete cascade,
  track_id text not null references app.tracks (id),
  note text not null,
  after_accept text not null
);
create table if not exists app.sim_state (
  area_id text primary key,
  ticked_at bigint not null
);

-- Safety. A block hides two people from each other everywhere, and nobody is
-- told. A report is a note for whoever runs this backend to read (Table Editor
-- → app → reports); it keeps a copy of what was reported, so it still makes
-- sense if the thing or the account is later deleted.
create table if not exists app.blocks (
  user_id text not null references app.profiles (id) on delete cascade,
  blocked_id text not null references app.profiles (id) on delete cascade,
  created_at bigint not null,
  primary key (user_id, blocked_id)
);
create index if not exists blocks_by_blocked on app.blocks (blocked_id);

create table if not exists app.reports (
  id bigint generated always as identity primary key,
  reporter_id text references app.profiles (id) on delete set null,
  about_id text not null,
  about_handle text not null,
  reason text not null,
  note text not null default '',
  context jsonb,
  created_at bigint not null,
  handled boolean not null default false
);

do $$
declare t text;
begin
  foreach t in array array['profiles','tracks','plays','saves','requests','messages','chat_reads','rooms','posts','threads','replies','presence','tastes','openers','sim_state','blocks','reports','chat_hides']
  loop
    execute format('alter table app.%I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- private helpers (schema "app": not callable from outside)
-- ---------------------------------------------------------------------------

create or replace function app.now_ms() returns bigint
language sql volatile as $$ select (extract(epoch from clock_timestamp()) * 1000)::bigint $$;

-- Who is calling, as a profile id. Null if nobody is logged in.
create or replace function app.me() returns text
language sql stable security definer set search_path = '' as $$
  select id from app.profiles where auth_id = (select auth.uid())
$$;

create or replace function app.need_me() returns text
language plpgsql stable security definer set search_path = '' as $$
declare v text := app.me();
begin
  if v is null then raise exception 'not-signed-in'; end if;
  return v;
end $$;

-- Whether either of two people has blocked the other.
create or replace function app.blocked(a text, b text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from app.blocks where (user_id = a and blocked_id = b) or (user_id = b and blocked_id = a))
$$;

-- Whether a has blocked b (one direction).
create or replace function app.i_blocked(a text, b text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from app.blocks where user_id = a and blocked_id = b)
$$;

-- Tear someone's signature out of a guestbook (owner null: out of every guestbook).
create or replace function app.unsign(owner text, signer text) returns void
language sql set search_path = '' as $$
  update app.rooms as r set doc = jsonb_set(r.doc, '{sections}', (
    select coalesce(jsonb_agg(
      case when s.value ->> 'kind' = 'guestbook' then jsonb_set(s.value, '{entries}', (
        select coalesce(jsonb_agg(e.value), '[]'::jsonb)
        from jsonb_array_elements(coalesce(s.value -> 'entries', '[]'::jsonb)) e
        where e.value ->> 'fromId' is distinct from signer))
      else s.value end order by s.ord), '[]'::jsonb)
    from jsonb_array_elements(r.doc -> 'sections') with ordinality s(value, ord)))
  where (owner is null or r.user_id = owner) and r.user_id <> signer and r.doc::text like '%' || signer || '%'
$$;

create or replace function app.person_json(p app.profiles) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'handle', p.handle, 'badge', p.badge, 'badgeColor', p.badge_color,
    'tagline', p.tagline, 'bio', p.bio, 'homeCity', p.home_city, 'seeded', p.seeded)
$$;

create or replace function app.person_by_id(pid text) returns jsonb
language sql stable set search_path = '' as $$
  select app.person_json(p) from app.profiles p where p.id = pid
$$;

create or replace function app.track_json(t app.tracks) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'id', t.id, 'sourceId', t.source_id, 'title', t.title, 'artist', t.artist, 'album', t.album,
    'year', t.year, 'genre', t.genre, 'artworkUrl', t.artwork_url, 'previewUrl', t.preview_url)
$$;

create or replace function app.track_by_id(tid text) returns jsonb
language sql stable set search_path = '' as $$
  select app.track_json(t) from app.tracks t where t.id = tid
$$;

-- Remember a track the app has sent. The first copy wins, so nobody can
-- overwrite the details of a song everyone else is already using.
create or replace function app.put_track(j jsonb) returns text
language plpgsql set search_path = '' as $$
declare tid text := j ->> 'id';
begin
  if tid is null or coalesce(j ->> 'title', '') = '' or coalesce(j ->> 'artist', '') = '' or coalesce(j ->> 'artworkUrl', '') = '' then
    raise exception 'bad-track';
  end if;
  insert into app.tracks (id, source_id, title, artist, album, year, genre, artwork_url, preview_url)
  values (
    left(tid, 120), left(coalesce(j ->> 'sourceId', tid), 120), left(j ->> 'title', 300), left(j ->> 'artist', 300),
    left(coalesce(j ->> 'album', ''), 300), nullif(j ->> 'year', '')::integer, left(coalesce(j ->> 'genre', ''), 80),
    left(j ->> 'artworkUrl', 600), left(j ->> 'previewUrl', 600))
  on conflict (id) do nothing;
  return left(tid, 120);
end $$;

-- Where things stand between two people. A song you sent that was quietly
-- declined still reads as 'sent': nobody is ever told about a no.
create or replace function app.link_json(v text, other text) returns jsonb
language plpgsql stable set search_path = '' as $$
declare rid bigint;
begin
  if v is null or other is null or v = other then return jsonb_build_object('kind', 'none'); end if;
  select id into rid from app.requests
    where status = 'accepted' and ((from_id = v and to_id = other) or (from_id = other and to_id = v))
    order by id desc limit 1;
  if rid is not null then return jsonb_build_object('kind', 'chat', 'id', rid::text); end if;
  select id into rid from app.requests where status = 'pending' and from_id = other and to_id = v order by id desc limit 1;
  if rid is not null then return jsonb_build_object('kind', 'incoming', 'id', rid::text); end if;
  select id into rid from app.requests where from_id = v and to_id = other order by id desc limit 1;
  if rid is not null then return jsonb_build_object('kind', 'sent', 'id', rid::text); end if;
  return jsonb_build_object('kind', 'none');
end $$;

create or replace function app.request_json(r app.requests) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', r.id::text, 'from', app.person_by_id(r.from_id), 'to', app.person_by_id(r.to_id),
    'track', app.track_by_id(r.track_id), 'note', r.note, 'about', app.track_by_id(r.about_track_id), 'sentAt', r.created_at)
$$;

-- Add a request, noting what the recipient had on (and was sharing) at the time.
create or replace function app.insert_request(p_from text, p_to text, p_track text, p_note text, at bigint) returns bigint
language plpgsql set search_path = '' as $$
declare about text; rid bigint;
begin
  select p.track_id into about from app.plays p
    where p.user_id = p_to and p.area_id is not null and p.started_at > at - 7200000
    order by p.started_at desc, p.id desc limit 1;
  insert into app.requests (from_id, to_id, track_id, note, about_track_id, created_at)
  values (p_from, p_to, p_track, p_note, about, at) returning id into rid;
  return rid;
end $$;

create or replace function app.scope_cities(scope text) returns text[]
language sql immutable as $$
  select case when scope = 'GTA'
    then array['Toronto', 'Vaughan', 'Mississauga', 'Brampton', 'Markham', 'Richmond Hill', 'Oakville']
    else array[scope] end
$$;

-- What a new account's room starts as: the house look and empty furniture.
-- (Kept identical to starterRoom() in the app; a test checks they match.)
create or replace function app.starter_room(pid text) returns jsonb
language sql immutable as $$
  select jsonb_set(
    $json${"personId":"","theme":{"paper":"#EFE6D2","card":"#F9F3E5","ink":"#1F2A6B","accent":"#F0502F","highlight":"#FFD23F","texture":"grain","displayFont":"poster","wall":"grid","layout":"loose"},"sections":[{"kind":"intro","title":"three songs, if we’ve never met","songs":[]},{"kind":"pinned","title":"the pinned record","trackId":null,"note":""},{"kind":"wall","title":"the wall","trackIds":[]},{"kind":"recent","title":"recently played","visibility":"shown","trackIds":[]},{"kind":"guestbook","title":"guestbook","entries":[]}]}$json$::jsonb,
    '{personId}', to_jsonb(pid))
$$;

-- How long a track "lasts" for a simulated resident: 2.5 to 4.5 minutes, fixed per track.
create or replace function app.track_length(tid text) returns bigint
language sql immutable as $$ select 150000 + (abs(hashtext(tid)) % 120000)::bigint $$;

-- ---------------------------------------------------------------------------
-- accounts
-- ---------------------------------------------------------------------------

-- A free handle based on what someone asked for (or their email), for sign-ins
-- that arrive without one.
create or replace function app.free_handle(wanted text) returns text
language plpgsql set search_path = '' as $$
declare base text; candidate text; n integer := 0;
begin
  base := regexp_replace(regexp_replace(lower(coalesce(wanted, '')), '[^a-z0-9._]+', '.', 'g'), '^\.+|\.+$', '', 'g');
  if length(base) < 2 then base := 'listener'; end if;
  base := left(base, 22);
  candidate := base;
  while exists (select 1 from app.profiles where lower(handle) = candidate) loop
    n := n + 1;
    candidate := base || n::text;
  end loop;
  return candidate;
end $$;

-- When someone signs up (by email or with Google), make their profile.
-- Email sign-ups send a handle and badge with them. Google sign-ups don't, so
-- they get a placeholder and are asked to finish their profile in the app.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  wanted text := lower(nullif(meta ->> 'handle', ''));
  display text := coalesce(nullif(meta ->> 'name', ''), nullif(meta ->> 'full_name', ''), split_part(coalesce(new.email, 'listener'), '@', 1));
begin
  insert into app.profiles (id, auth_id, handle, name, badge, badge_color, home_city, onboarded)
  values (
    new.id::text,
    new.id,
    case when wanted is not null then wanted else app.free_handle(split_part(coalesce(new.email, 'listener'), '@', 1)) end,
    left(display, 40),
    coalesce(nullif(upper(left(meta ->> 'badge', 2)), ''), upper(left(display, 2)), '?'),
    coalesce(nullif(meta ->> 'badge_color', ''), '#F7A6BF'),
    coalesce(nullif(meta ->> 'home_city', ''), 'Toronto'),
    wanted is not null
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets the sign-up screen say "that handle's taken" before sending an email.
create or replace function public.handle_available(wanted text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from app.profiles where lower(handle) = lower(trim(wanted)));
$$;

create or replace function public.get_session() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare p app.profiles; np jsonb;
begin
  select * into p from app.profiles where id = app.me();
  if not found then
    return jsonb_build_object('me', null, 'sharing', false, 'areaId', null, 'areaSource', null, 'nowPlaying', null, 'needsProfile', false);
  end if;
  select jsonb_build_object('track', app.track_json(t), 'note', pl.note, 'since', pl.started_at) into np
    from app.plays pl join app.tracks t on t.id = pl.track_id
    where pl.user_id = p.id and pl.ended_at is null
    order by pl.started_at desc, pl.id desc limit 1;
  return jsonb_build_object(
    'me', app.person_json(p), 'sharing', p.sharing, 'areaId', p.area_id, 'areaSource', p.area_source,
    'nowPlaying', np, 'needsProfile', not p.onboarded);
end $$;

-- Finish a profile that was started by a Google sign-in.
create or replace function public.complete_profile(p_name text, p_handle text, p_badge text, p_badge_color text, p_home_city text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me(); h text := lower(trim(p_handle));
begin
  if coalesce(trim(p_name), '') = '' then raise exception 'bad-name'; end if;
  if h !~ '^[a-z0-9._]{2,28}$' then raise exception 'bad-handle'; end if;
  if exists (select 1 from app.profiles where lower(handle) = h and id <> v) then raise exception 'handle-taken'; end if;
  update app.profiles set
    name = left(trim(p_name), 40), handle = h,
    badge = coalesce(nullif(upper(left(trim(p_badge), 2)), ''), '?'),
    badge_color = left(p_badge_color, 16),
    home_city = case when p_home_city = any(app.scope_cities('GTA')) then p_home_city else home_city end,
    onboarded = true
  where id = v;
  return public.get_session();
end $$;

create or replace function public.update_profile(p_name text, p_tagline text, p_bio text, p_badge text, p_badge_color text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me();
begin
  if coalesce(trim(p_name), '') = '' then raise exception 'bad-name'; end if;
  update app.profiles set
    name = left(trim(p_name), 40), tagline = left(trim(coalesce(p_tagline, '')), 80), bio = left(trim(coalesce(p_bio, '')), 240),
    badge = coalesce(nullif(upper(left(trim(p_badge), 2)), ''), '?'), badge_color = left(p_badge_color, 16)
  where id = v;
end $$;

create or replace function public.set_home_city(p_city text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me();
begin
  if not (p_city = any(app.scope_cities('GTA'))) then raise exception 'unknown-city'; end if;
  update app.profiles set home_city = p_city where id = v;
end $$;

create or replace function public.get_person(p_id text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when app.me() is null or app.blocked(app.me(), p_id) then null else app.person_by_id(p_id) end
$$;

-- ---------------------------------------------------------------------------
-- sharing, place and listening
-- ---------------------------------------------------------------------------

create or replace function public.set_sharing(p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me(); a text;
begin
  update app.profiles set sharing = p_on where id = v returning area_id into a;
  if not p_on then
    -- Off air means gone: pull every trace of you out of Nearby.
    update app.plays set area_id = null where user_id = v and area_id is not null;
  elsif a is not null then
    update app.plays set area_id = a where user_id = v and ended_at is null;
  end if;
end $$;

create or replace function public.set_area(p_area text, p_source text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me(); s boolean;
begin
  if p_source not in ('gps', 'picked') or coalesce(p_area, '') = '' or length(p_area) > 64 then raise exception 'bad-area'; end if;
  update app.profiles set area_id = p_area, area_source = p_source where id = v returning sharing into s;
  -- What you've got on moves with you, if you're sharing.
  if s then update app.plays set area_id = p_area where user_id = v and ended_at is null; end if;
end $$;

create or replace function public.set_now_playing(p_track jsonb, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me(); at bigint := app.now_ms(); note text := nullif(trim(coalesce(p_note, '')), ''); tid text; p app.profiles;
begin
  update app.plays set ended_at = at where user_id = v and ended_at is null;
  if p_track is null or jsonb_typeof(p_track) = 'null' then return; end if;
  tid := app.put_track(p_track);
  select * into p from app.profiles where id = v;
  insert into app.plays (user_id, track_id, kind, note, area_id, started_at)
  values (v, tid, case when note is null then 'play' else 'share' end, left(note, 280), case when p.sharing then p.area_id end, at);
end $$;

create or replace function public.get_nearby() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v text := app.me(); a text; at bigint := app.now_ms(); result jsonb;
begin
  if v is null then return '[]'::jsonb; end if;
  select area_id into a from app.profiles where id = v;
  if a is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', x.user_id, 'person', x.person, 'track', x.track, 'status', x.status,
        'minutesAgo', case when x.status = 'playing' then 0 else greatest(0, round((at - x.moment) / 60000.0))::integer end,
        'note', case when x.kind = 'share' then x.note end,
        'saved', x.saved, 'link', app.link_json(v, x.user_id))
      order by (x.status = 'playing') desc, x.moment desc), '[]'::jsonb)
  into result
  from (
    select distinct on (pl.user_id)
      pl.user_id, pl.kind, pl.note,
      app.person_json(u) as person, app.track_json(t) as track,
      case when pl.kind = 'share' then 'shared' when pl.ended_at is null then 'playing' else 'played' end as status,
      case when pl.kind <> 'share' and pl.ended_at is not null then pl.ended_at else pl.started_at end as moment,
      exists (select 1 from app.saves s where s.user_id = v and s.track_id = t.id) as saved
    from app.plays pl
    join app.profiles u on u.id = pl.user_id
    join app.tracks t on t.id = pl.track_id
    where pl.area_id = a and pl.user_id <> v and pl.started_at > at - 7200000 and u.sharing and not app.blocked(v, pl.user_id)
    order by pl.user_id, pl.started_at desc, pl.id desc
  ) x;
  return result;
end $$;

-- ---------------------------------------------------------------------------
-- the simulated neighbourhood
-- ---------------------------------------------------------------------------

create or replace function app.sim_play(uid text, area text, started bigint, ended bigint, not_track text) returns void
language plpgsql set search_path = '' as $$
declare tid text;
begin
  select track_id into tid from app.tastes
    where user_id = uid and kind = 'play' and (not_track is null or track_id <> not_track)
    order by random() limit 1;
  if tid is null then return; end if;
  insert into app.plays (user_id, track_id, kind, note, area_id, started_at, ended_at) values (uid, tid, 'play', null, area, started, ended);
end $$;

create or replace function app.sim_share(uid text, area text, at bigint) returns boolean
language plpgsql set search_path = '' as $$
declare s record;
begin
  -- something they haven't already pushed on people in the last twelve hours
  select t.track_id, t.note into s from app.tastes t
    where t.user_id = uid and t.kind = 'share'
      and not exists (select 1 from app.plays p where p.user_id = uid and p.kind = 'share' and p.track_id = t.track_id and p.started_at > at - 43200000)
    order by random() limit 1;
  if not found then return false; end if;
  insert into app.plays (user_id, track_id, kind, note, area_id, started_at, ended_at) values (uid, s.track_id, 'share', s.note, area, at, at);
  return true;
end $$;

-- Move the neighbourhood on, as seen from one area. Residents wander in and
-- out, put songs on, finish them, and now and then press one on strangers.
create or replace function app.tick(area text, at bigint) returns void
language plpgsql set search_path = '' as $$
declare
  r record; open_play record; len bigint; roll double precision;
  here_count integer; fresh boolean; target integer; want integer;
begin
  -- people whose time is up (anywhere) pack up and go
  for r in select p.user_id, p.until from app.presence p where p.until <= at loop
    update app.plays set ended_at = least(r.until, at) where user_id = r.user_id and ended_at is null;
    delete from app.presence where user_id = r.user_id;
  end loop;

  -- those already here get on with their listening
  for r in select p.user_id from app.presence p where p.area_id = area loop
    select pl.track_id, pl.started_at into open_play from app.plays pl
      where pl.user_id = r.user_id and pl.ended_at is null order by pl.started_at desc limit 1;
    roll := random();
    if found then
      len := app.track_length(open_play.track_id);
      if at - open_play.started_at >= len then
        update app.plays set ended_at = least(at, open_play.started_at + len) where user_id = r.user_id and ended_at is null;
        if roll < 0.5 then perform app.sim_play(r.user_id, area, at - floor(random() * 20000)::bigint, null, open_play.track_id);
        elsif roll < 0.6 then perform app.sim_share(r.user_id, area, at);
        end if; -- otherwise: headphones off for a bit
      end if;
    else
      -- a quiet spell lasts a few minutes on average, so the street is about half mid-song
      if roll < 0.04 then
        perform app.sim_play(r.user_id, area, at, null,
          (select pl.track_id from app.plays pl where pl.user_id = r.user_id order by pl.started_at desc, pl.id desc limit 1));
      elsif roll < 0.05 then perform app.sim_share(r.user_id, area, at);
      end if;
    end if;
  end loop;

  -- new arrivals: an empty street fills up at once; after that people drift in
  select count(*) into here_count from app.presence where area_id = area;
  fresh := here_count = 0;
  target := case when fresh then 9 + floor(random() * 4)::integer else 8 + ((at / 600000) % 5)::integer end;
  want := case when fresh then target else least(greatest(0, target - here_count), 2) end;

  for r in
    select u.id from app.profiles u
    where u.seeded and not exists (select 1 from app.presence p where p.user_id = u.id)
    order by random() limit want
  loop
    insert into app.presence (user_id, area_id, until) values (r.id, area, at + floor((10 + random() * 35) * 60000)::bigint);
    update app.plays set ended_at = at where user_id = r.id and ended_at is null;
    roll := random();
    if not fresh then
      perform app.sim_play(r.id, area, at - floor(random() * 60000)::bigint, null, null); -- walks in mid-song
    elsif roll < 0.4 then
      perform app.sim_play(r.id, area, at - floor(random() * 140000)::bigint, null, null);
    elsif roll < 0.8 or not app.sim_share(r.id, area, at - floor((3 + random() * 55) * 60000)::bigint) then
      len := at - floor((2 + random() * 48) * 60000)::bigint; -- when they finished
      perform app.sim_play(r.id, area, len - 200000, len, null);
    end if;
  end loop;
end $$;

-- Residents noticing you. If you're on air with a song, someone nearby will
-- eventually send you one; if you accept, they say one thing back. That is the
-- whole of their conversation: there is nobody actually there.
create or replace function app.social(v text, area text, at bigint) returns void
language plpgsql set search_path = '' as $$
declare r record; mine record; received integer; unanswered integer; last_at bigint; pick record;
begin
  for r in
    select q.id, q.from_id, o.after_accept from app.requests q
    join app.profiles u on u.id = q.from_id and u.seeded
    join app.openers o on o.user_id = q.from_id
    where q.to_id = v and q.status = 'accepted' and coalesce(q.answered_at, q.created_at) <= at - 6000
      and not exists (select 1 from app.messages m where m.request_id = q.id and m.from_id = q.from_id)
  loop
    insert into app.messages (request_id, from_id, body, created_at) values (r.id, r.from_id, r.after_accept, at);
    insert into app.chat_reads (request_id, user_id, read_at) values (r.id, r.from_id, at)
      on conflict (request_id, user_id) do update set read_at = excluded.read_at;
  end loop;

  select pl.started_at, t.title, t.artist into mine from app.plays pl join app.tracks t on t.id = pl.track_id
    where pl.user_id = v and pl.ended_at is null and pl.area_id is not null order by pl.started_at desc limit 1;
  if not found or at - mine.started_at < 40000 then return; end if; -- give them a moment to notice

  select count(*), count(*) filter (where q.status = 'pending'), max(q.created_at) into received, unanswered, last_at
    from app.requests q join app.profiles u on u.id = q.from_id and u.seeded where q.to_id = v;
  if unanswered > 0 or received >= 4 then return; end if; -- never a pile-up
  if last_at is not null and at - last_at < 1500000 then return; end if;

  select o.user_id, o.track_id, o.note into pick from app.openers o
    join app.presence p on p.user_id = o.user_id and p.area_id = area and p.until > at
    where not exists (select 1 from app.requests q where (q.from_id = v and q.to_id = o.user_id) or (q.from_id = o.user_id and q.to_id = v))
      and not app.blocked(v, o.user_id)
    order by random() limit 1;
  if not found then return; end if;
  perform app.insert_request(pick.user_id, v, pick.track_id, replace(replace(pick.note, '{title}', mine.title), '{artist}', mine.artist), at);
end $$;

-- Ask for anything new. Moves the simulated neighbourhood on for the caller's area.
create or replace function public.pulse() returns void
language plpgsql security definer set search_path = '' as $$
declare v text := app.me(); p app.profiles; at bigint := app.now_ms(); moved integer;
begin
  if v is null then return; end if;
  select * into p from app.profiles where id = v;
  if p.area_id is null then return; end if;
  -- Several phones in one area all ask; only one tick every few seconds actually runs.
  insert into app.sim_state as ss (area_id, ticked_at) values (p.area_id, at)
    on conflict (area_id) do update set ticked_at = excluded.ticked_at where ss.ticked_at <= excluded.ticked_at - 5000;
  get diagnostics moved = row_count;
  if moved > 0 then perform app.tick(p.area_id, at); end if;
  if not p.seeded then perform app.social(v, p.area_id, at); end if;
end $$;

-- ---------------------------------------------------------------------------
-- sending songs and the chats that follow
-- ---------------------------------------------------------------------------

create or replace function public.get_link(p_person text) returns jsonb
language sql stable security definer set search_path = '' as $$ select app.link_json(app.me(), p_person) $$;

create or replace function public.send_song(p_to text, p_track jsonb, p_note text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me(); at bigint := app.now_ms(); note text := nullif(trim(coalesce(p_note, '')), ''); link jsonb; tid text; rid bigint;
begin
  if p_to = v then raise exception 'self'; end if;
  if not exists (select 1 from app.profiles where id = p_to) then raise exception 'unknown-person'; end if;
  -- Blocked, either way round, looks exactly like someone who isn't there.
  if app.blocked(v, p_to) then raise exception 'unknown-person'; end if;
  link := app.link_json(v, p_to);
  if link ->> 'kind' = 'sent' then raise exception 'already-sent'; end if;
  if link ->> 'kind' = 'incoming' then raise exception 'they-sent-first'; end if;
  tid := app.put_track(p_track);
  if link ->> 'kind' = 'chat' then
    -- already talking: the song goes into the conversation
    rid := (link ->> 'id')::bigint;
    insert into app.messages (request_id, from_id, body, track_id, created_at) values (rid, v, left(note, 1000), tid, at);
    insert into app.chat_reads (request_id, user_id, read_at) values (rid, v, at)
      on conflict (request_id, user_id) do update set read_at = excluded.read_at;
    return jsonb_build_object('kind', 'chat', 'id', rid::text);
  end if;
  rid := app.insert_request(v, p_to, tid, left(note, 280), at);
  return jsonb_build_object('kind', 'request', 'id', rid::text);
end $$;

create or replace function public.answer_song(p_request text, p_accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me(); at bigint := app.now_ms(); rid bigint;
begin
  if p_request !~ '^\d+$' then raise exception 'not-waiting'; end if;
  update app.requests set status = case when p_accept then 'accepted' else 'declined' end, answered_at = at
    where id = p_request::bigint and to_id = v and status = 'pending' returning id into rid;
  if rid is null then raise exception 'not-waiting'; end if;
  if p_accept then
    insert into app.chat_reads (request_id, user_id, read_at) values (rid, v, at)
      on conflict (request_id, user_id) do update set read_at = excluded.read_at;
  end if;
end $$;

create or replace function app.chat_summaries(v text) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', c.id::text, 'other', app.person_by_id(c.other_id), 'opener', app.track_by_id(c.track_id),
        'last', case when c.last_at is null then null else jsonb_build_object('text', c.last_text, 'mine', c.last_from = v, 'at', c.last_at) end,
        -- a chat you've never opened is news in itself: they said yes
        'unread', case when c.read_at is null then greatest(1, c.fresh) else c.fresh end)
      order by coalesce(c.last_at, c.answered_at, c.created_at) desc), '[]'::jsonb)
  from (
    select q.id, q.track_id, q.answered_at, q.created_at,
      case when q.from_id = v then q.to_id else q.from_id end as other_id,
      cr.read_at, lm.created_at as last_at, lm.from_id as last_from,
      coalesce(lm.body, 'Sent a song: ' || coalesce(lt.title, 'untitled')) as last_text,
      (select count(*)::integer from app.messages m where m.request_id = q.id and m.from_id <> v and m.created_at > greatest(coalesce(cr.read_at, 0), coalesce(ch.hidden_at, 0))) as fresh
    from app.requests q
    left join app.chat_reads cr on cr.request_id = q.id and cr.user_id = v
    left join app.chat_hides ch on ch.request_id = q.id and ch.user_id = v
    left join lateral (select m.* from app.messages m where m.request_id = q.id order by m.created_at desc, m.id desc limit 1) lm on true
    left join app.tracks lt on lt.id = lm.track_id
    where q.status = 'accepted' and (q.from_id = v or q.to_id = v)
      and not app.i_blocked(v, case when q.from_id = v then q.to_id else q.from_id end)
      and (ch.hidden_at is null or coalesce(lm.created_at, 0) > ch.hidden_at)
  ) c
$$;

create or replace function public.get_inbox() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v text := app.me();
begin
  if v is null then return jsonb_build_object('waiting', '[]'::jsonb, 'chats', '[]'::jsonb, 'sent', '[]'::jsonb); end if;
  return jsonb_build_object(
    'waiting', (select coalesce(jsonb_agg(app.request_json(q) order by q.created_at desc, q.id desc), '[]'::jsonb) from app.requests q where q.to_id = v and q.status = 'pending' and not app.i_blocked(v, q.from_id)),
    'chats', app.chat_summaries(v),
    'sent', (select coalesce(jsonb_agg(app.request_json(q) order by q.created_at desc, q.id desc), '[]'::jsonb) from app.requests q where q.from_id = v and q.status <> 'accepted' and not app.i_blocked(v, q.to_id)));
end $$;

create or replace function public.get_inbox_count() returns integer
language plpgsql stable security definer set search_path = '' as $$
declare v text := app.me();
begin
  if v is null then return 0; end if;
  return (select count(*)::integer from app.requests q where q.to_id = v and q.status = 'pending' and not app.i_blocked(v, q.from_id))
       + (select count(*)::integer from jsonb_array_elements(app.chat_summaries(v)) c where (c ->> 'unread')::integer > 0);
end $$;

create or replace function public.get_chat(p_chat text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v text := app.me(); q app.requests;
begin
  if v is null or p_chat !~ '^\d+$' then return null; end if;
  select * into q from app.requests where id = p_chat::bigint and status = 'accepted' and (from_id = v or to_id = v);
  if not found then return null; end if; -- not yours to read
  if app.i_blocked(v, case when q.from_id = v then q.to_id else q.from_id end) then return null; end if;
  return jsonb_build_object(
    'id', q.id::text,
    'other', app.person_by_id(case when q.from_id = v then q.to_id else q.from_id end),
    'opener', app.request_json(q),
    'messages', (select coalesce(jsonb_agg(
        jsonb_build_object('id', m.id::text, 'fromId', m.from_id, 'body', m.body, 'track', app.track_by_id(m.track_id), 'sentAt', m.created_at)
        order by m.created_at, m.id), '[]'::jsonb) from app.messages m where m.request_id = q.id
          and m.created_at > coalesce((select ch.hidden_at from app.chat_hides ch where ch.request_id = q.id and ch.user_id = v), 0)));
end $$;

create or replace function public.send_message(p_chat text, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me(); at bigint := app.now_ms(); body text := trim(coalesce(p_body, ''));
begin
  if body = '' then return; end if;
  if p_chat !~ '^\d+$' or not exists (
    select 1 from app.requests where id = p_chat::bigint and status = 'accepted' and (from_id = v or to_id = v)) then
    raise exception 'not-your-chat';
  end if;
  -- If they have blocked you, the message is kept but they never see the chat. You are not told.
  if exists (select 1 from app.requests q where q.id = p_chat::bigint
             and app.i_blocked(v, case when q.from_id = v then q.to_id else q.from_id end)) then
    raise exception 'not-your-chat';
  end if;
  insert into app.messages (request_id, from_id, body, created_at) values (p_chat::bigint, v, left(body, 1000), at);
  insert into app.chat_reads (request_id, user_id, read_at) values (p_chat::bigint, v, at)
    on conflict (request_id, user_id) do update set read_at = excluded.read_at;
end $$;

create or replace function public.mark_chat_read(p_chat text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me();
begin
  if p_chat !~ '^\d+$' or not exists (
    select 1 from app.requests where id = p_chat::bigint and status = 'accepted' and (from_id = v or to_id = v)) then
    return;
  end if;
  insert into app.chat_reads (request_id, user_id, read_at) values (p_chat::bigint, v, app.now_ms())
    on conflict (request_id, user_id) do update set read_at = excluded.read_at;
end $$;

-- Delete a chat, for you only. Everything said so far disappears from your
-- side and the chat leaves your inbox; the other person keeps their copy and is
-- not told. You stay connected: if either of you writes again, the chat comes
-- back holding only what's new. Once both people have deleted it, the old
-- messages are removed from the database for good.
create or replace function public.delete_chat(p_chat text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me(); at bigint := app.now_ms(); rid bigint; seen_by_all bigint;
begin
  if p_chat !~ '^[0-9]+$' then raise exception 'not-your-chat'; end if;
  select id into rid from app.requests where id = p_chat::bigint and status = 'accepted' and (from_id = v or to_id = v);
  if rid is null then raise exception 'not-your-chat'; end if;
  insert into app.chat_hides (request_id, user_id, hidden_at) values (rid, v, at)
    on conflict (request_id, user_id) do update set hidden_at = excluded.hidden_at;
  insert into app.chat_reads (request_id, user_id, read_at) values (rid, v, at)
    on conflict (request_id, user_id) do update set read_at = excluded.read_at;
  -- what neither person can see any more has no reason to exist
  select min(h.hidden_at) into seen_by_all from app.chat_hides h where h.request_id = rid having count(*) = 2;
  if seen_by_all is not null then delete from app.messages where request_id = rid and created_at <= seen_by_all; end if;
end $$;

-- ---------------------------------------------------------------------------
-- crate
-- ---------------------------------------------------------------------------

create or replace function public.toggle_save(p_track jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me(); tid text := p_track ->> 'id';
begin
  delete from app.saves where user_id = v and track_id = tid;
  if found then return false; end if;
  tid := app.put_track(p_track);
  insert into app.saves (user_id, track_id, saved_at) values (v, tid, app.now_ms());
  return true;
end $$;

create or replace function public.get_crate() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(app.track_json(t) order by s.saved_at desc), '[]'::jsonb)
  from app.saves s join app.tracks t on t.id = s.track_id where s.user_id = app.me()
$$;

-- ---------------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------------

create or replace function public.get_room(p_person text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v text := app.me(); p app.profiles; doc jsonb; s jsonb; sections jsonb := '[]'::jsonb; recent jsonb;
  tids text[] := '{}'; pids text[] := '{}';
begin
  if v is null then return null; end if;
  select * into p from app.profiles where id = p_person;
  if not found or app.blocked(v, p_person) then return null; end if;
  select r.doc into doc from app.rooms r where r.user_id = p_person;
  if doc is null then
    -- everyone gets a room; new accounts start with the house look and empty furniture
    doc := app.starter_room(p_person);
    insert into app.rooms (user_id, doc, updated_at) values (p_person, doc, app.now_ms()) on conflict (user_id) do nothing;
  end if;

  -- "recently played" is whatever they've really had on, unless they keep it hidden
  select coalesce(jsonb_agg(x.track_id order by x.latest desc), '[]'::jsonb) into recent
    from (select pl.track_id, max(pl.started_at) as latest from app.plays pl where pl.user_id = p_person group by pl.track_id order by latest desc limit 6) x;

  for s in select value from jsonb_array_elements(doc -> 'sections') loop
    if s ->> 'kind' = 'recent' then
      if s ->> 'visibility' = 'hidden' then s := jsonb_set(s, '{trackIds}', '[]'::jsonb);
      elsif jsonb_array_length(recent) > 0 then s := jsonb_set(s, '{trackIds}', recent);
      end if;
    end if;
    sections := sections || jsonb_build_array(s);

    if s ->> 'kind' = 'intro' then
      tids := tids || array(select x ->> 'trackId' from jsonb_array_elements(coalesce(s -> 'songs', '[]'::jsonb)) x);
    elsif s ->> 'kind' = 'pinned' then
      if s ->> 'trackId' is not null then tids := tids || (s ->> 'trackId'); end if;
    elsif s ->> 'kind' in ('wall', 'shelf', 'recent') then
      tids := tids || array(select jsonb_array_elements_text(coalesce(s -> 'trackIds', '[]'::jsonb)));
    elsif s ->> 'kind' = 'liner' then
      tids := tids || array(select x ->> 'trackId' from jsonb_array_elements(coalesce(s -> 'notes', '[]'::jsonb)) x where x ->> 'trackId' is not null);
    elsif s ->> 'kind' = 'guestbook' then
      tids := tids || array(select x ->> 'trackId' from jsonb_array_elements(coalesce(s -> 'entries', '[]'::jsonb)) x);
      pids := pids || array(select x ->> 'fromId' from jsonb_array_elements(coalesce(s -> 'entries', '[]'::jsonb)) x);
    end if;
  end loop;

  doc := jsonb_set(jsonb_set(doc, '{sections}', sections), '{personId}', to_jsonb(p_person));
  return jsonb_build_object(
    'person', app.person_json(p), 'room', doc,
    'tracks', (select coalesce(jsonb_object_agg(t.id, app.track_json(t)), '{}'::jsonb) from app.tracks t where t.id = any(tids)),
    'people', (select coalesce(jsonb_object_agg(q.id, app.person_json(q)), '{}'::jsonb) from app.profiles q where q.id = any(pids)),
    'mine', v = p_person);
end $$;

create or replace function public.save_room(p_room jsonb, p_tracks jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me(); stored jsonb; signed jsonb; s jsonb; t jsonb; sections jsonb := '[]'::jsonb;
begin
  if p_room ->> 'personId' is distinct from v then raise exception 'not-your-room'; end if;
  if jsonb_typeof(p_room -> 'sections') is distinct from 'array' or jsonb_typeof(p_room -> 'theme') is distinct from 'object' then raise exception 'bad-room'; end if;
  if length(p_room::text) > 120000 or jsonb_array_length(p_room -> 'sections') > 24 then raise exception 'room-too-big'; end if;

  if jsonb_typeof(p_tracks) = 'array' then
    for t in select value from jsonb_array_elements(p_tracks) loop perform app.put_track(t); end loop;
  end if;

  -- The guestbook belongs to its signers: keep what's stored, unless the owner tore an entry out.
  select r.doc into stored from app.rooms r where r.user_id = v;
  select coalesce(jsonb_agg(e.value), '[]'::jsonb) into signed
    from jsonb_array_elements(coalesce(stored -> 'sections', '[]'::jsonb)) sec, jsonb_array_elements(coalesce(sec.value -> 'entries', '[]'::jsonb)) e
    where sec.value ->> 'kind' = 'guestbook';

  for s in select value from jsonb_array_elements(p_room -> 'sections') loop
    if s ->> 'kind' = 'recent' then
      s := jsonb_set(s, '{trackIds}', '[]'::jsonb); -- derived from listening, never stored
    elsif s ->> 'kind' = 'guestbook' then
      s := jsonb_set(s, '{entries}', (
        select coalesce(jsonb_agg(kept.value order by sub.ord), '[]'::jsonb)
        from jsonb_array_elements(coalesce(s -> 'entries', '[]'::jsonb)) with ordinality sub(value, ord)
        join lateral (select k.value from jsonb_array_elements(signed) k where k.value ->> 'fromId' = sub.value ->> 'fromId' limit 1) kept on true));
    end if;
    sections := sections || jsonb_build_array(s);
  end loop;

  insert into app.rooms (user_id, doc, updated_at)
  values (v, jsonb_build_object('personId', v, 'theme', p_room -> 'theme', 'sections', sections), app.now_ms())
  on conflict (user_id) do update set doc = excluded.doc, updated_at = excluded.updated_at;
end $$;

create or replace function public.sign_guestbook(p_person text, p_track jsonb, p_why text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me(); why text := trim(coalesce(p_why, '')); doc jsonb; s jsonb; sections jsonb := '[]'::jsonb; done boolean := false; tid text; entry jsonb;
begin
  if p_person = v then raise exception 'own-guestbook'; end if;
  if why = '' then raise exception 'say-why'; end if;
  if public.get_room(p_person) is null then raise exception 'no-such-room'; end if; -- also makes sure the room exists
  select r.doc into doc from app.rooms r where r.user_id = p_person for update;
  tid := app.put_track(p_track);
  entry := jsonb_build_object('fromId', v, 'trackId', tid, 'why', left(why, 280), 'at', app.now_ms());
  for s in select value from jsonb_array_elements(doc -> 'sections') loop
    if not done and s ->> 'kind' = 'guestbook' then
      -- one entry per visitor: signing again replaces the last one
      s := jsonb_set(s, '{entries}', jsonb_build_array(entry) || (
        select coalesce(jsonb_agg(e.value), '[]'::jsonb) from jsonb_array_elements(coalesce(s -> 'entries', '[]'::jsonb)) e where e.value ->> 'fromId' <> v));
      done := true;
    end if;
    sections := sections || jsonb_build_array(s);
  end loop;
  if not done then raise exception 'no-guestbook'; end if;
  update app.rooms as r set doc = jsonb_set(r.doc, '{sections}', sections), updated_at = app.now_ms() where r.user_id = p_person;
end $$;

-- ---------------------------------------------------------------------------
-- city
-- ---------------------------------------------------------------------------

create or replace function public.get_city_feed(p_scope text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v text := app.me(); at bigint := app.now_ms(); in_scope text[] := app.scope_cities(p_scope); posts jsonb; trending jsonb;
begin
  if v is null then return jsonb_build_object('scope', p_scope, 'posts', '[]'::jsonb, 'trending', '[]'::jsonb); end if;

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', x.id::text, 'person', app.person_json(u), 'track', app.track_json(t), 'note', x.note, 'city', x.city,
        'postedAt', x.created_at, 'saved', exists (select 1 from app.saves s where s.user_id = v and s.track_id = t.id),
        'link', app.link_json(v, x.user_id), 'mine', x.user_id = v)
      order by x.created_at desc, x.id desc), '[]'::jsonb)
  into posts
  from (select * from app.posts p where p.city = any(in_scope) and p.created_at <= at and not app.blocked(v, p.user_id) order by p.created_at desc, p.id desc limit 80) x
  join app.profiles u on u.id = x.user_id
  join app.tracks t on t.id = x.track_id;

  -- Who's getting attention: a post counts for three plays. Last seven days, this scope only.
  select coalesce(jsonb_agg(
      jsonb_build_object('artist', h.artist, 'posts', h.posts, 'plays', h.plays, 'artworkUrl', h.artwork_url)
      order by h.score desc, h.artist), '[]'::jsonb)
  into trending
  from (
    select a.artist, sum(a.posts)::integer as posts, sum(a.plays)::integer as plays, min(a.artwork_url) as artwork_url,
           sum(a.posts) * 3 + sum(a.plays) as score
    from (
      select t.artist, 1 as posts, 0 as plays, t.artwork_url
        from app.posts p join app.tracks t on t.id = p.track_id
        where p.city = any(in_scope) and p.created_at <= at and p.created_at > at - 604800000
      union all
      select t.artist, 0, 1, t.artwork_url
        from app.plays pl join app.profiles u on u.id = pl.user_id join app.tracks t on t.id = pl.track_id
        where u.home_city = any(in_scope) and pl.area_id is not null and pl.started_at <= at and pl.started_at > at - 604800000
    ) a
    group by a.artist order by score desc, a.artist limit 6
  ) h;

  return jsonb_build_object('scope', p_scope, 'posts', posts, 'trending', trending);
end $$;

create or replace function public.post_to_city(p_track jsonb, p_note text) returns text
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me(); note text := trim(coalesce(p_note, '')); tid text; pid bigint;
begin
  if note = '' then raise exception 'say-why'; end if;
  tid := app.put_track(p_track);
  insert into app.posts (user_id, track_id, note, city, created_at)
  values (v, tid, left(note, 280), (select home_city from app.profiles where id = v), app.now_ms()) returning id into pid;
  return pid::text;
end $$;

create or replace function public.remove_post(p_post text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me();
begin
  if p_post ~ '^\d+$' then delete from app.posts where id = p_post::bigint and user_id = v; end if;
end $$;

-- ---------------------------------------------------------------------------
-- artists' local rooms
-- ---------------------------------------------------------------------------

create or replace function public.get_artist_space(p_artist text, p_scope text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v text := app.me(); at bigint := app.now_ms(); k text := lower(trim(p_artist)); in_scope text[] := app.scope_cities(p_scope);
  tracks jsonb; name text; threads jsonb; fans jsonb; elsewhere integer := 0;
begin
  if v is null then
    return jsonb_build_object('artist', trim(p_artist), 'scope', p_scope, 'tracks', '[]'::jsonb, 'listeners', '[]'::jsonb, 'threads', '[]'::jsonb, 'elsewhere', 0);
  end if;

  select coalesce(jsonb_agg(app.track_json(t) order by t.title), '[]'::jsonb), min(t.artist) into tracks, name
    from (select * from app.tracks where lower(artist) = k order by title limit 12) t;
  name := coalesce(name, trim(p_artist)); -- the spelling the music source uses, if we have one of their tracks

  select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', th.id::text, 'artist', name, 'city', th.city, 'title', th.title, 'starter', app.person_by_id(th.user_id),
        'startedAt', th.created_at, 'replies', th.reply_count, 'lastAt', coalesce(th.last_at, th.created_at),
        'last', case when th.last_user is null then null else jsonb_build_object('person', app.person_by_id(th.last_user), 'text', th.last_text) end)
      order by coalesce(th.last_at, th.created_at) desc), '[]'::jsonb)
  into threads
  from (
    select t.*,
      (select count(*)::integer from app.replies r where r.thread_id = t.id and r.created_at <= at and not app.blocked(v, r.user_id)) as reply_count,
      lr.created_at as last_at, lr.user_id as last_user, lr.body as last_text
    from app.threads t
    left join lateral (select r.* from app.replies r where r.thread_id = t.id and r.created_at <= at and not app.blocked(v, r.user_id) order by r.created_at desc, r.id desc limit 1) lr on true
    where t.artist_key = k and t.city = any(in_scope) and t.created_at <= at and not app.blocked(v, t.user_id)
  ) th;

  -- who around here has had them on lately (shared listening only), or posted them
  select coalesce(jsonb_agg(app.person_json(u) order by u.name), '[]'::jsonb) into fans
  from (
    select u.* from app.profiles u
    where u.home_city = any(in_scope) and not app.blocked(v, u.id) and (
      exists (select 1 from app.plays pl join app.tracks t on t.id = pl.track_id
              where pl.user_id = u.id and lower(t.artist) = k and pl.area_id is not null and pl.started_at > at - 2592000000)
      or exists (select 1 from app.posts p join app.tracks t on t.id = p.track_id
                 where p.user_id = u.id and lower(t.artist) = k and p.created_at > at - 2592000000 and p.created_at <= at))
    order by u.name limit 12
  ) u;

  if p_scope <> 'GTA' then
    select count(*)::integer into elsewhere from app.threads t where t.artist_key = k and t.city <> p_scope and t.created_at <= at;
  end if;

  return jsonb_build_object('artist', name, 'scope', p_scope, 'tracks', tracks, 'listeners', fans, 'threads', threads, 'elsewhere', elsewhere);
end $$;

create or replace function public.get_thread(p_thread text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v text := app.me(); at bigint := app.now_ms(); t app.threads;
begin
  if v is null or p_thread !~ '^\d+$' then return null; end if;
  select * into t from app.threads where id = p_thread::bigint and created_at <= at;
  if not found or app.blocked(v, t.user_id) then return null; end if;
  return jsonb_build_object(
    'id', t.id::text, 'artist', t.artist, 'city', t.city, 'title', t.title, 'body', t.body,
    'starter', app.person_by_id(t.user_id), 'startedAt', t.created_at,
    'replies', (select coalesce(jsonb_agg(
        jsonb_build_object('id', r.id::text, 'person', app.person_by_id(r.user_id), 'body', r.body, 'track', app.track_by_id(r.track_id), 'at', r.created_at)
        order by r.created_at, r.id), '[]'::jsonb) from app.replies r where r.thread_id = t.id and r.created_at <= at and not app.blocked(v, r.user_id)));
end $$;

create or replace function public.start_thread(p_artist text, p_title text, p_body text) returns text
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me(); title text := trim(coalesce(p_title, '')); name text := trim(coalesce(p_artist, '')); tid bigint;
begin
  if title = '' or name = '' then raise exception 'needs-title'; end if;
  insert into app.threads (artist_key, artist, city, user_id, title, body, created_at)
  values (lower(name), left(name, 200), (select home_city from app.profiles where id = v), v, left(title, 120), left(trim(coalesce(p_body, '')), 600), app.now_ms())
  returning id into tid;
  return tid::text;
end $$;

create or replace function public.reply_to_thread(p_thread text, p_body text, p_track jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me(); body text := trim(coalesce(p_body, '')); tid text;
begin
  if body = '' and (p_track is null or jsonb_typeof(p_track) = 'null') then return; end if;
  if p_thread !~ '^\d+$' or not exists (select 1 from app.threads where id = p_thread::bigint) then raise exception 'thread-gone'; end if;
  if p_track is not null and jsonb_typeof(p_track) <> 'null' then tid := app.put_track(p_track); end if;
  insert into app.replies (thread_id, user_id, body, track_id, created_at) values (p_thread::bigint, v, left(body, 1000), tid, app.now_ms());
end $$;

-- ---------------------------------------------------------------------------
-- safety: block, report, delete your account
-- ---------------------------------------------------------------------------

-- Block someone. From then on neither of you sees the other anywhere: not
-- nearby, not in the city feed, not in threads, not in rooms. Their songs and
-- chat disappear from your inbox. They are not told, and nothing on their side
-- says it happened.
create or replace function public.block_person(p_person text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me();
begin
  if p_person = v then raise exception 'self'; end if;
  if not exists (select 1 from app.profiles where id = p_person) then raise exception 'unknown-person'; end if;
  insert into app.blocks (user_id, blocked_id, created_at) values (v, p_person, app.now_ms()) on conflict do nothing;
  perform app.unsign(v, p_person);
  perform app.unsign(p_person, v);
end $$;

create or replace function public.unblock_person(p_person text) returns void
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me();
begin
  delete from app.blocks where user_id = v and blocked_id = p_person;
end $$;

-- The people you have blocked, newest first.
create or replace function public.get_blocked() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(app.person_json(p) order by b.created_at desc), '[]'::jsonb)
  from app.blocks b join app.profiles p on p.id = b.blocked_id where b.user_id = app.me()
$$;

-- Report someone. p_context says what it is about: {"kind": "chat" | "message" |
-- "post" | "thread" | "reply" | "room", "id": "..."} or null for the person in
-- general ("message" and "reply" point at one thing they wrote). The copy
-- that is kept is taken here, from the database, never from what the app sends.
create or replace function public.report_person(p_person text, p_reason text, p_note text, p_context jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v text := app.need_me(); at bigint := app.now_ms(); about app.profiles;
  kind text := p_context ->> 'kind'; cid text := p_context ->> 'id'; copy jsonb; chat_id bigint;
begin
  if p_person = v then raise exception 'self'; end if;
  select * into about from app.profiles where id = p_person;
  if not found then raise exception 'unknown-person'; end if;
  if p_reason is null or p_reason not in ('harassment', 'hate', 'sexual', 'spam', 'impersonation', 'underage', 'other') then raise exception 'bad-reason'; end if;
  if (select count(*) from app.reports where reporter_id = v and created_at > at - 86400000) >= 20 then raise exception 'too-many-reports'; end if;

  copy := jsonb_build_object('profile', jsonb_build_object('name', about.name, 'tagline', about.tagline, 'bio', about.bio));
  if kind = 'chat' and cid ~ '^[0-9]+$' then
    -- only a conversation the reporter is actually in
    if exists (select 1 from app.requests q where q.id = cid::bigint and (q.from_id = v or q.to_id = v) and (q.from_id = p_person or q.to_id = p_person)) then
      copy := copy || jsonb_build_object('kind', 'chat', 'id', cid, 'opener', (select q.note from app.requests q where q.id = cid::bigint),
        'messages', (select coalesce(jsonb_agg(jsonb_build_object('from', m.from_id, 'body', m.body, 'at', m.created_at) order by m.created_at, m.id), '[]'::jsonb)
                     from (select * from app.messages where request_id = cid::bigint order by created_at desc, id desc limit 30) m));
    end if;
  elsif kind = 'message' and cid ~ '^[0-9]+$' then
    -- one message of theirs, in a conversation the reporter is actually in, with what was said around it
    select m.request_id into chat_id from app.messages m join app.requests q on q.id = m.request_id
      where m.id = cid::bigint and m.from_id = p_person and (q.from_id = v or q.to_id = v);
    if chat_id is not null then
      copy := copy || jsonb_build_object('kind', 'message', 'id', cid, 'chat', chat_id::text,
        'reported', (select jsonb_build_object('body', m.body, 'track', m.track_id, 'at', m.created_at) from app.messages m where m.id = cid::bigint),
        'messages', (select coalesce(jsonb_agg(jsonb_build_object('from', m.from_id, 'body', m.body, 'at', m.created_at) order by m.created_at, m.id), '[]'::jsonb)
                     from (select * from app.messages where request_id = chat_id order by created_at desc, id desc limit 30) m));
    end if;
  elsif kind = 'reply' and cid ~ '^[0-9]+$' then
    copy := copy || coalesce((select jsonb_build_object('kind', 'reply', 'id', cid, 'thread', r.thread_id::text, 'title', t.title, 'body', r.body, 'track', r.track_id)
                              from app.replies r join app.threads t on t.id = r.thread_id
                              where r.id = cid::bigint and r.user_id = p_person), '{}'::jsonb);
  elsif kind = 'post' and cid ~ '^[0-9]+$' then
    copy := copy || coalesce((select jsonb_build_object('kind', 'post', 'id', cid, 'note', p.note, 'track', p.track_id)
                              from app.posts p where p.id = cid::bigint and p.user_id = p_person), '{}'::jsonb);
  elsif kind = 'thread' and cid ~ '^[0-9]+$' then
    copy := copy || jsonb_build_object('kind', 'thread', 'id', cid,
      'title', (select t.title from app.threads t where t.id = cid::bigint),
      'theirs', (select coalesce(jsonb_agg(x.body), '[]'::jsonb) from (
          select t.body from app.threads t where t.id = cid::bigint and t.user_id = p_person
          union all
          select r.body from app.replies r where r.thread_id = cid::bigint and r.user_id = p_person) x));
  elsif kind = 'room' then
    copy := copy || jsonb_build_object('kind', 'room', 'room', (select r.doc from app.rooms r where r.user_id = p_person));
  end if;

  insert into app.reports (reporter_id, about_id, about_handle, reason, note, context, created_at)
  values (v, p_person, about.handle, p_reason, left(trim(coalesce(p_note, '')), 1000), copy, at);
end $$;

-- Delete your account and everything of yours: profile, room, crate, listening,
-- songs sent and received, chats (for both people), city posts, threads you
-- started (with their replies), replies, guestbook signatures, blocks, and the
-- login itself. It cannot be undone.
create or replace function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
declare v text := app.need_me(); p app.profiles;
begin
  select * into p from app.profiles where id = v;
  if p.seeded then raise exception 'resident'; end if;
  perform app.unsign(null, v);
  delete from app.profiles where id = v;
  if p.auth_id is not null then delete from auth.users where id = p.auth_id; end if;
end $$;

-- ---------------------------------------------------------------------------
-- change notices (what makes updates arrive at once)
-- ---------------------------------------------------------------------------
-- When something changes, the database sends a tiny notice over Supabase
-- Realtime to the phones it concerns, and they ask for the new data the normal
-- way, through the functions above. A notice says only what KIND of thing
-- changed ("inbox", "nearby", "city", "artist", "room"). It never carries a
-- song, a message, a name or a place, so there is nothing in it to protect
-- beyond who may hear it:
--   person:<your id>   only you
--   area:<area id>     only people currently placed in that area
--   city:<city>        anyone signed in (the city feed is open to them anyway)

create or replace function app.slug(s text) returns text
language sql immutable set search_path = '' as $$
  select trim(both '-' from regexp_replace(lower(coalesce(s, '')), '[^a-z0-9]+', '-', 'g'))
$$;

-- Send one notice. The same notice is sent at most once per transaction, and a
-- failure to send never undoes the change that caused it.
create or replace function app.tell(topic text, what text) returns void
language plpgsql security definer set search_path = '' as $$
declare key text; told text := coalesce(current_setting('earshot.told', true), '');
begin
  if topic is null or what is null then return; end if;
  key := chr(10) || topic || '|' || what || chr(10);
  if position(key in told) > 0 then return; end if;
  perform set_config('earshot.told', told || key, true);
  begin
    perform realtime.send(jsonb_build_object('what', what), 'changed', topic, true);
  exception when others then null;
  end;
end $$;

create or replace function app.on_request() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.tell('person:' || new.to_id, 'inbox');
  -- Declining is silent. The sender is not sent so much as a blank "something changed".
  if tg_op = 'INSERT' or new.status <> 'declined' then
    perform app.tell('person:' || new.from_id, 'inbox');
  end if;
  return null;
end $$;

create or replace function app.on_message() returns trigger
language plpgsql security definer set search_path = '' as $$
declare q app.requests;
begin
  select * into q from app.requests where id = new.request_id;
  perform app.tell('person:' || q.from_id, 'inbox');
  perform app.tell('person:' || q.to_id, 'inbox');
  return null;
end $$;

create or replace function app.on_play() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op <> 'INSERT' then perform app.tell('area:' || old.area_id, 'nearby'); end if;
  if tg_op <> 'DELETE' then perform app.tell('area:' || new.area_id, 'nearby'); end if;
  return null;
end $$;

create or replace function app.on_post() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then perform app.tell('city:' || app.slug(old.city), 'city');
  else perform app.tell('city:' || app.slug(new.city), 'city');
  end if;
  return null;
end $$;

create or replace function app.on_thread() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.tell('city:' || app.slug(new.city), 'artist');
  return null;
end $$;

create or replace function app.on_reply() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.tell('city:' || app.slug((select t.city from app.threads t where t.id = new.thread_id)), 'artist');
  return null;
end $$;

create or replace function app.on_room() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.tell('person:' || new.user_id, 'room');
  return null;
end $$;

drop trigger if exists tell_request on app.requests;
create trigger tell_request after insert or update on app.requests for each row execute function app.on_request();
drop trigger if exists tell_message on app.messages;
create trigger tell_message after insert on app.messages for each row execute function app.on_message();
drop trigger if exists tell_play on app.plays;
create trigger tell_play after insert or update or delete on app.plays for each row execute function app.on_play();
drop trigger if exists tell_post on app.posts;
create trigger tell_post after insert or delete on app.posts for each row execute function app.on_post();
drop trigger if exists tell_thread on app.threads;
create trigger tell_thread after insert on app.threads for each row execute function app.on_thread();
drop trigger if exists tell_reply on app.replies;
create trigger tell_reply after insert on app.replies for each row execute function app.on_reply();
drop trigger if exists tell_room on app.rooms;
create trigger tell_room after insert or update on app.rooms for each row execute function app.on_room();

-- Whether the caller may listen on a notice channel. Realtime asks this when a
-- phone joins one.
create or replace function public.may_listen(p_topic text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select p_topic = 'person:' || p.id
        or (p.area_id is not null and p_topic = 'area:' || p.area_id)
        or p_topic like 'city:%'
    from app.profiles p where p.id = app.me()), false)
$$;

do $$
begin
  if to_regclass('realtime.messages') is not null then
    drop policy if exists "earshot: hear your own notices" on realtime.messages;
    create policy "earshot: hear your own notices" on realtime.messages
      for select to authenticated
      using (realtime.messages.extension = 'broadcast' and public.may_listen((select realtime.topic())));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- report alerts: an email for every new report
-- ---------------------------------------------------------------------------
-- Each new report is emailed to whoever runs earshot, through Resend. Nothing
-- is sent until two secrets exist in Supabase's encrypted store (Vault). Run
-- these once in the SQL editor, with your own values; never put them in a file:
--
--   select vault.create_secret('re_your_resend_key', 'resend_api_key');
--   select vault.create_secret('you@example.com', 'report_alert_to');
--
-- With no domain of your own, Resend only delivers to the address the Resend
-- account was made with, so report_alert_to must be that address.
-- The email is queued and sent after the report is saved: a slow or failed
-- email never stops a report. Failures show up in net._http_response.

do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net is not available here, so report emails are off: %', sqlerrm;
end $$;

create or replace function app.alert_report() returns trigger
language plpgsql security definer set search_path = '' as $$
declare key text; send_to text; reporter text;
begin
  begin
    select decrypted_secret into key from vault.decrypted_secrets where name = 'resend_api_key';
    select decrypted_secret into send_to from vault.decrypted_secrets where name = 'report_alert_to';
    if coalesce(key, '') = '' or coalesce(send_to, '') = '' then return null; end if;
    select handle into reporter from app.profiles where id = new.reporter_id;
    perform net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', 'earshot reports <onboarding@resend.dev>',
        'to', jsonb_build_array(send_to),
        'subject', 'earshot report: @' || new.about_handle || ' (' || new.reason || ')',
        'text',
          'Someone reported @' || new.about_handle || '.' || chr(10) || chr(10)
          || 'Reason: ' || new.reason || chr(10)
          || 'Their note: ' || coalesce(nullif(new.note, ''), '(none)') || chr(10)
          || 'Reported by: ' || coalesce('@' || reporter, '(unknown)') || chr(10)
          || 'Report number: ' || new.id || chr(10) || chr(10)
          || 'What was copied when they reported it:' || chr(10)
          || coalesce(jsonb_pretty(new.context), '(nothing)') || chr(10) || chr(10)
          || 'When it is dealt with, mark it in the Supabase SQL editor:' || chr(10)
          || 'update app.reports set handled = true where id = ' || new.id || ';'));
  exception when others then
    raise warning 'report % was saved, but its email could not be queued: %', new.id, sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists alert_report on app.reports;
create trigger alert_report after insert on app.reports for each row execute function app.alert_report();

-- ---------------------------------------------------------------------------
-- who may call what
-- ---------------------------------------------------------------------------
-- Only signed-in people may call the app's functions. The two exceptions are
-- handle_available, which the sign-up screen needs before anyone has logged in,
-- and get_session, which simply answers "nobody" to someone who isn't.

revoke execute on all functions in schema public from public, anon;
revoke execute on all functions in schema app from public, anon, authenticated;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.handle_new_user() from authenticated;
grant execute on function public.handle_available(text) to anon, authenticated;
grant execute on function public.get_session() to anon, authenticated;
