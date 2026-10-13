-- Owner-only access, strangers, anonymous visitors and cross-member references.
begin;
\ir 00_helpers.sql.inc

select plan(30);

select tests.create_user('alice');  -- owner
select tests.create_user('carol');  -- stranger

-- Alice's private data, written as superuser.
insert into public.goals (id, user_id, capital, title, kind, unit, target_value)
values ('a0000000-0000-0000-0000-000000000001', tests.uid('alice'), 'financial', 'Emergency fund', 'amount', 'UGX', 3000000);
insert into public.milestones (user_id, goal_id, quarter_start, title)
values (tests.uid('alice'), 'a0000000-0000-0000-0000-000000000001', '2027-01-01', 'Q1 savings');
insert into public.goal_checkins (user_id, goal_id, week_start, status)
values (tests.uid('alice'), 'a0000000-0000-0000-0000-000000000001', tests.week(), 'steady');
insert into public.commitments (id, user_id, goal_id, week_start, title, measure, target_value)
values ('c0000000-0000-0000-0000-000000000001', tests.uid('alice'), 'a0000000-0000-0000-0000-000000000001', tests.week(), 'Save', 'quantity', 250000);
insert into public.activity_logs (id, user_id, goal_id, commitment_id, occurred_on, amount)
values ('10000000-0000-0000-0000-000000000001', tests.uid('alice'), 'a0000000-0000-0000-0000-000000000001',
        'c0000000-0000-0000-0000-000000000001', tests.week(), 250000);
insert into public.evidence (user_id, log_id, storage_path, mime_type, size_bytes)
values (tests.uid('alice'), '10000000-0000-0000-0000-000000000001',
        tests.uid('alice') || '/10000000-0000-0000-0000-000000000001/receipt.jpg', 'image/jpeg', 1000);
insert into public.reflections (user_id, period_type, period_start, wins)
values (tests.uid('alice'), 'week', tests.week(), 'Saved on time');

-- Carol's own goal and log, used for cross-reference attempts.
insert into public.goals (id, user_id, capital, title, kind, weekly_target)
values ('b0000000-0000-0000-0000-000000000001', tests.uid('carol'), 'health', 'Exercise', 'habit', 3);
insert into public.activity_logs (id, user_id, goal_id, occurred_on)
values ('20000000-0000-0000-0000-000000000001', tests.uid('carol'), 'b0000000-0000-0000-0000-000000000001', tests.week());

-- ============================================================ owner
set local role authenticated;
select tests.claims_for('alice');

select is((select count(*)::int from public.profiles),      1, 'owner sees exactly their own profile');
select is((select count(*)::int from public.goals),         1, 'owner sees their goal');
select is((select count(*)::int from public.milestones),    1, 'owner sees their milestone');
select is((select count(*)::int from public.goal_checkins), 1, 'owner sees their goal status history');
select is((select count(*)::int from public.commitments),   1, 'owner sees their commitment');
select is((select count(*)::int from public.activity_logs), 1, 'owner sees their log');
select is((select count(*)::int from public.evidence),      1, 'owner sees their evidence record');
select is((select count(*)::int from public.reflections),   1, 'owner sees their reflection');
select is(
  tests.rows_affected($$ update public.goals set title = 'Emergency fund 2027' $$),
  1, 'owner can edit their goal'
);

-- ============================================================ stranger
select tests.claims_for('carol');

select is((select count(*)::int from public.profiles      where id      = tests.uid('alice')), 0, 'stranger cannot read the owner''s profile');
select is((select count(*)::int from public.goals         where user_id = tests.uid('alice')), 0, 'stranger cannot read goals');
select is((select count(*)::int from public.milestones    where user_id = tests.uid('alice')), 0, 'stranger cannot read milestones');
select is((select count(*)::int from public.goal_checkins where user_id = tests.uid('alice')), 0, 'stranger cannot read goal status history');
select is((select count(*)::int from public.commitments   where user_id = tests.uid('alice')), 0, 'stranger cannot read commitments');
select is((select count(*)::int from public.activity_logs where user_id = tests.uid('alice')), 0, 'stranger cannot read logs');
select is((select count(*)::int from public.evidence      where user_id = tests.uid('alice')), 0, 'stranger cannot read evidence records');
select is((select count(*)::int from public.reflections   where user_id = tests.uid('alice')), 0, 'stranger cannot read reflections');

select is(
  tests.rows_affected($$ update public.goals set title = 'Hacked' where id = 'a0000000-0000-0000-0000-000000000001' $$),
  0, 'stranger cannot edit the owner''s goal'
);
select is(
  tests.rows_affected($$ delete from public.activity_logs where id = '10000000-0000-0000-0000-000000000001' $$),
  0, 'stranger cannot delete the owner''s log'
);
select throws_ok(
  format($$ insert into public.goals (user_id, capital, title, kind, weekly_target)
            values (%L, 'health', 'Planted goal', 'habit', 1) $$, tests.uid('alice')),
  '42501', null, 'stranger cannot create rows owned by someone else'
);

-- ============================================================ cross-member references
select throws_ok(
  $$ insert into public.milestones (goal_id, quarter_start, title)
     values ('a0000000-0000-0000-0000-000000000001', '2027-04-01', 'Attach to Alice') $$,
  '23503', null, 'cannot attach a milestone to another member''s goal'
);
select throws_ok(
  format($$ insert into public.goal_checkins (goal_id, week_start, status)
            values ('a0000000-0000-0000-0000-000000000001', %L, 'growing') $$, tests.week(-1)),
  '23503', null, 'cannot attach a goal status to another member''s goal'
);
select throws_ok(
  format($$ insert into public.commitments (goal_id, week_start, title, measure)
            values ('a0000000-0000-0000-0000-000000000001', %L, 'Attach to Alice', 'done') $$, tests.week()),
  '23503', null, 'cannot attach a commitment to another member''s goal'
);
select throws_ok(
  format($$ insert into public.activity_logs (goal_id, occurred_on)
            values ('a0000000-0000-0000-0000-000000000001', %L) $$, tests.week()),
  '23503', null, 'cannot log progress against another member''s goal'
);
select throws_ok(
  format($$ insert into public.activity_logs (goal_id, commitment_id, occurred_on)
            values ('b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', %L) $$, tests.week()),
  '23503', null, 'cannot link own log to another member''s commitment'
);
select throws_ok(
  format($$ insert into public.evidence (log_id, storage_path, mime_type, size_bytes)
            values ('10000000-0000-0000-0000-000000000001', %L, 'image/jpeg', 10) $$,
         tests.uid('carol') || '/10000000-0000-0000-0000-000000000001/x.jpg'),
  '23503', null, 'cannot attach evidence to another member''s log'
);
select throws_ok(
  format($$ insert into public.evidence (log_id, storage_path, mime_type, size_bytes)
            values ('20000000-0000-0000-0000-000000000001', %L, 'image/jpeg', 10) $$,
         tests.uid('alice') || '/20000000-0000-0000-0000-000000000001/x.jpg'),
  '23514', null, 'evidence path must sit in the owner''s own folder'
);
select throws_ok(
  format($$ update public.goals set user_id = %L where id = 'b0000000-0000-0000-0000-000000000001' $$, tests.uid('alice')),
  '42501', null, 'cannot hand a row over to another member'
);

-- ============================================================ anonymous
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select throws_ok($$ select * from public.goals $$,       '42501', null, 'anonymous visitors cannot read goals');
select throws_ok($$ select * from public.reflections $$, '42501', null, 'anonymous visitors cannot read reflections');

select * from finish();
rollback;
