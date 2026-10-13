import { ProgressLine } from "@/components/ui/progress-line";
import type { GoalSummary } from "@/lib/data/goals";
import { formatAmount, formatNumber, formatProgress } from "@/lib/domain/format";
import { CHECKIN_STATUS_LABELS } from "@/lib/domain/goals";

// One calm line of progress for a goal. Numbers only where the goal has them;
// milestone goals show their latest status, never a percentage.
export function GoalProgress({ goal }: { goal: GoalSummary }) {
  if (goal.kind === "milestone") {
    return (
      <p className="text-sm text-ink-muted">
        {goal.status === "achieved"
          ? "Achieved"
          : goal.latestStatus
            ? CHECKIN_STATUS_LABELS[goal.latestStatus]
            : "No status yet — note how it's going at your weekly check-in."}
      </p>
    );
  }

  if (goal.kind === "habit") {
    const rhythm = `${formatNumber(goal.weekly_target ?? 0)} times a week${
      goal.weekly_minimum ? ` · at least ${formatNumber(goal.weekly_minimum)}` : ""
    }`;
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-ink-muted">{rhythm}</p>
        {goal.yearProgress && (
          <>
            <ProgressLine
              value={goal.yearProgress.actual}
              target={goal.yearProgress.target}
              label={`${formatProgress(goal.yearProgress.actual, goal.yearProgress.target, goal.unit)} this year`}
            />
            <p className="text-sm text-ink-muted">
              {formatProgress(goal.yearProgress.actual, goal.yearProgress.target, goal.unit)} this year
            </p>
          </>
        )}
      </div>
    );
  }

  const p = goal.yearProgress;
  if (!p) return null;
  return (
    <div className="flex flex-col gap-2">
      <ProgressLine
        value={p.actual}
        target={p.target}
        tone={p.share >= 1 ? "achieved" : "neutral"}
        label={formatProgress(p.actual, p.target, goal.unit)}
      />
      <p className="text-sm text-ink-muted">
        {formatProgress(p.actual, p.target, goal.unit)}
        {p.beyond > 0 ? ` · ${formatAmount(p.beyond, goal.unit)} beyond your target` : ` · ${Math.round(p.share * 100)}%`}
      </p>
    </div>
  );
}
