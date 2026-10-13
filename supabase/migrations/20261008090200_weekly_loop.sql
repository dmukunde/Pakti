-- Pakti V1 · Migration 3 of 5 · Weekly commitments, activity logs, evidence
--
-- Ownership chain, enforced by composite foreign keys that include user_id:
--   goals (id, user_id)
--     -> commitments (goal_id, user_id)
--     -> activity_logs (commitment_id, goal_id, user_id)   -- commitment optional
--       -> evidence (log_id, user_id)
-- A log's commitment must therefore belong to the same goal and the same member.

-- ---------------------------------------------------------------------------
-- commitments: zero or more per goal per week; at most five per member per week.
-- ---------------------------------------------------------------------------
create table public.commitments (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                  references public.profiles (id) on delete cascade,
  goal_id       uuid not null,
  week_start    date not null check (public.is_week_start(week_start)),
  title         text not null check (char_length(trim(title)) between 1 and 160),
  measure       text not null check (measure in ('done', 'quantity')),
  -- quantity only. null = the goal's unit (counts toward goal totals);
  -- set = the commitment's own unit (counts only toward this commitment).
  unit          text check (char_length(trim(unit)) between 1 and 30),
  target_value  numeric check (target_value > 0),
  minimum_value numeric check (minimum_value > 0),
  position      smallint not null default 0 check (position >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint commitments_goal_fk foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete cascade,
  -- Target for the activity_logs composite foreign key.
  constraint commitments_id_goal_user_key unique (id, goal_id, user_id),
  constraint commitments_measure_shape check (
    case measure
      when 'done'     then unit is null and target_value is null and minimum_value is null
      when 'quantity' then target_value is not null
                           and (minimum_value is null or minimum_value <= target_value)
    end
  )
);

create index commitments_user_week_idx on public.commitments (user_id, week_start);
create index commitments_goal_idx      on public.commitments (goal_id);

create trigger commitments_updated_at
  before update on public.commitments
  for each row execute function public.set_updated_at();

-- At most five commitments per member per week. No lower limit.
-- Security definer so the count is exact regardless of the caller's RLS view;
-- an advisory lock serialises concurrent inserts for the same member and week.
create function public.enforce_commitment_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing integer;
begin
  if tg_op = 'UPDATE'
     and new.user_id = old.user_id
     and new.week_start = old.week_start then
    return new;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('pakti.commitments:' || new.user_id::text || ':' || new.week_start::text, 0)
  );

  select count(*) into existing
  from public.commitments c
  where c.user_id = new.user_id
    and c.week_start = new.week_start
    and c.id <> new.id;

  if existing >= 5 then
    raise exception 'A week can hold at most 5 commitments'
      using errcode = 'check_violation', hint = 'pakti_commitment_cap';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_commitment_cap() from public, anon, authenticated;

create trigger commitments_cap
  before insert or update of week_start, user_id on public.commitments
  for each row execute function public.enforce_commitment_cap();

-- A commitment cannot move to another week once logs are linked to it,
-- because those logs were validated against the original week.
create function public.guard_commitment_week()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.week_start <> old.week_start
     and exists (select 1 from public.activity_logs l where l.commitment_id = old.id) then
    raise exception 'This commitment already has logged progress, so its week cannot change'
      using errcode = 'check_violation', hint = 'pakti_commitment_week_locked';
  end if;
  return new;
end;
$$;

revoke execute on function public.guard_commitment_week() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- activity_logs: the only place progress is entered.
-- ---------------------------------------------------------------------------
create table public.activity_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                  references public.profiles (id) on delete cascade,
  goal_id       uuid not null,
  commitment_id uuid,
  -- The member's local date.
  occurred_on   date not null,
  description   text check (char_length(description) <= 160),
  -- null counts as 1 (habit) or as done.
  amount        numeric check (amount > 0),
  note          text check (char_length(note) <= 2000),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint activity_logs_goal_fk foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete cascade,
  -- MATCH SIMPLE: not checked when commitment_id is null. Deleting a commitment
  -- keeps the log and only clears the link.
  constraint activity_logs_commitment_fk foreign key (commitment_id, goal_id, user_id)
    references public.commitments (id, goal_id, user_id) on delete set null (commitment_id),
  -- Target for the evidence composite foreign key.
  constraint activity_logs_id_user_key unique (id, user_id)
);

