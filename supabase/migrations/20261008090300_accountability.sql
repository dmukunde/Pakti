-- Pakti V1 · Migration 4 of 5 · Reflections, partnerships, partner notes
--
-- Privacy model:
--   * Partners have NO select policy on any member table, reflections included.
--   * Partners read published check-ins only through partner_checkins(), a
--     security-definer function that returns the frozen snapshot and nothing else.
--   * published_at and snapshot cannot be written directly by members; they are
--     set by the publish function (built with the check-in screen) and cleared
--     by unpublish_checkin().
--   * A partner sees only check-ins published after they accepted, and loses
--     access the moment the partnership ends.

-- ---------------------------------------------------------------------------
-- reflections: weekly check-ins and quarter reviews (later: month, mid-year, year).
-- ---------------------------------------------------------------------------
create table public.reflections (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid()
                   references public.profiles (id) on delete cascade,
  period_type    text not null check (period_type in ('week', 'quarter')),
  period_start   date not null,
  wins           text check (char_length(wins) <= 2000),
  challenges     text check (char_length(challenges) <= 2000),
  learned        text check (char_length(learned) <= 2000),
  support_needed text check (char_length(support_needed) <= 2000),
  next_steps     text check (char_length(next_steps) <= 2000),
  published_at   timestamptz,
  -- Frozen copy of exactly what partners see. Set only at publish.
  snapshot       jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint reflections_one_per_period unique (user_id, period_type, period_start),
  constraint reflections_period_start_aligned check (
    (period_type = 'week'    and public.is_week_start(period_start))
    or (period_type = 'quarter' and public.is_quarter_start(period_start))
  ),
  constraint reflections_published_has_snapshot check ((published_at is null) = (snapshot is null)),
  constraint reflections_snapshot_shape check (
    snapshot is null
    or (jsonb_typeof(snapshot) = 'object' and snapshot ->> 'v' = '1')
  )
);

create index reflections_user_period_idx on public.reflections (user_id, period_start);
create index reflections_published_idx  on public.reflections (user_id, published_at)
  where published_at is not null;

create trigger reflections_updated_at
  before update on public.reflections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- partnerships: directional. partner_id supports member_id.
-- A mutual pair is two rows.
-- ---------------------------------------------------------------------------
create table public.partnerships (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid not null default auth.uid()
                      references public.profiles (id) on delete cascade,
  partner_id        uuid references public.profiles (id) on delete cascade,
  invite_email      text not null check (
                      invite_email = lower(trim(invite_email))
                      and char_length(invite_email) between 3 and 254
                      and position('@' in invite_email) > 1
                    ),
  -- sha256 hex of the single-use invite token; the token itself is never stored.
  invite_token_hash text not null unique check (invite_token_hash ~ '^[0-9a-f]{64}$'),
  invite_expires_at timestamptz not null default now() + interval '14 days',
  status            text not null default 'pending'
                      check (status in ('pending', 'active', 'ended')),
  created_at        timestamptz not null default now(),
  accepted_at       timestamptz,
  ended_at          timestamptz,

  constraint partnerships_not_self check (partner_id is null or partner_id <> member_id),
  constraint partnerships_active_shape check (
    status <> 'active' or (partner_id is not null and accepted_at is not null and ended_at is null)
  ),
  constraint partnerships_pending_shape check (
    status <> 'pending' or (partner_id is null and accepted_at is null and ended_at is null)
  ),
  constraint partnerships_ended_shape check (status <> 'ended' or ended_at is not null)
);

create unique index partnerships_one_active_per_pair
  on public.partnerships (member_id, partner_id) where status = 'active';
create unique index partnerships_one_pending_per_email
  on public.partnerships (member_id, invite_email) where status = 'pending';
create index partnerships_partner_idx on public.partnerships (partner_id) where partner_id is not null;

-- At most two active partners per member. New invites are refused once two
-- are active, so an invite can never be accepted into a full slot unnoticed.
create function public.enforce_partner_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_count integer;
begin
  if new.status not in ('pending', 'active') then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.status = old.status and new.member_id = old.member_id then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pakti.partnerships:' || new.member_id::text, 0)
  );

  select count(*) into active_count
  from public.partnerships p
  where p.member_id = new.member_id
    and p.status = 'active'
    and p.id <> new.id;

  if active_count >= 2 then
    raise exception 'A member can have at most 2 active accountability partners'
      using errcode = 'check_violation', hint = 'pakti_partner_cap';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_partner_cap() from public, anon, authenticated;

