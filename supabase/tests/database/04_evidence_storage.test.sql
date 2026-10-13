-- Private evidence storage: owner-only folders, no partner or stranger access.
begin;
\ir 00_helpers.sql.inc

select plan(10);

select tests.create_user('alice');  -- owner
select tests.create_user('bob');    -- active partner
select tests.create_user('carol');  -- stranger

insert into public.goals (id, user_id, capital, title, kind, unit, target_value)
values ('a0000000-0000-0000-0000-000000000001', tests.uid('alice'), 'financial', 'Emergency fund', 'amount', 'UGX', 3000000);
insert into public.activity_logs (id, user_id, goal_id, occurred_on, amount)
values ('10000000-0000-0000-0000-000000000001', tests.uid('alice'), 'a0000000-0000-0000-0000-000000000001', tests.week(), 250000);
insert into public.goals (id, user_id, capital, title, kind, weekly_target)
values ('b0000000-0000-0000-0000-000000000001', tests.uid('carol'), 'health', 'Exercise', 'habit', 3);
insert into public.activity_logs (id, user_id, goal_id, occurred_on)
values ('20000000-0000-0000-0000-000000000001', tests.uid('carol'), 'b0000000-0000-0000-0000-000000000001', tests.week());
insert into public.partnerships (member_id, partner_id, invite_email, invite_token_hash, status, accepted_at)
values (tests.uid('alice'), tests.uid('bob'), 'bob@pakti.test', repeat('b', 64), 'active', now());

select is(
  (select public from storage.buckets where id = 'evidence'),
  false, 'the evidence bucket is private'
);

set local role authenticated;

-- ============================================================ owner
select tests.claims_for('alice');

select lives_ok(
  format($$ insert into storage.objects (bucket_id, name, owner_id)
            values ('evidence', %L, %L) $$,
         tests.uid('alice') || '/10000000-0000-0000-0000-000000000001/receipt.jpg', tests.uid('alice')),
  'owner uploads evidence under their own log'
);
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name, owner_id)
            values ('evidence', %L, %L) $$,
         tests.uid('alice') || '/' || gen_random_uuid() || '/orphan.jpg', tests.uid('alice')),
  '42501', null, 'owner cannot upload under a log that does not exist'
);
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name, owner_id)
            values ('evidence', %L, %L) $$,
         tests.uid('carol') || '/20000000-0000-0000-0000-000000000001/planted.jpg', tests.uid('alice')),
  '42501', null, 'owner cannot upload into another member''s folder'
);
select is(
  (select count(*)::int from storage.objects where bucket_id = 'evidence'),
  1, 'owner can see their own evidence file'
);

-- ============================================================ partner
select tests.claims_for('bob');

select is(
  (select count(*)::int from storage.objects where bucket_id = 'evidence'),
  0, 'an active partner cannot see the member''s evidence files'
);
-- Deletion is blocked for everyone at the SQL level by Supabase's own
-- storage.protect_delete trigger; the partner delete attempt through the
-- Storage API is covered by src/test/evidence-storage.int.ts.
select is(
  tests.rows_affected($$ update storage.objects set name = name || '.moved' where bucket_id = 'evidence' $$),
  0, 'an active partner cannot alter the member''s evidence files'
);

-- ============================================================ stranger
select tests.claims_for('carol');

select is(
  (select count(*)::int from storage.objects where bucket_id = 'evidence'),
  0, 'a stranger cannot see the member''s evidence files'
);

-- ============================================================ anonymous
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is(
  (select count(*)::int from storage.objects where bucket_id = 'evidence'),
  0, 'anonymous visitors cannot see evidence files'
);
select throws_ok(
  format($$ insert into storage.objects (bucket_id, name) values ('evidence', %L) $$,
         tests.uid('alice') || '/10000000-0000-0000-0000-000000000001/anon.jpg'),
  '42501', null, 'anonymous visitors cannot upload evidence'
);

select * from finish();
rollback;