create index activity_logs_user_date_idx on public.activity_logs (user_id, occurred_on);
create index activity_logs_goal_date_idx on public.activity_logs (goal_id, occurred_on);
create index activity_logs_commitment_idx on public.activity_logs (commitment_id)
  where commitment_id is not null;

create trigger activity_logs_updated_at
  before update on public.activity_logs
  for each row execute function public.set_updated_at();

create trigger commitments_week_guard
  before update of week_start on public.commitments
  for each row execute function public.guard_commitment_week();

-- Date validation:
--   * not in the future (one day of slack covers every UTC+ timezone);
--   * when linked to a commitment, inside that commitment's Monday-Sunday week.
create function public.validate_activity_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  commitment_week date;
begin
  if new.occurred_on > current_date + 1 then
    raise exception 'Progress cannot be logged for a future date'
      using errcode = 'check_violation', hint = 'pakti_log_future_date';
  end if;

  if new.commitment_id is not null then
    -- Only look at the caller's own commitment; the composite foreign key
    -- rejects anything else after this trigger.
    select c.week_start into commitment_week
    from public.commitments c
    where c.id = new.commitment_id
      and c.user_id = new.user_id;

    if commitment_week is not null
       and (new.occurred_on < commitment_week or new.occurred_on > commitment_week + 6) then
      raise exception 'A log linked to a commitment must fall within that commitment''s week'
        using errcode = 'check_violation', hint = 'pakti_log_outside_commitment_week';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.validate_activity_log() from public, anon, authenticated;

create trigger activity_logs_validate
  before insert or update of occurred_on, commitment_id on public.activity_logs
  for each row execute function public.validate_activity_log();

-- ---------------------------------------------------------------------------
-- evidence: private files attached to a log. Never shared in V1.
-- Files live in the private `evidence` bucket at {user_id}/{log_id}/{file}.
-- ---------------------------------------------------------------------------
create table public.evidence (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid()
                 references public.profiles (id) on delete cascade,
  log_id       uuid not null,
  storage_path text not null unique,
  mime_type    text not null check (mime_type in (
                 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf')),
  size_bytes   integer not null check (size_bytes > 0 and size_bytes <= 5242880),
  caption      text check (char_length(caption) <= 200),
  created_at   timestamptz not null default now(),

  constraint evidence_log_fk foreign key (log_id, user_id)
    references public.activity_logs (id, user_id) on delete cascade,
  constraint evidence_path_in_owner_folder check (
    starts_with(storage_path, user_id::text || '/' || log_id::text || '/')
    and char_length(storage_path) > char_length(user_id::text || '/' || log_id::text || '/')
    and position('..' in storage_path) = 0
  )
);

comment on table public.evidence is
  'Private record of progress. No sharing column and no partner path in V1. Deleting a row does not delete the stored file; the app removes the file first.';

create index evidence_log_idx on public.evidence (log_id);
create index evidence_user_idx on public.evidence (user_id);

-- ---------------------------------------------------------------------------
-- RLS: owner-only. No partner policies on any of these tables.
-- ---------------------------------------------------------------------------
alter table public.commitments   enable row level security;
alter table public.activity_logs enable row level security;
alter table public.evidence      enable row level security;

revoke all on public.commitments, public.activity_logs, public.evidence from anon, authenticated;
grant select, insert, update, delete on public.commitments, public.activity_logs to authenticated;
-- Evidence: no general update (see the caption-only grant below).
grant select, insert, delete on public.evidence to authenticated;

create policy "commitments: owner all"
  on public.commitments for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "activity_logs: owner all"
  on public.activity_logs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Evidence rows are immutable once written (delete and re-upload instead),
-- except the caption.
create policy "evidence: owner reads"
  on public.evidence for select to authenticated
  using (user_id = (select auth.uid()));

create policy "evidence: owner inserts"
  on public.evidence for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "evidence: owner updates caption"
  on public.evidence for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "evidence: owner deletes"
  on public.evidence for delete to authenticated
  using (user_id = (select auth.uid()));

grant update (caption) on public.evidence to authenticated;
