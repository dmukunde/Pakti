-- Commitment results, publishing check-ins, and email-free invite links.
begin;
\ir 00_helpers.sql.inc

select plan(21);

select tests.create_user('alice');  -- member
select tests.create_user('bob');    -- partner
select tests.create_user('carol');  -- stranger
select tests.create_user('dan');    -- accepts an email-free link

-- Alice: a shared savings goal (numbers hidden) and a private habit goal.
insert into public.goals (id, user_id, capital, title, kind, unit, target_value, shared_with_partners, show_numbers)
values ('a0000000-0000-0000-0000-000000000001', tests.uid('alice'), 'financial', 'Emergency fund', 'amount', 'UGX', 1000000, true, false);
insert into public.goals (id, user_id, capital, title, kind, weekly_target, weekly_minimum)
values ('a0000000-0000-0000-0000-000000000002', tests.uid('alice'), 'health', 'Exercise', 'habit', 3, 2);
insert into public.commitments (id, user_id, goal_id, week_start, title, measure, target_value, minimum_value, position) values
  ('c0000000-0000-0000-0000-000000000001', tests.uid('alice'), 'a0000000-0000-0000-0000-000000000001', tests.week(), 'Save', 'quantity', 250000, 200000, 0),
  ('c0000000-0000-0000-0000-000000000002', tests.uid('alice'), 'a0000000-0000-0000-0000-000000000002', tests.week(), 'Exercise 3 times', 'quantity', 3, 2, 1);
insert into public.commitments (id, user_id, goal_id, week_start, title, measure, position)
values ('c0000000-0000-0000-0000-000000000003', tests.uid('alice'), 'a0000000-0000-0000-0000-000000000002', tests.week(), 'Book a gym slot', 'done', 2);
insert into public.activity_logs (user_id, goal_id, commitment_id, occurred_on, amount) values
  (tests.uid('alice'), 'a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', tests.week(), 200000),
  (tests.uid('alice'), 'a0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', tests.week(), null),
  (tests.uid('alice'), 'a0000000-0000-0000-0000-000000000001', null, tests.week(), 300000);
-- A shared weight goal with amounts shown and a decimal log.
insert into public.goals (id, user_id, capital, title, kind, unit, target_value, shared_with_partners, show_numbers)
values ('a0000000-0000-0000-0000-000000000003', tests.uid('alice'), 'health', 'Lose 10 kg', 'amount', 'kg', 10, true, true);
insert into public.activity_logs (user_id, goal_id, occurred_on, amount)
values (tests.uid('alice'), 'a0000000-0000-0000-0000-000000000003', tests.week(), 0.4);
insert into public.reflections (id, user_id, period_type, period_start, wins, support_needed)
values ('e0000000-0000-0000-0000-000000000001', tests.uid('alice'), 'week', tests.week(), 'Saved on time', 'A gym buddy');

-- Carol's commitment, to prove another member's ids are ignored.
insert into public.goals (id, user_id, capital, title, kind, weekly_target)
values ('b0000000-0000-0000-0000-000000000001', tests.uid('carol'), 'health', 'Walk', 'habit', 3);
insert into public.commitments (id, user_id, goal_id, week_start, title, measure)
values ('c0000000-0000-0000-0000-00000000000c', tests.uid('carol'), 'b0000000-0000-0000-0000-000000000001', tests.week(), 'Carol secret', 'done');

insert into public.partnerships (member_id, partner_id, invite_email, invite_token_hash, status, accepted_at)
values (tests.uid('alice'), tests.uid('bob'), 'bob@pakti.test', encode(sha256(convert_to('tok-bob', 'UTF8')), 'hex'), 'active', now() - interval '1 day');

set local role authenticated;

-- ============================================================ commitment_progress
select tests.claims_for('alice');

select is((select result from public.commitment_progress where id = 'c0000000-0000-0000-0000-000000000001'), 'within',
  'savings at 200,000 of 250,000 (minimum 200,000) is within minimum');
