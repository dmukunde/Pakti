import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireOnboardedMember } from "@/lib/auth/current-member";
import { getGoalStatuses, getNotesOn, getPartnerships, getWeeklyReflection } from "@/lib/data/checkins";
import { listGoals } from "@/lib/data/goals";
import { getWeekPlan } from "@/lib/data/week";
import { addDays, weekStart } from "@/lib/domain/dates";
import { formatDate } from "@/lib/domain/format";
import { isRecoveryWeek } from "@/lib/domain/week";
import { unpublishCheckin } from "./actions";
import { CheckinForm } from "./checkin-form";

export const metadata: Metadata = { title: "Weekly check-in" };

export default function CheckinPage({ searchParams }: PageProps<"/week/check-in">) {
  return (
    <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
      <Checkin searchParams={searchParams} />
    </Suspense>
  );
}

async function Checkin({ searchParams }: { searchParams: PageProps<"/week/check-in">["searchParams"] }) {
  const member = await requireOnboardedMember();
  const current = weekStart(member.today);
  const last = (await searchParams).week === "last";
  const week = last ? addDays(current, -7) : current;

  const [plan, reflection, goals, statuses, partnerships] = await Promise.all([
    getWeekPlan(week, member.today),
    getWeeklyReflection(week),
    listGoals(member.today),
    getGoalStatuses(week),
    getPartnerships(),
  ]);
  const notes = reflection?.published_at ? await getNotesOn(reflection.id) : [];

  const active = goals.filter((g) => g.status === "active");
  const sharedIds = new Set(active.filter((g) => g.shared_with_partners).map((g) => g.id));
  const inFocus = new Set(plan.commitments.map((c) => c.goal_id));
  const milestoneGoals = active
    .filter((g) => g.kind === "milestone" && (inFocus.has(g.id) || g.is_primary))
    .map((g) => ({ id: g.id, title: g.title, status: statuses[g.id] ?? null }));
  const partnerNames = partnerships
    .filter((p) => p.role === "supports_me" && p.status === "active")
    .map((p) => p.other_display_name || "Your partner");

  return (
    <>
      <Link href="/week" className="inline-flex min-h-11 items-center text-sm text-primary">
        ← This Week
      </Link>
      <div>
        <p className="text-sm text-ink-muted">
          {last ? "Last week" : "This week"} · from {formatDate(week)}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">Weekly check-in</h1>
        <p className="mt-2 text-ink-muted">What happened this week? A few honest lines are enough.</p>
        {!last && (
          <Link href="/week/check-in?week=last" className="mt-1 inline-flex min-h-11 items-center text-sm text-primary">
            Check in for last week instead
          </Link>
        )}
      </div>

      {reflection?.published_at && (
        <Card eyebrow="Published" title={`Shared with ${partnerNames.join(" and ") || "your partners"}`}>
          <p className="text-sm text-ink-muted">
            On {formatDate(reflection.published_at.slice(0, 10))}. Changes you make below stay private until you update it.
          </p>
          {notes.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-surface-muted px-3 py-2">
                  <p className="text-sm text-ink-muted">{n.authorName} wrote</p>
                  <p>{n.body}</p>
                </li>
              ))}
            </ul>
          )}
          <form action={unpublishCheckin} className="mt-2">
            <input type="hidden" name="id" value={reflection.id} />
            <Button type="submit" variant="quiet" className="px-0 text-sm text-ink-muted">
              Withdraw from partners
            </Button>
          </form>
        </Card>
      )}

      <CheckinForm
        week={week}
        weekLabel={formatDate(week)}
        recovery={isRecoveryWeek(plan.tally)}
        published={Boolean(reflection?.published_at)}
        values={{
          wins: reflection?.wins ?? "",
          challenges: reflection?.challenges ?? "",
          learned: reflection?.learned ?? "",
          support_needed: reflection?.support_needed ?? "",
          next_steps: reflection?.next_steps ?? "",
        }}
        commitments={plan.commitments.map((c) => ({
          id: c.id,
          title: c.title,
          goalTitle: c.goal.title,
          result: c.result,
          label: c.label,
          shared: sharedIds.has(c.goal_id),
        }))}
        milestoneGoals={milestoneGoals}
        sharedGoalTitles={active.filter((g) => g.shared_with_partners).map((g) => g.title)}
        partnerNames={partnerNames}
      />
    </>
  );
}
