// Weekly loop rules (architecture section 8). Commitment results come only
// from logs linked to that commitment; nothing is stored.
import { addDays, weekEnd, type IsoDate } from "./dates";
import { formatAmount } from "./format";

export const MAX_COMMITMENTS = 5;
export const SUGGESTED_COMMITMENTS = 3;
/** How far back a member may log. */
export const LOG_WINDOW_DAYS = 14;

export type Measure = "done" | "quantity";
export type Result = "achieved" | "within" | "below";

export type CommitmentLike = {
  id: string;
  goal_id: string;
  week_start: IsoDate;
  title: string;
  measure: Measure;
  /** null = the goal's unit. */
  unit: string | null;
  target_value: number | null;
  minimum_value: number | null;
};

export type LinkedLog = { commitment_id: string | null; amount: number | null };

/** Done-type: number of linked logs. Quantity: sum of amounts (a log without one counts as 1). */
export function commitmentActual(c: CommitmentLike, logs: LinkedLog[]): number {
  const mine = logs.filter((l) => l.commitment_id === c.id);
  if (c.measure === "done") return mine.length;
  return mine.reduce((sum, l) => sum + (l.amount ?? 1), 0);
}

export function commitmentResult(c: CommitmentLike, actual: number): Result {
  if (c.measure === "done") return actual >= 1 ? "achieved" : "below";
  const target = c.target_value ?? 0;
  const minimum = c.minimum_value ?? target;
  if (actual >= target) return "achieved";
  if (actual >= minimum) return "within";
  return "below";
}

/** Short status text. While the week is running, "below" is just "not yet". */
export function resultLabel(c: CommitmentLike, actual: number, result: Result, weekEnded: boolean, goalUnit: string | null): string {
  if (result === "achieved") return "Achieved";
  if (result === "within") return "Minimum reached";
  if (c.measure === "done") return weekEnded ? "Not done" : "Not yet";
  const unit = c.unit ?? goalUnit;
  const minimum = c.minimum_value ?? c.target_value ?? 0;
  if (weekEnded) return "Below minimum";
  const toMinimum = minimum - actual;
  return toMinimum > 0 ? `${formatAmount(toMinimum, unit)} to your minimum` : "Not yet";
}

export type WeekTally = { total: number; achieved: number; within: number; below: number };

export function tally(results: Result[]): WeekTally {
  return {
    total: results.length,
    achieved: results.filter((r) => r === "achieved").length,
    within: results.filter((r) => r === "within").length,
    below: results.filter((r) => r === "below").length,
  };
}

/** Most commitments ended below their minimum. No streaks, no shame: just a prompt to restart. */
export function isRecoveryWeek(t: WeekTally): boolean {
  return t.total > 0 && t.below > t.total / 2;
}

/** The one line under the greeting on This Week. */
export function weekStateLine(t: WeekTally, today: IsoDate, week: IsoDate): string {
  if (t.total === 0) return "Plan your week — a couple of things is enough.";
  if (t.achieved === t.total) return "Everything you planned, done.";
  if (t.below === 0) return "You kept your minimums. That's consistency.";
  const daysLeft = Math.max(0, (Date.parse(weekEnd(week)) - Date.parse(today)) / 864e5) + 1;
  if (daysLeft <= 1) return "Last day of the week. What's the smallest next step?";
  return `${daysLeft} days left. What's the smallest next step?`;
}

/**
 * Logging straight to a goal links the log to a commitment only when exactly
 * one of that goal's commitments this week measures the same thing: an amount
 * in the goal's unit, or a done-type commitment for a log with no amount.
 */
export function matchCommitment(
  log: { amount: number | null },
  goalCommitmentsThisWeek: CommitmentLike[],
): string | null {
  const candidates = goalCommitmentsThisWeek.filter((c) =>
    log.amount === null ? c.measure === "done" : c.measure === "quantity" && c.unit === null,
  );
  return candidates.length === 1 ? candidates[0].id : null;
}

/** Dates a member can log for: the last 14 days up to today, optionally inside one week. */
export function loggableDates(today: IsoDate, week?: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let i = 0; i < LOG_WINDOW_DAYS; i++) {
    const d = addDays(today, -i);
    if (week && (d < week || d > weekEnd(week))) continue;
    out.push(d);
  }
  return out;
}

export type FocusDot = "kept" | "some" | "missed" | "not_in_focus" | "upcoming";

/**
 * One dot per week for a goal: was it in focus (had a commitment) and how
 * did its commitments go? Weeks out of focus are never "missed".
 */
export function focusDot(
  week: IsoDate,
  currentWeek: IsoDate,
  commitments: CommitmentLike[],
  logs: LinkedLog[],
): FocusDot {
  if (week > currentWeek) return "upcoming";
  const mine = commitments.filter((c) => c.week_start === week);
  if (mine.length === 0) return "not_in_focus";
  const kept = mine.filter((c) => commitmentResult(c, commitmentActual(c, logs)) !== "below").length;
  if (kept === mine.length) return "kept";
  if (week === currentWeek) return kept > 0 ? "some" : "not_in_focus";
  return kept > 0 ? "some" : "missed";
}

/** Habit goals: was the weekly target/minimum met by the goal's contributing logs? */
export function habitWeekResult(count: number, weeklyTarget: number, weeklyMinimum: number | null): Result {
  if (count >= weeklyTarget) return "achieved";
  if (count >= (weeklyMinimum ?? weeklyTarget)) return "within";
  return "below";
}