select is((select result from public.commitment_progress where id = 'c0000000-0000-0000-0000-000000000002'), 'below',
  'one session of three (minimum two) is below');
select is((select actual from public.commitment_progress where id = 'c0000000-0000-0000-0000-000000000002'), 1::numeric,
  'a habit log without an amount counts as one');
select is((select result from public.commitment_progress where id = 'c0000000-0000-0000-0000-000000000003'), 'below',
  'a done-type commitment with no log is below');
select is((select count(*)::int from public.commitment_progress), 3, 'the member sees only their own commitment results');

select tests.claims_for('carol');
select is((select count(*)::int from public.commitment_progress where user_id = tests.uid('alice')), 0,
  'a stranger cannot see another member''s commitment results');

-- ============================================================ publish_checkin
select tests.claims_for('carol');
select throws_ok(
  $$ select public.publish_checkin('e0000000-0000-0000-0000-000000000001', '{}') $$,
  'P0002', null, 'nobody can publish someone else''s check-in'
);

select tests.claims_for('alice');
select lives_ok(
  $$ select public.publish_checkin('e0000000-0000-0000-0000-000000000001',
       array['c0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-00000000000c']::uuid[]) $$,
  'the member publishes their check-in'
);

select tests.claims_for('bob');
select is((select jsonb_array_length(snapshot -> 'commitments') from public.partner_checkins()), 2,
  'only the ticked commitments of the member are included (another member''s id is ignored)');
select ok((select not (snapshot::text like '%Carol secret%') from public.partner_checkins()),
  'nothing from another member leaks into the snapshot');
select ok((select not (snapshot::text like '%Exercise 3 times%') from public.partner_checkins()),
  'unticked commitments stay private');
select is((select snapshot #> '{commitments,0}' ->> 'result' from public.partner_checkins()), 'within',
  'results in the snapshot come from the same calculation as the app');
select ok((select (snapshot #> '{commitments,0}' -> 'actual') = 'null'::jsonb from public.partner_checkins()),
  'amounts are hidden unless the goal shows numbers');
select is((select snapshot #> '{goals,0}' ->> 'progress_label' from public.partner_checkins()), '50% of the way',
  'a shared goal shows progress without amounts (500,000 of 1,000,000)');
select is((select jsonb_array_length(snapshot -> 'goals') from public.partner_checkins()), 2,
  'only shared goals are in the snapshot');
select is((select g ->> 'progress_label' from public.partner_checkins(), jsonb_array_elements(snapshot -> 'goals') g where g ->> 'title' = 'Lose 10 kg'),
  '0.4 of 10 kg', 'amounts with decimals are shown exactly when the goal shows numbers');
select is((select snapshot #>> '{reflection,support_needed}' from public.partner_checkins()), 'A gym buddy',
  'the partner sees the reflection');

-- The snapshot is frozen: later edits don't reach partners.
select tests.claims_for('alice');
update public.reflections set wins = 'Edited after publishing' where id = 'e0000000-0000-0000-0000-000000000001';
select tests.claims_for('bob');
select is((select snapshot #>> '{reflection,wins}' from public.partner_checkins()), 'Saved on time',
  'edits after publishing do not change what partners see');

-- ============================================================ invite links
select tests.claims_for('alice');
select lives_ok(
  format($$ insert into public.partnerships (invite_label, invite_token_hash) values ('Dan from church', %L) $$,
         encode(sha256(convert_to('tok-open', 'UTF8')), 'hex')),
  'a member creates an invite link without an email'
);

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select inviter_name from public.invite_preview('tok-open')), 'Alice',
  'someone holding the link sees who invited them before signing in');

reset role;
set local role authenticated;
select tests.claims_for('dan');
select lives_ok($$ select public.accept_partner_invite('tok-open') $$, 'anyone with an email-free link can accept it once');

select * from finish();
rollback;
