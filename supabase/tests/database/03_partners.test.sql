-- Accountability partners: active, ended and late partners, strangers,
-- invitations, snapshots and notes.
begin;
\ir 00_helpers.sql.inc

select plan(40);

select tests.create_user('alice');  -- member
select tests.create_user('bob');    -- active partner (accepted before the publish)
select tests.create_user('dave');   -- ended partner
select tests.create_user('helen');  -- active partner accepted after the publish
select tests.create_user('carol');  -- stranger
select tests.create_user('frank');  -- member used for the invite flow
select tests.create_user('erin');
select tests.create_user('gina');

create or replace function tests.token_hash(t text) returns text language sql immutable
as $$ select encode(sha256(convert_to(t, 'UTF8')), 'hex') $$;

-- Alice's private data.
insert into public.goals (id, user_id, capital, title, kind, unit, target_value, shared_with_partners)
values ('a0000000-0000-0000-0000-000000000001', tests.uid('alice'), 'financial', 'Emergency fund', 'amount', 'UGX', 3000000, true);
insert into public.commitments (id, user_id, goal_id, week_start, title, measure, target_value)
values ('c0000000-0000-0000-0000-000000000001', tests.uid('alice'), 'a0000000-0000-0000-0000-000000000001', tests.week(), 'Save', 'quantity', 250000);
insert into public.activity_logs (id, user_id, goal_id, occurred_on, amount, note)
values ('10000000-0000-0000-0000-000000000001', tests.uid('alice'), 'a0000000-0000-0000-0000-000000000001', tests.week(), 250000, 'Private note');
insert into public.evidence (user_id, log_id, storage_path, mime_type, size_bytes)
values (tests.uid('alice'), '10000000-0000-0000-0000-000000000001',
        tests.uid('alice') || '/10000000-0000-0000-0000-000000000001/receipt.jpg', 'image/jpeg', 1000);
insert into public.milestones (user_id, goal_id, quarter_start, title)
values (tests.uid('alice'), 'a0000000-0000-0000-0000-000000000001', '2027-01-01', 'Q1');
insert into public.goal_checkins (user_id, goal_id, week_start, status)
values (tests.uid('alice'), 'a0000000-0000-0000-0000-000000000001', tests.week(), 'steady');

-- A published check-in (snapshot set by superuser, as the publish function will)
-- and an unpublished draft.
insert into public.reflections (id, user_id, period_type, period_start, wins, published_at, snapshot)
values ('e0000000-0000-0000-0000-000000000001', tests.uid('alice'), 'week', tests.week(-1), 'Live text',
        now() - interval '1 day',
        jsonb_build_object('v', 1, 'week_start', tests.week(-1), 'reflection', jsonb_build_object('wins', 'Frozen text')));
insert into public.reflections (id, user_id, period_type, period_start, wins)
values ('e0000000-0000-0000-0000-000000000002', tests.uid('alice'), 'week', tests.week(), 'Draft, not shared');

-- Alice's partnerships.
insert into public.partnerships (member_id, partner_id, invite_email, invite_token_hash, status, created_at, accepted_at)
values
  (tests.uid('alice'), tests.uid('bob'),   'bob@pakti.test',   tests.token_hash('tok-bob'),   'active', now() - interval '30 days', now() - interval '30 days'),
  (tests.uid('alice'), tests.uid('helen'), 'helen@pakti.test', tests.token_hash('tok-helen'), 'active', now(), now());
insert into public.partnerships (member_id, partner_id, invite_email, invite_token_hash, status, created_at, accepted_at, ended_at)
values (tests.uid('alice'), tests.uid('dave'), 'dave@pakti.test', tests.token_hash('tok-dave'), 'ended',
        now() - interval '60 days', now() - interval '60 days', now() - interval '2 days');

set local role authenticated;

-- ============================================================ active partner
select tests.claims_for('bob');

