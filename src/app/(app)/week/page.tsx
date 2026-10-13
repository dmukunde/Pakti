import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GoalProgress } from "@/components/goal-progress";
import { InstallHint } from "@/components/install-app";
import { LogButton, LogProvider } from "@/components/log/log-provider";
import { Card } from "@/components/ui/card";
import { ProgressLine } from "@/components/ui/progress-line";
import { requireOnboardedMember } from "@/lib/auth/current-member";
import { listGoals, type GoalSummary } from "@/lib/data/goals";
import { getWeekPlan } from "@/lib/data/week";
import { capitalLabel } from "@/lib/domain/capitals";
import { addDays, weekEnd, weekStart } from "@/lib/domain/dates";
import { formatDate, formatProgress } from "@/lib/domain/format";
import { isRecoveryWeek, weekStateLine } from "@/lib/domain/week";
import { CommitmentList } from "./commitment-list";

export const metadata: Metadata = { title: "This Week" };

export default function WeekPage() {
  return (
    <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
      <ThisWeek />
    </Suspense>
  );
}

/** The next reward waiting: a quarter milestone with a reward (Big Goal first), else the Big Goal's reward. */
function nextReward(goals: GoalSummary[]) {
  const ordered = [...goals].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const milestone = ordered.find((g) => g.milestone?.reward && !g.milestoneReached);
  if (milestone) return { goal: milestone, kind: "milestone" as const };
  const big = ordered.find((g) => g.is_primary && g.reward && g.status === "active");
  return big ? { goal: big, kind: "goal" as const } : null;
}

async function ThisWeek() {
  const member = await requireOnboardedMember();
  const week = weekStart(member.today);
  const [plan, lastWeek, allGoals] = await Promise.all([
    getWeekPlan(week, member.today),
    getWeekPlan(addDays(week, -7), member.today),
    listGoals(member.today),
  ]);
  const goals = allGoals.filter((g) => g.status === "active");
  const big = goals.find((g) => g.is_primary);
  const inFocus = new Set(plan.commitments.map((c) => c.goal_id));
  const notInFocus = goals.filter((g) => g !== big && !inFocus.has(g.id));
  const reward = nextReward(goals);
  const recovery = isRecoveryWeek(lastWeek.tally) && plan.tally.achieved === 0;
  const weekEnded = member.today > weekEnd(week);

  return (
    <LogProvider
      userId={member.id}
      today={member.today}
      goals={goals.map((g) => ({ id: g.id, title: g.title, kind: g.kind, unit: g.unit }))}
      commitments={plan.commitments.map((c) => ({
        id: c.id,
        title: c.title,
        goal_id: c.goal_id,
        goalTitle: c.goal.title,
        week_start: c.week_start,
        measure: c.measure,
        displayUnit: c.displayUnit,
      }))}
    >
      <div>
        <h1 className="text-2xl font-semibold">{member.displayName ? `Hello, ${member.displayName}` : "Hello"}</h1>
        <p className="mt-1 text-ink-muted">Week of {formatDate(week)}</p>
        <p className="mt-2 font-medium">{weekStateLine(plan.tally, member.today, week)}</p>
      </div>

      {recovery && (
        <Card eyebrow="A new week" title="Last week was a hard one. That's part of it.">
          <ul className="flex flex-col gap-1 text-ink-muted">
            <li>What got in the way?</li>
            <li>What did you learn?</li>
            <li>What&apos;s the smallest useful step this week?</li>
          </ul>
          {plan.tally.total === 0 && (
            <Link href="/week/plan" className="mt-3 inline-flex min-h-11 items-center font-medium text-primary">
              Plan one small step
            </Link>
          )}
        </Card>
      )}

      {big ? (
        <Link href={`/goals/${big.id}`} className="block rounded-2xl">
          <Card emphasis eyebrow={`My Big Goal · ${capitalLabel(big.capital)}`} title={big.title}>
            <div className="flex flex-col gap-3">
              <GoalProgress goal={big} />
              {big.milestone && (
                <p className="text-sm text-ink-muted">
                  This quarter: {big.milestone.title}
                  {big.milestoneReached ? " · reached" : ""}
                </p>
              )}
              {inFocus.has(big.id) && (
                <p className="text-sm text-ink-muted">
                  This week: {plan.commitments.filter((c) => c.goal_id === big.id).map((c) => c.title).join(" · ")}
                </p>
              )}
            </div>
          </Card>
        </Link>
      ) : (
        <Card title={goals.length ? "Choose your Big Goal" : "Set your first goal"}>
          <p className="text-ink-muted">
            {goals.length
              ? "Which goal matters most this year? Mark it as your Big Goal and it will lead this screen."
              : "Start with the one thing that matters most this year."}
          </p>
          <Link href={goals.length ? "/goals" : "/goals/new"} className="mt-3 inline-flex min-h-11 items-center font-medium text-primary">
            {goals.length ? "Go to goals" : "Add a goal"}
          </Link>
        </Card>
      )}

      {plan.tally.total === 0 ? (
        goals.length > 0 && (
          <Card title="What matters this week?">
            <p className="text-ink-muted">Choose a few commitments that move your goals forward. Three is a strong week.</p>
            <Link
              href="/week/plan"
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-5 font-medium text-primary-ink hover:opacity-90"
            >
              Plan my week
            </Link>
          </Card>
        )
      ) : (
        <section aria-labelledby="commitments" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 id="commitments" className="text-lg font-semibold">
              This week&apos;s commitments
            </h2>
            <Link href="/week/plan" className="min-h-11 content-center text-sm text-primary">
              Edit plan
            </Link>
          </div>
          <CommitmentList
            weekEnded={weekEnded}
            items={plan.commitments.map((c) => ({
              id: c.id,
              title: c.title,
              goalTitle: c.goal.title,
              measure: c.measure,
              displayUnit: c.displayUnit,
              target_value: c.target_value,
              minimum_value: c.minimum_value,
              actual: c.actual,
              result: c.result,
              label: c.label,
            }))}
          />
        </section>
      )}

      {notInFocus.length > 0 && (
        <p className="text-sm text-ink-muted">
          Also in your year: {notInFocus.map((g) => g.title).join(" · ")} — not in focus this week.
        </p>
      )}

      {reward && (
        <Card eyebrow="Next reward" title={reward.kind === "milestone" ? reward.goal.milestone!.reward! : reward.goal.reward!}>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink-muted">
              {reward.kind === "milestone"
                ? `When you reach: ${reward.goal.milestone!.title}`
                : `When you reach: ${reward.goal.title}`}
            </p>
            {(() => {
              const p = reward.kind === "milestone" ? reward.goal.quarterProgress : reward.goal.yearProgress;
              return p ? (
                <>
                  <ProgressLine value={p.actual} target={p.target} label={formatProgress(p.actual, p.target, reward.goal.unit)} />
                  <p className="text-sm text-ink-muted">{formatProgress(p.actual, p.target, reward.goal.unit)}</p>
                </>
              ) : null;
            })()}
          </div>
        </Card>
      )}

      <InstallHint />
      {goals.length > 0 && <LogButton />}
    </LogProvider>
  );
}
