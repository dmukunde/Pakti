-- Pakti V1 · Migration 2 of 5 · Goals, quarterly milestones, goal status history
--
-- Child tables reference goals through (goal_id, user_id) composite foreign
-- keys. RLS `with check` only validates a row's own user_id, and foreign-key
-- checks bypass RLS, so without the composite key a member could attach rows
-- to someone else's goal by guessing its id.

-- ---------------------------------------------------------------------------
-- goals
-- ---------------------------------------------------------------------------
create table public.goals (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid()
                         references public.profiles (id) on delete cascade,
  capital              public.life_capital not null,
  title                text not null check (char_length(trim(title)) between 1 and 120),
  outcome              text check (char_length(outcome) <= 1000),
  why                  text check (char_length(why) <= 1000),
  kind                 text not null check (kind in ('amount', 'habit', 'milestone')),
  -- amount: required (UGX, km). habit: optional (sessions). milestone: none.
  unit                 text check (char_length(trim(unit)) between 1 and 30),
  -- amount: the annual total. habit: an optional yearly total.
  target_value         numeric check (target_value > 0),
  -- habit: times per week (required). amount: optional weekly pace.
  weekly_target        numeric check (weekly_target > 0),
  weekly_minimum       numeric check (weekly_minimum > 0),
  start_date           date not null default current_date,
  target_date          date not null
                         default (date_trunc('year', current_date) + interval '1 year - 1 day')::date,
  is_primary           boolean not null default false,
  reward               text check (char_length(reward) <= 300),
  shared_with_partners boolean not null default false,
  -- When shared, amounts appear in snapshots only if this is also on.
  show_numbers         boolean not null default false,
  status               text not null default 'active'
                         check (status in ('active', 'achieved', 'paused', 'archived')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint goals_id_user_key unique (id, user_id),
  constraint goals_dates check (target_date >= start_date),
  constraint goals_minimum_within_target check (
    weekly_minimum is null
    or (weekly_target is not null and weekly_minimum <= weekly_target)
  ),
  constraint goals_kind_shape check (
    case kind
      when 'amount'    then unit is not null and target_value is not null
      when 'habit'     then weekly_target is not null
      when 'milestone' then unit is null and target_value is null
                            and weekly_target is null and weekly_minimum is null
    end
  )
);

comment on table public.goals is 'Annual goals. Private by default; shared_with_partners only pre-ticks the goal at check-in publish time.';

-- One Big Goal per member per year (the year of its target date).
create unique index goals_one_primary_per_year
  on public.goals (user_id, (extract(year from target_date)))
  where is_primary and status <> 'archived';

create index goals_user_status_idx on public.goals (user_id, status);

create trigger goals_updated_at
  before update on public.goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- milestones: the 90-day plan, one per goal per calendar quarter.
-- ---------------------------------------------------------------------------
create table public.milestones (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid()
                  references public.profiles (id) on delete cascade,
  goal_id       uuid not null,
  quarter_start date not null check (public.is_quarter_start(quarter_start)),
  title         text not null check (char_length(trim(title)) between 1 and 160),
  target_value  numeric check (target_value > 0),
  reward        text check (char_length(reward) <= 300),
  achieved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint milestones_goal_fk foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete cascade,
  constraint milestones_one_per_quarter unique (goal_id, quarter_start)
);

create index milestones_user_quarter_idx on public.milestones (user_id, quarter_start);

create trigger milestones_updated_at
  before update on public.milestones
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- goal_checkins: weekly status history for Milestone (qualitative) goals.
-- ---------------------------------------------------------------------------
create table public.goal_checkins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid()
               references public.profiles (id) on delete cascade,
  goal_id    uuid not null,
  week_start date not null check (public.is_week_start(week_start)),
  status     text not null check (status in ('growing', 'steady', 'needs_attention', 'done')),
  note       text check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint goal_checkins_goal_fk foreign key (goal_id, user_id)
    references public.goals (id, user_id) on delete cascade,
  constraint goal_checkins_one_per_week unique (goal_id, week_start)
);

create index goal_checkins_user_week_idx on public.goal_checkins (user_id, week_start);

create trigger goal_checkins_updated_at
  before update on public.goal_checkins
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: owner-only. No partner policies on any of these tables.
-- ---------------------------------------------------------------------------
alter table public.goals         enable row level security;
alter table public.milestones    enable row level security;
alter table public.goal_checkins enable row level security;

revoke all on public.goals, public.milestones, public.goal_checkins from anon, authenticated;
grant select, insert, update, delete
  on public.goals, public.milestones, public.goal_checkins to authenticated;

create policy "goals: owner all"
  on public.goals for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "milestones: owner all"
  on public.milestones for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "goal_checkins: owner all"
  on public.goal_checkins for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
