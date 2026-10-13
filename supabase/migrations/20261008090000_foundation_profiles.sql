-- Pakti V1 · Migration 1 of 5 · Shared helpers and profiles
--
-- Principles that apply to every table in this schema:
--   * Every member-owned row carries user_id and cascades from profiles, which
--     cascades from auth.users, so deleting an account deletes everything.
--   * RLS is enabled on every table. Owner-only by default.
--   * Raw facts only. No stored totals, percentages or progress.
--   * Weeks are keyed by their Monday (week_start); quarters by their first day
--     (quarter_start). Neither is a table.

-- ---------------------------------------------------------------------------
-- Life capitals: a fixed list of seven. Labels live in application code.
-- ---------------------------------------------------------------------------
create domain public.life_capital as text
  check (value in (
    'spiritual', 'financial', 'intellectual', 'health',
    'family', 'career', 'contribution'
  ));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- True when d is a Monday (ISO weeks: Monday to Sunday).
create function public.is_week_start(d date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select extract(isodow from d) = 1;
$$;

-- True when d is the first day of a calendar quarter.
create function public.is_quarter_start(d date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select date_trunc('quarter', d::timestamp)::date = d;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one per auth user, created by trigger on sign-up.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  display_name   text not null default ''
                   check (char_length(display_name) <= 80),
  timezone       text not null default 'Africa/Kampala',
  vision         text check (char_length(vision) <= 2000),
  vision_why     text check (char_length(vision_why) <= 2000),
  focus_capitals public.life_capital[] not null default '{}',
  onboarded_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.profiles is
  'One row per member. Private to the member; partners only ever see display_name, via security-definer functions.';

create function public.validate_profile()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown timezone: %', new.timezone
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_validate
  before insert or update of timezone on public.profiles
  for each row execute function public.validate_profile();

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create the profile when an auth user is created.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(left(trim(new.raw_user_meta_data ->> 'display_name'), 80), '')
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: a member reads and edits only their own profile. Profiles are created by
-- the trigger above and deleted by deleting the auth user, so there is no
-- insert or delete policy.
alter table public.profiles enable row level security;

-- Explicit grants. The hosted project has automatic table exposure turned off,
-- so nothing is reachable through the Data API unless granted here. Grants
-- decide WHICH operations a role may attempt; RLS decides WHICH ROWS.
grant usage on schema public to authenticated;
revoke all on public.profiles from anon, authenticated;
grant select, update on public.profiles to authenticated;

-- Used by CHECK constraints, which run with the inserting member's rights.
grant execute on function public.is_week_start(date), public.is_quarter_start(date) to authenticated;
revoke execute on function public.set_updated_at(), public.validate_profile() from public, anon, authenticated;

create policy "profiles: owner reads"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: owner updates"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
