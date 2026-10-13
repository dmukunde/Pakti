import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/chip";
import { requireOnboardedMember } from "@/lib/auth/current-member";
import { listGoals } from "@/lib/data/goals";
import { getUnfinishedFrom, getWeekPlan } from "@/lib/data/week";
import { capitalLabel } from "@/lib/domain/capitals";
import { addDays, quarterEnd, weekStart } from "@/lib/domain/dates";
import { formatAmount, formatDate } from "@/lib/domain/format";
import { tidyCeil } from "@/lib/domain/goals";
import { MAX_COMMITMENTS, SUGGESTED_COMMITMENTS } from "@/lib/domain/week";
import { bringForward, removeCommitment } from "./actions";
import { AddCommitment, type PlanGoal } from "./add-commitment";

export const metadata: Metadata = { title: "Plan the week" };

export default function PlanPage({ searchParams }: PageProps<"/week/plan">) {
  return (
    <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
      <Plan searchParams={searchParams} />
    </Suspense>
  );
}

async function Plan({ searchParams }: { searchParams: PageProps<"/week/plan">["searchParams"] }) {
  const member = await requireOnboardedMember();
  const current = weekStart(member.today);
  const next = (await searchParams).week === "next";
  const week = next ? addDays(current, 7) : current;

  const [plan, unfinished, goals] = await Promise.all([
    getWeekPlan(week, member.today),
    getUnfinishedFrom(week, member.today),
    listGoals(member.today),
  ]);
  const active = goals.filter((g) => g.status === "active");
  const count = plan.commitments.length;

  // Weekly hint for amount goals with a numeric quarter milestone.
  const weeksLeft = Math.max(1, Math.ceil((Date.parse(quarterEnd(week)) - Date.parse(week)) / (7 * 864e5)));
  const planGoals: PlanGoal[] = active.map((g) => ({
    id: g.id,
    title: g.title,
    capital: g.capital,
    kind: g.kind,
    unit: g.unit,
    is_primary: g.is_primary,
    weekly_target: g.weekly_target,
    weekly_minimum: g.weekly_minimum,
    weeklyHint:
      g.kind === "amount" && g.quarterProgress && g.quarterProgress.share < 1
        ? tidyCeil((g.quarterProgress.target - g.quarterProgress.actual) / weeksLeft)
        : null,
  }));
  const plannedTitles = new Set(plan.commitments.map((c) => `${c.goal_id}:${c.title}`));
  const toBring = unfinished.filter((c) => !plannedTitles.has(`${c.goal_id}:${c.title}`));

  return (
    <>
      <Link href="/week" className="inline-flex min-h-11 items-center text-sm text-primary">
        ← This Week
      </Link>
      <div>
        <p className="text-sm text-ink-muted">
          {next ? "Next week" : "This week"} · from {formatDate(week)}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">What matters this week?</h1>
        <p className="mt-2 text-ink-muted">
          Choose a few things that move your goals forward. Three is a strong week; five is the most. Goals you leave out
          are fine — focus is the point.
        </p>
      </div>

      {active.length === 0 ? (
        <Card title="Add a goal first">
          <p className="text-ink-muted">Commitments come from your goals.</p>
          <Link href="/goals/new" className="mt-3 inline-flex min-h-11 items-center font-medium text-primary">
            Add a goal
          </Link>
        </Card>
      ) : (
        <>
          {count > 0 && (
            <section aria-labelledby="planned" className="flex flex-col gap-3">
              <h2 id="planned" className="text-sm font-medium text-ink-muted">
                {count} of {MAX_COMMITMENTS}
                {count === SUGGESTED_COMMITMENTS ? " · Three is a strong week" : ""}
                {count === MAX_COMMITMENTS ? " · Five is the most — keep it doable" : ""}
              </h2>
              {plan.commitments.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">{c.title}</p>
                    <p className="text-sm text-ink-muted">
                      {c.measure === "done"
                        ? "Done or not"
                        : `${formatAmount(c.target_value ?? 0, c.displayUnit)}${c.minimum_value ? ` · at least ${formatAmount(c.minimum_value, c.displayUnit)}` : ""}`}
                    </p>
                    <div>
                      <Tag>{c.goal.title}</Tag>
                    </div>
                  </div>
                  <form action={removeCommitment}>
                    <input type="hidden" name="id" value={c.id} />
                    <Button type="submit" variant="quiet" aria-label={`Remove ${c.title}`} className="px-3 text-sm text-ink-muted">
                      Remove
                    </Button>
                  </form>
                </div>
              ))}
            </section>
          )}

          <AddCommitment goals={planGoals} week={week} full={count >= MAX_COMMITMENTS} />

          {toBring.length > 0 && count < MAX_COMMITMENTS && (
            <details className="rounded-2xl border border-line bg-surface px-4 py-3">
              <summary className="cursor-pointer font-medium">Unfinished from last week ({toBring.length})</summary>
              <ul className="mt-3 flex flex-col gap-2">
                {toBring.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3">
                    <span>
                      {c.title}
                      <span className="block text-sm text-ink-muted">{capitalLabel(c.goal.capital)}</span>
                    </span>
                    <form action={bringForward}>
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="week" value={week} />
                      <Button type="submit" variant="quiet" className="text-sm">
                        Bring forward
                      </Button>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          )}

          <Link
            href="/week"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 font-medium text-primary-ink hover:bg-primary-hover"
          >
            {count > 0 ? "Done planning" : "Back to This Week"}
          </Link>
          {!next && (
            <Link href="/week/plan?week=next" className="inline-flex min-h-11 items-center justify-center text-sm text-primary">
              Plan next week instead
            </Link>
          )}
        </>
      )}
    </>
  );
}
