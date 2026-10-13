-- Pakti V1 · Migration 6 · Check-in publishing and invite preview
--
-- 1. commitment_progress: the ONE place commitment results are calculated
--    (achieved / within / below). The app and published snapshots both read
--    it, so what partners see always matches what the member saw.
-- 2. publish_checkin(): freezes a check-in into reflections.snapshot. Members
--    cannot write published_at/snapshot directly (column grants), so this is
--    security definer and checks ownership itself.
-- 3. invite_preview(): lets an invitee see who invited them before accepting,
--    without exposing the partnerships table.

-- ---------------------------------------------------------------------------
-- 1. Commitment results
-- ---------------------------------------------------------------------------
create view public.commitment_progress
with (security_invoker = true)
as
select
  c.id,
  c.user_id,
  c.goal_id,
  c.week_start,
  a.actual,
  case
    when c.measure = 'done' then case when a.actual >= 1 then 'achieved' else 'below' end
    when a.actual >= c.target_value then 'achieved'
    when a.actual >= coalesce(c.minimum_value, c.target_value) then 'within'
    else 'below'
  end as result
from public.commitments c
cross join lateral (
  select case
           when c.measure = 'done' then count(l.id)::numeric
           else coalesce(sum(coalesce(l.amount, 1)), 0)
         end as actual
  from public.activity_logs l
  where l.commitment_id = c.id
) a;

comment on view public.commitment_progress is
  'Commitment actual and result from linked logs. security_invoker: RLS limits it to the caller''s own commitments.';

