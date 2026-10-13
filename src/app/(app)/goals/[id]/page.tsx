import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { GoalProgress } from "@/components/goal-progress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/chip";
import { ProgressLine } from "@/components/ui/progress-line";
import { requireOnboardedMember } from "@/lib/auth/current-member";
import { getGoal } from "@/lib/data/goals";
import { capitalLabel } from "@/lib/domain/capitals";
import { quarterLabel, quarterStart } from "@/lib/domain/dates";
import { formatAmount, formatDate, formatProgress } from "@/lib/domain/format";
import { CHECKIN_STATUS_LABELS, weeklyPace } from "@/lib/domain/goals";
import { deleteGoal, setGoalStatus, setMilestoneAchieved } from "../actions";

export const metadata: Metadata = { title: "Goal" };

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
  const qLabel = quarterLabel(quarterStart(member.today));

  return (
    <>
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
              <li key={l.id} className="py-2">
                <p className="text-sm text-ink-muted">{formatDate(l.occurred_on)}</p>
                <p>
                  {l.description ?? "Logged"}
                  {l.amount !== null ? ` · ${formatAmount(l.amount, l.commitment_unit ?? goal.unit)}` : ""}
                </p>
                {l.note && <p className="text-sm text-ink-muted">{l.note}</p>}
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
    </>
  );
}
