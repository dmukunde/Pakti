import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GoalProgress } from "@/components/goal-progress";
import { LogGoalButton, LogProvider } from "@/components/log/log-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/chip";
import { ProgressLine } from "@/components/ui/progress-line";
import { requireOnboardedMember } from "@/lib/auth/current-member";
import { getEvidenceForLogs } from "@/lib/data/evidence";
import { getGoal } from "@/lib/data/goals";
import { getGoalWeekResults, getWeekPlan } from "@/lib/data/week";
import { cn } from "@/lib/cn";
import { capitalLabel } from "@/lib/domain/capitals";
import { addDays, quarterEnd, quarterLabel, quarterStart, weekEnd, weekStart } from "@/lib/domain/dates";
import { formatAmount, formatDate, formatProgress } from "@/lib/domain/format";
import { CHECKIN_STATUS_LABELS, totalFor, weeklyPace } from "@/lib/domain/goals";
import { focusDot, habitWeekResult, type FocusDot } from "@/lib/domain/week";
import { deleteLog } from "../../log-actions";
import { deleteGoal, setGoalStatus, setMilestoneAchieved } from "../actions";

export const metadata: Metadata = { title: "Goal" };

const DOT_LABELS: Record<FocusDot, string> = {
  kept: "kept",
  some: "partly kept",
  missed: "below minimum",
  not_in_focus: "not in focus",
  upcoming: "still to come",
};

