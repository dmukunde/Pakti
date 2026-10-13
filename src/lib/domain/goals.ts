// Goal kinds and progress rules (architecture section 8). Everything here is
// calculated from raw logs; nothing is stored.
import { addDays, quarterEnd, quarterStart, type IsoDate } from "./dates";

export type GoalKind = "amount" | "habit" | "milestone";
export type GoalStatus = "active" | "achieved" | "paused" | "archived";
export type CheckinStatus = "growing" | "steady" | "needs_attention" | "done";

export const GOAL_KINDS: ReadonlyArray<{ key: GoalKind; label: string; hint: string; example: string }> = [
  {
    key: "amount",
    label: "An amount I’m working toward",
    hint: "Money saved, kilograms lost, kilometres, pages",
    example: "Save UGX 3,000,000 · Lose 10 kg",
  },
  {
    key: "habit",
    label: "Something I do regularly",
    hint: "A number of times each week",
    example: "Exercise 3 times a week (at least 2)",
  },
  {
    key: "milestone",
    label: "A milestone or a change",
    hint: "Done or not, or a quality you're growing",
    example: "Pass the certification · A closer family",
  },
];

export const CHECKIN_STATUS_LABELS: Record<CheckinStatus, string> = {
  growing: "Growing",
  steady: "Steady",
  needs_attention: "Needs attention",
  done: "Done",
};

export type GoalForProgress = {
  kind: GoalKind;
  target_value: number | null;
  start_date: IsoDate;
  target_date: IsoDate;
};

export type LogForProgress = {
  occurred_on: IsoDate;
  amount: number | null;
  /** The linked commitment's own unit; undefined when the log has no commitment. */
  commitment_unit?: string | null;
  has_commitment: boolean;
};

/**
 * A log counts toward its goal's totals when it has no commitment, or its
 * commitment measures in the goal's unit (commitment unit null). A log in a
 * commitment's own unit ("50 questions") counts only toward that commitment.
 */
export function isContributing(log: LogForProgress): boolean {
  return !log.has_commitment || log.commitment_unit == null;
}

/** Amount of one contributing log: its amount, or 1 for a count-style log. */
function value(goal: GoalForProgress, log: LogForProgress): number {
  if (goal.kind === "amount") return log.amount ?? 0;
  return log.amount ?? 1;
}

export function totalFor(goal: GoalForProgress, logs: LogForProgress[], from?: IsoDate, to?: IsoDate): number {
  return logs
    .filter(isContributing)
    .filter((l) => (!from || l.occurred_on >= from) && (!to || l.occurred_on <= to))
    .reduce((sum, l) => sum + value(goal, l), 0);
}

export type NumericProgress = {
  actual: number;
  target: number;
  /** 0..1, capped for display. */
  share: number;
  beyond: number;
};

export function numericProgress(actual: number, target: number | null): NumericProgress | null {
  if (!target || target <= 0) return null;
  return {
    actual,
    target,
    share: Math.min(1, actual / target),
    beyond: Math.max(0, actual - target),
  };
}

/**
 * Gentle pace for Amount goals: how much per week from today keeps the goal
 * on course. Never framed as a deficit.
 */
export function weeklyPace(goal: GoalForProgress, actual: number, today: IsoDate): number | null {
  if (goal.kind !== "amount" || !goal.target_value) return null;
  const remaining = goal.target_value - actual;
  if (remaining <= 0 || today > goal.target_date) return null;
  const daysLeft = (Date.parse(goal.target_date) - Date.parse(today)) / 864e5 + 1;
  const weeksLeft = Math.max(1, daysLeft / 7);
  return remaining / weeksLeft;
}

/** Quarters from the one containing `today` through the goal's target date. */
export function quartersRemaining(today: IsoDate, targetDate: IsoDate): number {
  let count = 0;
  for (let q = quarterStart(today); q <= targetDate; q = addDays(quarterEnd(q), 1)) count++;
  return Math.max(1, count);
}

/**
 * Suggested target for this quarter's milestone of an Amount goal: what is
 * still needed, spread evenly over the quarters left. Rounded to a tidy number.
 */
export function suggestedQuarterTarget(
  goal: GoalForProgress,
  actualBeforeQuarter: number,
  today: IsoDate,
): number | null {
  if (goal.kind !== "amount" || !goal.target_value) return null;
  const remaining = goal.target_value - actualBeforeQuarter;
  if (remaining <= 0) return null;
  return tidyCeil(remaining / quartersRemaining(today, goal.target_date));
}

/** Round up to a tidy step for the number's size: 742,300 -> 750,000; 1,234 -> 1,300; 2.4 -> 3. */
export function tidyCeil(raw: number): number {
  const step = raw >= 100000 ? 10000 : raw >= 1000 ? 100 : 1;
  return Math.ceil(raw / step) * step;
}
