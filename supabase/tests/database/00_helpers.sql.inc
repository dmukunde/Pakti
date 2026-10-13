-- Shared test helpers. Included at the top of each pgTAP file (\ir), inside
-- that file's transaction, so nothing persists after the test run.

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to authenticated, anon;

create table if not exists tests.users (name text primary key, id uuid not null);
grant select on tests.users to authenticated, anon;

-- Create an auth user (the profile is created by the on_auth_user_created trigger).
create or replace function tests.create_user(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at)
  values (new_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          p_name || '@pakti.test', jsonb_build_object('display_name', initcap(p_name)), now(), now());
  insert into tests.users (name, id) values (p_name, new_id);
  return new_id;
end;
$$;

create or replace function tests.uid(p_name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select id from tests.users where name = p_name $$;

grant execute on function tests.uid(text) to authenticated, anon;

-- Set the JWT claims for the next statements. Pair with `set local role authenticated;`.
create or replace function tests.claims_for(p_name text)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', tests.uid(p_name), 'role', 'authenticated')::text,
    true
  );
$$;

grant execute on function tests.claims_for(text) to authenticated, anon;

-- Run a statement as the current role and return how many rows it touched.
-- (Postgres forbids UPDATE/DELETE inside a sub-query, so assertions use this.)
create or replace function tests.rows_affected(p_sql text)
returns integer
language plpgsql
as $$
declare
  n integer;
begin
  execute p_sql;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function tests.rows_affected(text) to authenticated, anon;

-- Monday of the current week, and of earlier/later weeks.
create or replace function tests.week(p_offset integer default 0)
returns date
language sql
stable
as $$ select (date_trunc('week', current_date)::date + 7 * p_offset) $$;

grant execute on function tests.week(integer) to authenticated, anon;
