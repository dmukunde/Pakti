-- Schema constraints, uniqueness and triggers. Runs as the member through RLS
-- so the rules are proven for real clients, not only for the superuser.
begin;
\ir 00_helpers.sql.inc

select plan(24);

select tests.create_user('alice');

-- Fixtures as superuser.
insert into public.goals (id, user_id, capital, title, kind, unit, target_value)
values ('a0000000-0000-0000-0000-000000000001', tests.uid('alice'), 'financial', 'Emergency fund', 'amount', 'UGX', 3000000);
insert into public.goals (id, user_id, capital, title, kind)
values ('a0000000-0000-0000-0000-000000000002', tests.uid('alice'), 'career', 'Certification', 'milestone');

set local role authenticated;
select tests.claims_for('alice');

-- ---------------------------------------------------------------- profiles
select is(
  (select display_name from public.profiles where id = tests.uid('alice')),
  'Alice',
  'profile is created on sign-up with the display name'
);
select throws_ok(
  $$ update public.profiles set timezone = 'Mars/Olympus' where id = tests.uid('alice') $$,
  '23514', null, 'unknown timezone is rejected'
);

-- ---------------------------------------------------------------- goals
select throws_ok(
  $$ insert into public.goals (capital, title, kind) values ('financial', 'No target', 'amount') $$,
  '23514', null, 'amount goal needs a unit and target'
);
select throws_ok(
  $$ insert into public.goals (capital, title, kind) values ('health', 'Exercise', 'habit') $$,
  '23514', null, 'habit goal needs a weekly target'
);
select throws_ok(
  $$ insert into public.goals (capital, title, kind, unit, target_value) values ('family', 'Kindness', 'milestone', 'pts', 10) $$,
  '23514', null, 'milestone goal cannot carry a numeric target'
);
select throws_ok(
  $$ insert into public.goals (capital, title, kind, weekly_target, weekly_minimum) values ('health', 'Run', 'habit', 2, 3) $$,
  '23514', null, 'weekly minimum cannot exceed weekly target'
);
select throws_ok(
  $$ insert into public.goals (capital, title, kind, weekly_target) values ('wealth', 'Bad capital', 'habit', 3) $$,
  '23514', null, 'capital must be one of the seven life capitals'
);
select lives_ok(
  $$ insert into public.goals (capital, title, kind, weekly_target, weekly_minimum, is_primary, target_date)
     values ('health', 'Exercise', 'habit', 3, 2, true, '2027-12-31') $$,
  'first primary goal for a year is accepted'
);
select throws_ok(
  $$ insert into public.goals (capital, title, kind, is_primary, target_date)
     values ('spiritual', 'Reading plan', 'milestone', true, '2027-06-30') $$,
  '23505', null, 'a second primary goal in the same year is rejected'
);
select lives_ok(
  $$ insert into public.goals (capital, title, kind, is_primary, start_date, target_date)
     values ('spiritual', 'Reading plan', 'milestone', true, '2028-01-01', '2028-12-31') $$,
  'a primary goal in a different year is accepted'
);

-- ---------------------------------------------------------------- milestones
select throws_ok(
  $$ insert into public.milestones (goal_id, quarter_start, title)
     values ('a0000000-0000-0000-0000-000000000001', '2027-02-01', 'Not a quarter') $$,
  '23514', null, 'milestone must start on a calendar quarter'
);
select lives_ok(
  $$ insert into public.milestones (goal_id, quarter_start, title, target_value)
     values ('a0000000-0000-0000-0000-000000000001', '2027-01-01', 'Q1 savings', 750000) $$,
  'milestone on a quarter start is accepted'
);
select throws_ok(
  $$ insert into public.milestones (goal_id, quarter_start, title)
     values ('a0000000-0000-0000-0000-000000000001', '2027-01-01', 'Duplicate') $$,
  '23505', null, 'only one milestone per goal per quarter'
);

-- ---------------------------------------------------------------- commitments
select throws_ok(
  format($$ insert into public.commitments (goal_id, week_start, title, measure)
            values ('a0000000-0000-0000-0000-000000000002', %L, 'Tuesday start', 'done') $$, tests.week() + 1),
  '23514', null, 'week_start must be a Monday'
);
select throws_ok(
  format($$ insert into public.commitments (goal_id, week_start, title, measure, target_value)
            values ('a0000000-0000-0000-0000-000000000002', %L, 'Done with target', 'done', 3) $$, tests.week()),
  '23514', null, 'done commitments carry no target'
);
select throws_ok(
  format($$ insert into public.commitments (goal_id, week_start, title, measure, target_value, minimum_value)
            values ('a0000000-0000-0000-0000-000000000001', %L, 'Save', 'quantity', 100, 200) $$, tests.week()),
  '23514', null, 'commitment minimum cannot exceed target'
);

-- Several commitments on one goal in one week are allowed.
select lives_ok(
  format($$ insert into public.commitments (id, goal_id, week_start, title, measure, position) values
            ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', %1$L, 'Complete Module 3', 'done', 0),
            ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', %1$L, 'Do 50 practice questions', 'done', 1),
            ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', %1$L, 'Attend revision session', 'done', 2) $$,
         tests.week()),
  'three commitments on the same goal in the same week are accepted'
);
select lives_ok(
  format($$ insert into public.commitments (goal_id, week_start, title, measure, target_value, minimum_value, position) values
            ('a0000000-0000-0000-0000-000000000001', %1$L, 'Save', 'quantity', 250000, 200000, 3),
            ('a0000000-0000-0000-0000-000000000001', %1$L, 'Review budget', 'done', null, null, 4) $$,
         tests.week()),
  'fourth and fifth commitments are accepted'
);
select throws_ok(
  format($$ insert into public.commitments (goal_id, week_start, title, measure)
            values ('a0000000-0000-0000-0000-000000000002', %L, 'Sixth', 'done') $$, tests.week()),
  '23514', null, 'a sixth commitment in the same week is rejected'
);
select lives_ok(
  format($$ insert into public.commitments (id, goal_id, week_start, title, measure)
            values ('c0000000-0000-0000-0000-000000000009', 'a0000000-0000-0000-0000-000000000002', %L, 'Last week', 'done') $$,
         tests.week(-1)),
  'commitments in another week are unaffected by this week''s cap'
);
select throws_ok(
  format($$ update public.commitments set week_start = %L where id = 'c0000000-0000-0000-0000-000000000009' $$, tests.week()),
  '23514', null, 'moving a commitment into a full week is rejected'
);

-- ---------------------------------------------------------------- activity logs
select throws_ok(
  format($$ insert into public.activity_logs (goal_id, commitment_id, occurred_on)
            values ('a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', %L) $$, tests.week(-1)),
  '23514', null, 'a log linked to a commitment must fall within that commitment''s week'
);
select throws_ok(
  format($$ insert into public.activity_logs (goal_id, occurred_on) values ('a0000000-0000-0000-0000-000000000001', %L) $$,
         current_date + 5),
  '23514', null, 'progress cannot be logged for a future date'
);
select throws_ok(
  format($$ insert into public.activity_logs (goal_id, commitment_id, occurred_on)
            values ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', %L) $$, tests.week()),
  '23503', null, 'a log cannot link a commitment that belongs to a different goal'
);

select * from finish();
rollback;