create trigger partnerships_cap
  before insert or update of status, member_id on public.partnerships
  for each row execute function public.enforce_partner_cap();

-- ---------------------------------------------------------------------------
-- partner_notes: one encouragement note per partner per published check-in.
-- ---------------------------------------------------------------------------
create table public.partner_notes (
  id            uuid primary key default gen_random_uuid(),
  reflection_id uuid not null references public.reflections (id) on delete cascade,
  author_id     uuid not null default auth.uid()
                  references public.profiles (id) on delete cascade,
  body          text not null check (char_length(trim(body)) between 1 and 500),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint partner_notes_one_per_partner unique (reflection_id, author_id)
);

create index partner_notes_author_idx on public.partner_notes (author_id);

create trigger partner_notes_updated_at
  before update on public.partner_notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access helpers (security definer: they read across members, return booleans
-- or the narrow shapes below, and always key on auth.uid()).
-- ---------------------------------------------------------------------------

-- Can the caller, as an active partner, read this published check-in?
create function public.can_partner_read_checkin(p_reflection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reflections r
    join public.partnerships p
      on p.member_id = r.user_id
     and p.partner_id = (select auth.uid())
     and p.status = 'active'
     and p.accepted_at <= r.published_at
    where r.id = p_reflection_id
      and r.published_at is not null
  );
$$;

revoke execute on function public.can_partner_read_checkin(uuid) from public, anon;
grant execute on function public.can_partner_read_checkin(uuid) to authenticated;