revoke all on public.commitment_progress from anon, authenticated;
grant select on public.commitment_progress to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Publishing a weekly check-in
-- ---------------------------------------------------------------------------
create function public.publish_checkin(p_reflection_id uuid, p_commitment_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  r public.reflections;
  v_commitments jsonb;
  v_goals jsonb;
begin
  select * into r from public.reflections where id = p_reflection_id and user_id = caller for update;
  if not found then
    raise exception 'Check-in not found' using errcode = 'no_data_found';
  end if;
  if r.period_type <> 'week' then
    raise exception 'Only weekly check-ins can be published' using errcode = 'check_violation';
  end if;

  -- Only commitments the member ticked, from that same week, that are theirs.
  -- Amounts appear only for goals shared with "show amounts" on.
  select coalesce(jsonb_agg(jsonb_build_object(
           'title', c.title,
           'goal_title', g.title,
           'capital', g.capital,
           'measure', c.measure,
           'unit', case when g.show_numbers then coalesce(c.unit, g.unit) end,
           'target', case when g.show_numbers then c.target_value end,
           'minimum', case when g.show_numbers then c.minimum_value end,
           'actual', case when g.show_numbers or c.measure = 'done' then p.actual end,
           'result', p.result
         ) order by c.position, c.created_at), '[]'::jsonb)
    into v_commitments
  from public.commitments c
  join public.goals g on g.id = c.goal_id
  join public.commitment_progress p on p.id = c.id
  where c.user_id = caller
    and c.week_start = r.period_start
    and c.id = any (coalesce(p_commitment_ids, '{}'::uuid[]));

  -- Goals the member marked as shared, with a progress label.
  select coalesce(jsonb_agg(jsonb_build_object(
           'title', g.title,
           'capital', g.capital,
           'kind', g.kind,
           'is_primary', g.is_primary,
           'progress_label', case
             when g.kind = 'milestone' then coalesce(
               (select initcap(replace(gc.status, '_', ' ')) from public.goal_checkins gc
                where gc.goal_id = g.id order by gc.week_start desc limit 1),
               case when g.status = 'achieved' then 'Achieved' else 'In progress' end)
             when g.target_value is null then 'Weekly habit'
             when g.show_numbers then
               rtrim(to_char(t.total, 'FM999,999,999,990.99'), '.') || ' of ' ||
               rtrim(to_char(g.target_value, 'FM999,999,999,990.99'), '.') || coalesce(' ' || g.unit, '')
             else least(100, round(t.total / g.target_value * 100))::text || '% of the way'
           end
         ) order by g.is_primary desc, g.created_at), '[]'::jsonb)
    into v_goals
  from public.goals g
  cross join lateral (
    select coalesce(sum(case when g.kind = 'amount' then coalesce(l.amount, 0) else coalesce(l.amount, 1) end), 0) as total
    from public.activity_logs l
    left join public.commitments lc on lc.id = l.commitment_id
    where l.goal_id = g.id
      and (l.commitment_id is null or lc.unit is null)
      and l.occurred_on <= g.target_date
  ) t
  where g.user_id = caller
    and g.shared_with_partners
    and g.status <> 'archived';

  update public.reflections
     set published_at = now(),
         snapshot = jsonb_build_object(
           'v', 1,
           'week_start', r.period_start,
           'reflection', jsonb_build_object(
             'wins', r.wins,
             'challenges', r.challenges,
             'learned', r.learned,
             'support_needed', r.support_needed,
             'next_steps', r.next_steps),
           'commitments', v_commitments,
           'goals', v_goals)
   where id = r.id;
end;
$$;

revoke execute on function public.publish_checkin(uuid, uuid[]) from public, anon;
grant execute on function public.publish_checkin(uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Invite links (like TutuSave): the member shares a secret link
--    themselves (WhatsApp, SMS). The email is optional; when given, only that
--    address can accept. An optional label reminds the member who it was for.
-- ---------------------------------------------------------------------------
alter table public.partnerships alter column invite_email drop not null;
alter table public.partnerships
  add column invite_label text check (char_length(trim(invite_label)) between 1 and 80);

create or replace function public.accept_partner_invite(p_token text)
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

  -- Bound to an address only when the member gave one.
  if invite.invite_email is not null then
    select lower(u.email) into caller_email from auth.users u where u.id = caller;
    if caller_email is distinct from invite.invite_email then
      raise exception 'This invitation was sent to a different email address'
        using errcode = 'check_violation', hint = 'pakti_invite_wrong_email';
    end if;
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

-- my_partnerships() gains the invite label (return type changes, so recreate).
drop function public.my_partnerships();
create function public.my_partnerships()
returns table (
  partnership_id     uuid,
  role               text,   -- 'supports_me' or 'i_support'
  other_user_id      uuid,
  other_display_name text,
  invite_email       text,   -- only for invites the caller sent
  invite_label       text,   -- only for invites the caller sent
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
  select p.id, 'supports_me', p.partner_id, pr.display_name, p.invite_email, p.invite_label,
         p.status, p.created_at, p.accepted_at, p.invite_expires_at
  from public.partnerships p
  left join public.profiles pr on pr.id = p.partner_id
  where p.member_id = (select auth.uid())
    and p.status <> 'ended'
    and (p.status = 'active' or p.invite_expires_at > now())
  union all
  select p.id, 'i_support', p.member_id, pr.display_name, null, null,
         p.status, p.created_at, p.accepted_at, null
  from public.partnerships p
  join public.profiles pr on pr.id = p.member_id
  where p.partner_id = (select auth.uid())
    and p.status = 'active';
$$;

revoke execute on function public.my_partnerships() from public, anon;
grant execute on function public.my_partnerships() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Invite preview
-- ---------------------------------------------------------------------------
-- Given the secret token from an invite link, returns who sent it and whether
-- it can still be accepted. Reveals nothing without the token.
create function public.invite_preview(p_token text)
returns table (inviter_name text, invited_email text, valid boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select pr.display_name,
         p.invite_email,
         p.status = 'pending' and p.invite_expires_at > now()
  from public.partnerships p
  join public.profiles pr on pr.id = p.member_id
  where p.invite_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

revoke execute on function public.invite_preview(text) from public;
grant execute on function public.invite_preview(text) to anon, authenticated;
