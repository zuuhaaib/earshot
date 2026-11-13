-- The first, accounts-only version of schema.sql, kept so a test can prove the
-- current script upgrades a project that already ran this one.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null,
  name text not null,
  badge text not null default '?',
  badge_color text not null default '#F7A6BF',
  tagline text not null default '',
  bio text not null default '',
  home_city text not null default 'Toronto',
  created_at timestamptz not null default now(),
  constraint handle_shape check (handle ~ '^[a-z0-9._]{2,28}$')
);
create unique index if not exists profiles_handle_unique on public.profiles (lower(handle));
alter table public.profiles enable row level security;
drop policy if exists "profiles are readable by signed-in users" on public.profiles;
create policy "profiles are readable by signed-in users" on public.profiles for select to authenticated using (true);
drop policy if exists "people update their own profile" on public.profiles;
create policy "people update their own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, handle, name, badge, badge_color, home_city)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'handle'),
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), 'Listener'),
    coalesce(nullif(upper(left(new.raw_user_meta_data ->> 'badge', 2)), ''), '?'),
    coalesce(nullif(new.raw_user_meta_data ->> 'badge_color', ''), '#F7A6BF'),
    coalesce(nullif(new.raw_user_meta_data ->> 'home_city', ''), 'Toronto')
  );
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.handle_available(wanted text) returns boolean
language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.profiles where lower(handle) = lower(trim(wanted)));
$$;
revoke all on function public.handle_available(text) from public;
grant execute on function public.handle_available(text) to anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