select is((select count(*)::int from public.partner_checkins()), 1, 'partner sees the one published check-in');
select is(
  (select snapshot #>> '{reflection,wins}' from public.partner_checkins()),
  'Frozen text', 'partner reads the frozen snapshot, not the live reflection text'
);
select is((select member_display_name from public.partner_checkins()), 'Alice', 'partner sees the member''s display name');
select is((select count(*)::int from public.reflections),   0, 'partner has no direct access to reflections');
select is((select count(*)::int from public.goals),         0, 'partner has no direct access to goals, even shared ones');
select is((select count(*)::int from public.commitments),   0, 'partner has no direct access to commitments');
select is((select count(*)::int from public.activity_logs), 0, 'partner has no direct access to activity logs');
select is((select count(*)::int from public.evidence),      0, 'partner has no direct access to evidence records');
select is((select count(*)::int from public.milestones),    0, 'partner has no direct access to milestones');
select is((select count(*)::int from public.goal_checkins), 0, 'partner has no direct access to goal status history');
select is((select count(*)::int from public.profiles where id = tests.uid('alice')), 0, 'partner has no direct access to the member''s profile');
select ok(public.can_partner_read_checkin('e0000000-0000-0000-0000-000000000001'), 'partner can read the published check-in');
select ok(not public.can_partner_read_checkin('e0000000-0000-0000-0000-000000000002'), 'partner cannot read the unpublished draft');

select lives_ok(
  $$ insert into public.partner_notes (reflection_id, body) values ('e0000000-0000-0000-0000-000000000001', 'Well done on saving!') $$,
  'partner leaves an encouragement note'
);
select throws_ok(
  $$ insert into public.partner_notes (reflection_id, body) values ('e0000000-0000-0000-0000-000000000001', 'Second note') $$,
  '23505', null, 'only one note per partner per check-in'
);
select throws_ok(
  $$ insert into public.partner_notes (reflection_id, body) values ('e0000000-0000-0000-0000-000000000002', 'Peeking') $$,
  '42501', null, 'partner cannot note an unpublished check-in'
);
select is(
  tests.rows_affected($$ update public.partner_notes set body = 'Well done!' $$),
  1, 'partner can edit their own note'
);
select is(
  (select other_display_name from public.my_partnerships() where role = 'i_support'),
  'Alice', 'partner sees whom they support'
);

-- ============================================================ ended partner
select tests.claims_for('dave');

select is((select count(*)::int from public.partner_checkins()), 0, 'ended partner sees no check-ins');
select throws_ok(
  $$ insert into public.partner_notes (reflection_id, body) values ('e0000000-0000-0000-0000-000000000001', 'Still here') $$,
  '42501', null, 'ended partner cannot leave notes'
);

-- ============================================================ late partner
select tests.claims_for('helen');

select is((select count(*)::int from public.partner_checkins()), 0, 'a new partner does not see check-ins published before they accepted');

-- ============================================================ stranger
select tests.claims_for('carol');

select is((select count(*)::int from public.partner_checkins()), 0, 'stranger sees no check-ins');
select throws_ok(
  $$ insert into public.partner_notes (reflection_id, body) values ('e0000000-0000-0000-0000-000000000001', 'Hi') $$,
  '42501', null, 'stranger cannot leave notes'
);
select is((select count(*)::int from public.partnerships), 0, 'stranger cannot see other people''s partnerships');
select is((select count(*)::int from public.partner_notes), 0, 'stranger cannot read notes');
select throws_ok(
  $$ select public.end_partnership((select id from public.partnerships limit 1)) $$,
  'P0002', null, 'stranger cannot end someone else''s partnership'
);

-- ============================================================ owner
select tests.claims_for('alice');

select is((select count(*)::int from public.partner_notes), 1, 'member reads the note left on their check-in');
select throws_ok(
  $$ update public.reflections set published_at = now() where id = 'e0000000-0000-0000-0000-000000000002' $$,
  '42501', null, 'member cannot set published_at directly'
);
select throws_ok(
  format($$ insert into public.reflections (period_type, period_start, published_at, snapshot)
            values ('week', %L, now(), '{"v":1}') $$, tests.week(-2)),
  '42501', null, 'member cannot insert a pre-published snapshot'
);
select throws_ok(
  $$ update public.partnerships set status = 'active' $$,
  '42501', null, 'member cannot change partnership status directly'
);
select throws_ok(
  $$ insert into public.partnerships (invite_email, invite_token_hash) values ('third@pakti.test', repeat('a', 64)) $$,
  '23514', null, 'no new invites once two partners are active'
);
select lives_ok(
  $$ select public.unpublish_checkin('e0000000-0000-0000-0000-000000000001') $$,
  'member can withdraw a published check-in'
);

select tests.claims_for('bob');
select is((select count(*)::int from public.partner_checkins()), 0, 'a withdrawn check-in disappears for partners at once');

-- ============================================================ invitations
select tests.claims_for('frank');

select lives_ok(
  format($$ insert into public.partnerships (invite_email, invite_token_hash) values
            ('erin@pakti.test', %L), ('frank@pakti.test', %L) $$,
         tests.token_hash('tok-erin'), tests.token_hash('tok-self')),
  'member creates invitations'
);
select throws_ok(
  $$ select public.accept_partner_invite('tok-self') $$,
  '23514', null, 'a member cannot accept their own invitation'
);

reset role;
insert into public.partnerships (member_id, invite_email, invite_token_hash, invite_expires_at)
values (tests.uid('frank'), 'gina@pakti.test', tests.token_hash('tok-expired'), now() - interval '1 day');
set local role authenticated;

select tests.claims_for('carol');
select throws_ok(
  $$ select public.accept_partner_invite('tok-erin') $$,
  '23514', null, 'an invitation cannot be accepted by a different email address'
);

select tests.claims_for('gina');
select throws_ok(
  $$ select public.accept_partner_invite('tok-expired') $$,
  '23514', null, 'an expired invitation cannot be accepted'
);

select tests.claims_for('erin');
select lives_ok($$ select public.accept_partner_invite('tok-erin') $$, 'the invited person accepts');
select throws_ok(
  $$ select public.accept_partner_invite('tok-erin') $$,
  '23514', null, 'an invitation can be used only once'
);
select lives_ok(
  $$ select public.end_partnership((select partnership_id from public.my_partnerships() where role = 'i_support')) $$,
  'a partner can end the partnership'
);

select * from finish();
rollback;