-- The partner read path: published snapshots of members the caller actively
-- supports. Returns no reflection text columns, only the frozen snapshot.
create function public.partner_checkins(p_member_id uuid default null)
returns table (
  reflection_id       uuid,
  member_id           uuid,
  member_display_name text,
  period_type         text,
  period_start        date,
  published_at        timestamptz,
  snapshot            jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.user_id, pr.display_name, r.period_type, r.period_start, r.published_at, r.snapshot
  from public.reflections r
  join public.partnerships p
    on p.member_id = r.user_id
   and p.partner_id = (select auth.uid())
   and p.status = 'active'
   and p.accepted_at <= r.published_at
  join public.profiles pr on pr.id = r.user_id
  where r.published_at is not null
    and (p_member_id is null or r.user_id = p_member_id)
  order by r.published_at desc;
$$;

revoke execute on function public.partner_checkins(uuid) from public, anon;
grant execute on function public.partner_checkins(uuid) to authenticated;

-- Partnerships the caller is part of, with the other person's display name.
-- This is the only way one member learns another's name.
create function public.my_partnerships()
returns table (
  partnership_id     uuid,
  role               text,   -- 'supports_me' or 'i_support'
  other_user_id      uuid,
  other_display_name text,
  invite_email       text,   -- only for invites the caller sent
  status             text,
  created_at         timestamptz,
  accepted_at        timestamptz,
  invite_expires_at  timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, 'supports_me', p.partner_id, pr.display_name, p.invite_email,
         p.status, p.created_at, p.accepted_at, p.invite_expires_at
  from public.partnerships p
  left join public.profiles pr on pr.id = p.partner_id
  where p.member_id = (select auth.uid())
    and p.status <> 'ended'
  union all
  select p.id, 'i_support', p.member_id, pr.display_name, null,
         p.status, p.created_at, p.accepted_at, null
  from public.partnerships p
  join public.profiles pr on pr.id = p.member_id
  where p.partner_id = (select auth.uid())
    and p.status = 'active';
$$;

revoke execute on function public.my_partnerships() from public, anon;
grant execute on function public.my_partnerships() to authenticated;

-- Accept an invite by its raw token. Single use, expires, and bound to the
-- email address it was sent to.
create function public.accept_partner_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller       uuid := auth.uid();
  caller_email text;
  invite       public.partnerships;
begin
  if caller is null then
    raise exception 'Sign in to accept an invitation' using errcode = '42501';
  end if;

  select * into invite
  from public.partnerships
  where invite_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
  for update;

  if not found or invite.status <> 'pending' or invite.invite_expires_at < now() then
    raise exception 'This invitation is no longer valid'
      using errcode = 'check_violation', hint = 'pakti_invite_invalid';
  end if;

  if invite.member_id = caller then
    raise exception 'You cannot be your own accountability partner'
      using errcode = 'check_violation', hint = 'pakti_invite_self';
  end if;

  select lower(u.email) into caller_email from auth.users u where u.id = caller;
  if caller_email is distinct from invite.invite_email then
    raise exception 'This invitation was sent to a different email address'
      using errcode = 'check_violation', hint = 'pakti_invite_wrong_email';
  end if;

  if exists (
    select 1 from public.partnerships p
    where p.member_id = invite.member_id and p.partner_id = caller and p.status = 'active'
  ) then
    raise exception 'You already support this member'
      using errcode = 'check_violation', hint = 'pakti_invite_duplicate';
  end if;

  update public.partnerships
     set partner_id = caller, status = 'active', accepted_at = now()
   where id = invite.id;

  return invite.id;
end;
$$;

revoke execute on function public.accept_partner_invite(text) from public, anon;
grant execute on function public.accept_partner_invite(text) to authenticated;

-- End (or cancel) a partnership. Either side may end it; access stops at once.
create function public.end_partnership(p_partnership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.partnerships
     set status = 'ended', ended_at = now()
   where id = p_partnership_id
     and status in ('pending', 'active')
     and (member_id = (select auth.uid()) or partner_id = (select auth.uid()));

  if not found then
    raise exception 'Partnership not found' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.end_partnership(uuid) from public, anon;
grant execute on function public.end_partnership(uuid) to authenticated;

-- Withdraw a published check-in. Partners stop seeing it immediately.
create function public.unpublish_checkin(p_reflection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.reflections
     set published_at = null, snapshot = null
   where id = p_reflection_id
     and user_id = (select auth.uid());

  if not found then
    raise exception 'Check-in not found' using errcode = 'no_data_found';
  end if;
end;
$$;

revoke execute on function public.unpublish_checkin(uuid) from public, anon;
grant execute on function public.unpublish_checkin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.reflections   enable row level security;
alter table public.partnerships  enable row level security;
alter table public.partner_notes enable row level security;

revoke all on public.reflections, public.partnerships, public.partner_notes from anon, authenticated;
-- Column-level insert/update grants for reflections and partner_notes follow
-- their policies below. partnerships has no update grant at all: accepting
-- and ending go through security-definer functions.
grant select, delete on public.reflections to authenticated;
grant select, insert, delete on public.partnerships to authenticated;
grant select, insert, delete on public.partner_notes to authenticated;

-- reflections: owner only. Partners have no policy here (see partner_checkins).
create policy "reflections: owner all"
  on public.reflections for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Members cannot set published_at or snapshot directly.
revoke insert, update on public.reflections from authenticated;
grant insert (id, user_id, period_type, period_start, wins, challenges, learned, support_needed, next_steps)
  on public.reflections to authenticated;
grant update (wins, challenges, learned, support_needed, next_steps)
  on public.reflections to authenticated;

-- partnerships: both sides can see the row; only the member creates invites;
-- the member may withdraw a pending invite. Accepting and ending go through
-- the functions above, so there is no update policy.
create policy "partnerships: either side reads"
  on public.partnerships for select to authenticated
  using (member_id = (select auth.uid()) or partner_id = (select auth.uid()));

create policy "partnerships: member creates invite"
  on public.partnerships for insert to authenticated
  with check (
    member_id = (select auth.uid())
    and status = 'pending'
    and partner_id is null
  );

create policy "partnerships: member withdraws pending invite"
  on public.partnerships for delete to authenticated
  using (member_id = (select auth.uid()) and status = 'pending');

revoke update on public.partnerships from authenticated;

-- partner_notes: the author writes while they can read the check-in; the
-- check-in's owner and the author can read it.
create policy "partner_notes: author or check-in owner reads"
  on public.partner_notes for select to authenticated
  using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.reflections r
      where r.id = partner_notes.reflection_id
        and r.user_id = (select auth.uid())
    )
  );

create policy "partner_notes: active partner writes"
  on public.partner_notes for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.can_partner_read_checkin(reflection_id)
  );

create policy "partner_notes: author edits while partner"
  on public.partner_notes for update to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and public.can_partner_read_checkin(reflection_id)
  );

create policy "partner_notes: author deletes"
  on public.partner_notes for delete to authenticated
  using (author_id = (select auth.uid()));

revoke update on public.partner_notes from authenticated;
grant update (body) on public.partner_notes to authenticated;