export default function GoalPage({ params, searchParams }: PageProps<"/goals/[id]">) {
  return (
    <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
      <GoalDetailView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function GoalDetailView({
  params,
  searchParams,
}: {
  params: PageProps<"/goals/[id]">["params"];
  searchParams: PageProps<"/goals/[id]">["searchParams"];
}) {
  const member = await requireOnboardedMember();
  const { id } = await params;
  const confirmDelete = (await searchParams).confirm === "delete";
  const goal = await getGoal(id, member.today);
  if (!goal) notFound();

  const pace = goal.status === "active" ? weeklyPace(goal, goal.yearActual, member.today) : null;
  const qStart = quarterStart(member.today);
  const qLabel = quarterLabel(qStart);
  const currentWeek = weekStart(member.today);

  // Weeks of this quarter, Monday-keyed, for the focus dots.
  const weeks: string[] = [];
  for (let w = weekStart(qStart); w <= quarterEnd(qStart); w = addDays(w, 7)) weeks.push(w);
  const [plan, focus, evidence] = await Promise.all([
    getWeekPlan(currentWeek, member.today),
    getGoalWeekResults(goal.id, weeks[0], weeks[weeks.length - 1]),
    getEvidenceForLogs(goal.recentLogs.map((l) => l.id)),
  ]);
  const dots = weeks.map((w) => ({ week: w, dot: focusDot(w, currentWeek, focus) }));

  // Habits: consistency over completed weeks that were in focus (never a streak).
  const focusWeeks = dots.filter((d) => d.week < currentWeek && d.dot !== "not_in_focus" && d.dot !== "upcoming");
  const keptHabitWeeks =
    goal.kind === "habit" && goal.weekly_target
      ? focusWeeks.filter(
          (d) => habitWeekResult(totalFor(goal, goal.logs, d.week, weekEnd(d.week)), goal.weekly_target!, goal.weekly_minimum) !== "below",
        ).length
      : 0;

  return (
    <LogProvider
      userId={member.id}
      today={member.today}
      goals={[{ id: goal.id, title: goal.title, kind: goal.kind, unit: goal.unit }]}
      commitments={plan.commitments
        .filter((c) => c.goal_id === goal.id)
        .map((c) => ({
          id: c.id,
          title: c.title,
          goal_id: c.goal_id,
          goalTitle: c.goal.title,
          week_start: c.week_start,
          measure: c.measure,
          displayUnit: c.displayUnit,
        }))}
    >
      <Link href="/goals" className="inline-flex min-h-11 items-center text-sm text-primary">
        ← Goals
      </Link>

      <div>
        <p className="text-sm text-ink-muted">
          {goal.is_primary ? "My Big Goal · " : ""}
          {capitalLabel(goal.capital)}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{goal.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {goal.status !== "active" && <Tag>{goal.status[0].toUpperCase() + goal.status.slice(1)}</Tag>}
          <Tag>{goal.shared_with_partners ? "Shared with partners" : "Private"}</Tag>
          <Tag>By {formatDate(goal.target_date)}</Tag>
        </div>
      </div>

      <Card title="Progress this year">
        <div className="flex flex-col gap-3">
          <GoalProgress goal={goal} />
          {pace && (
            <p className="text-sm text-ink-muted">
              About {formatAmount(Math.ceil(pace), goal.unit)} a week from now keeps you on course.
            </p>
          )}
          {goal.reward && <p className="text-sm text-ink-muted">Reward waiting: {goal.reward}</p>}
        </div>
      </Card>

      {goal.status === "active" && <LogGoalButton goalId={goal.id} />}

      <Card title={`Weeks in focus · ${qLabel}`}>
        <ol className="flex flex-wrap gap-2" aria-label="Weeks this quarter">
          {dots.map(({ week, dot }) => (
            <li key={week}>
              <span
                title={`Week of ${formatDate(week)}: ${DOT_LABELS[dot]}`}
                aria-label={`Week of ${formatDate(week)}: ${DOT_LABELS[dot]}`}
                className={cn(
                  "block size-4 rounded-full border",
                  dot === "kept" && "border-achieved bg-achieved",
                  dot === "some" && "border-within bg-within",
                  dot === "missed" && "border-below bg-transparent",
                  dot === "not_in_focus" && "border-line bg-surface-muted",
                  dot === "upcoming" && "border-dashed border-line bg-transparent",
                  week === currentWeek && "ring-2 ring-primary/40 ring-offset-2 ring-offset-surface",
                )}
              />
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-ink-muted">
          {goal.kind === "habit" && focusWeeks.length > 0
            ? `${keptHabitWeeks} of ${focusWeeks.length} focus weeks kept. `
            : ""}
          Filled: kept · Ochre: partly · Outline: below · Grey: not in focus, which is fine.
        </p>
      </Card>

      <Card title={`This quarter · ${qLabel}`}>
        {goal.milestone ? (
          <div className="flex flex-col gap-3">
            <p className="font-medium">{goal.milestone.title}</p>
            {goal.quarterProgress && (
              <>
                <ProgressLine
                  value={goal.quarterProgress.actual}
                  target={goal.quarterProgress.target}
                  tone={goal.quarterProgress.share >= 1 ? "achieved" : "neutral"}
                  label={`${formatProgress(goal.quarterProgress.actual, goal.quarterProgress.target, goal.unit)} this quarter`}
                />
                <p className="text-sm text-ink-muted">
                  {formatProgress(goal.quarterProgress.actual, goal.quarterProgress.target, goal.unit)} this quarter
                </p>
              </>
            )}
            {goal.milestoneReached && <p className="text-sm font-medium text-achieved">Milestone reached</p>}
            {goal.milestone.reward && (
              <p className="text-sm text-ink-muted">
                {goal.milestoneReached ? "Reward earned" : "Reward waiting"}: {goal.milestone.reward}
              </p>
            )}
            {/* Numeric milestones are reached by their logs; others by hand. */}
            {!goal.milestoneReachedByLogs && (
              <form action={setMilestoneAchieved}>
                <input type="hidden" name="milestone_id" value={goal.milestone.id} />
                <input type="hidden" name="goal_id" value={goal.id} />
                <input type="hidden" name="achieved" value={goal.milestone.achieved_at ? "no" : "yes"} />
                <Button type="submit" variant={goal.milestone.achieved_at ? "quiet" : "secondary"}>
                  {goal.milestone.achieved_at ? "Mark as not reached yet" : "Mark milestone reached"}
                </Button>
              </form>
            )}
          </div>
        ) : (
          <p className="text-ink-muted">
            No milestone for this quarter yet.{" "}
            <Link href={`/goals/${goal.id}/edit`} className="text-primary underline-offset-4 hover:underline">
              Add one
            </Link>
          </p>
        )}
      </Card>

      {(goal.outcome || goal.why) && (
        <Card title="Why this goal">
          <div className="flex flex-col gap-3">
            {goal.outcome && (
              <div>
                <p className="text-sm text-ink-muted">Desired outcome</p>
                <p className="whitespace-pre-line">{goal.outcome}</p>
              </div>
            )}
            {goal.why && (
              <div>
                <p className="text-sm text-ink-muted">Why it matters</p>
                <p className="whitespace-pre-line">{goal.why}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {goal.kind === "milestone" && goal.statusHistory.length > 0 && (
        <Card title="How it's been going">
          <ul className="flex flex-col gap-2">
            {goal.statusHistory.map((s) => (
              <li key={s.week_start} className="flex flex-col">
                <span className="text-sm text-ink-muted">Week of {formatDate(s.week_start)}</span>
                <span>
                  {CHECKIN_STATUS_LABELS[s.status]}
                  {s.note ? ` — ${s.note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="What you've done">
        {goal.recentLogs.length === 0 ? (
          <p className="text-ink-muted">Nothing logged yet. Progress you log during the week will appear here.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {goal.recentLogs.map((l) => (
              <li key={l.id} className="flex flex-col gap-1 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-ink-muted">{formatDate(l.occurred_on)}</p>
                    <p>
                      {l.description ?? "Logged"}
                      {l.amount !== null ? ` · ${formatAmount(l.amount, l.commitment_unit ?? goal.unit)}` : ""}
                    </p>
                  </div>
                  <form action={deleteLog}>
                    <input type="hidden" name="id" value={l.id} />
                    <button type="submit" className="min-h-11 px-2 text-sm text-ink-muted hover:text-ink" aria-label="Remove this log">
                      Remove
                    </button>
                  </form>
                </div>
                {l.note && <p className="text-sm text-ink-muted">{l.note}</p>}
                {(evidence[l.id] ?? []).length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-2" aria-label="Evidence (private)">
                    {evidence[l.id].map((e) => (
                      <li key={e.path}>
                        <a href={e.url} target="_blank" rel="noopener noreferrer" className="block">
                          {e.mime.startsWith("image/") && e.mime !== "image/heic" ? (
                            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not optimisable
                            <img src={e.url} alt="Evidence photo" className="size-16 rounded-lg border border-line object-cover" />
                          ) : (
                            <span className="grid size-16 place-items-center rounded-lg border border-line text-xs text-ink-muted">
                              {e.mime === "application/pdf" ? "PDF" : "File"}
                            </span>
                          )}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-col gap-3">
        <Link
          href={`/goals/${goal.id}/edit`}
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface px-5 font-medium hover:bg-surface-muted"
        >
          Edit goal
        </Link>
        <form action={setGoalStatus} className="contents">
          <input type="hidden" name="id" value={goal.id} />
          {goal.status === "active" && (
            <>
              <Button type="submit" name="status" value="achieved" variant="quiet" block>
                Mark goal achieved
              </Button>
              <Button type="submit" name="status" value="paused" variant="quiet" block>
                Pause this goal
              </Button>
            </>
          )}
          {goal.status !== "active" && (
            <Button type="submit" name="status" value="active" variant="quiet" block>
              Make active again
            </Button>
          )}
          {goal.status !== "archived" && (
            <Button type="submit" name="status" value="archived" variant="quiet" block>
              Archive
            </Button>
          )}
        </form>

        {confirmDelete ? (
          <form action={deleteGoal} className="flex flex-col gap-3 rounded-2xl border border-below/40 p-4">
            <input type="hidden" name="id" value={goal.id} />
            <input type="hidden" name="confirm" value="yes" />
            <p className="text-sm">
              Delete this goal and everything logged against it? This can&apos;t be undone. Archiving keeps your history
              instead.
            </p>
            <Button type="submit" variant="secondary" block>
              Yes, delete permanently
            </Button>
            <Link href={`/goals/${goal.id}`} className="inline-flex min-h-11 items-center justify-center text-primary">
              Keep it
            </Link>
          </form>
        ) : (
          <form action={deleteGoal}>
            <input type="hidden" name="id" value={goal.id} />
            <Button type="submit" variant="quiet" block className="text-ink-muted">
              Delete…
            </Button>
          </form>
        )}
      </div>
    </LogProvider>
  );
}
