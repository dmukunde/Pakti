import "server-only";
import type { LifeCapital } from "@/lib/domain/capitals";
import { addDays, weekEnd, type IsoDate } from "@/lib/domain/dates";
import type { GoalKind } from "@/lib/domain/goals";
import {
  resultLabel,
  tally,
  type CommitmentLike,
  type Result,
  type WeekTally,
} from "@/lib/domain/week";
import { createClient } from "@/lib/supabase/server";

export type CommitmentView = CommitmentLike & {
  position: number;
  goal: { id: string; title: string; capital: LifeCapital; kind: GoalKind; unit: string | null; is_primary: boolean };
  actual: number;
  result: Result;
  label: string;
  /** The unit shown for this commitment: its own, or the goal's. */
  displayUnit: string | null;
};

export type WeekPlan = {
  week: IsoDate;
  commitments: CommitmentView[];
  tally: WeekTally;
};

type RawCommitment = CommitmentLike & {
  position: number;
  goal: CommitmentView["goal"] | null;
};

const COMMITMENT_COLUMNS =
  "id, goal_id, week_start, title, measure, unit, target_value, minimum_value, position, goal:goals!commitments_goal_fk(id, title, capital, kind, unit, is_primary)";

/** A week's commitments with results calculated from their linked logs. */
export async function getWeekPlan(week: IsoDate, today: IsoDate): Promise<WeekPlan> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("commitments")
    .select(COMMITMENT_COLUMNS)
    .eq("week_start", week)
    .order("position")
    .order("created_at");
  const raw = ((data ?? []) as unknown as RawCommitment[]).filter((c) => c.goal);

  // Results come from the one shared calculation (public.commitment_progress).
  const ids = raw.map((c) => c.id);
  const progress = ids.length
    ? ((await supabase.from("commitment_progress").select("id, actual, result").in("id", ids)).data ?? [])
    : [];
  const byId = new Map(progress.map((p) => [p.id, p]));

  const weekEnded = today > weekEnd(week);
  const commitments = raw.map((c) => {
    const actual = Number(byId.get(c.id)?.actual ?? 0);
    const result = (byId.get(c.id)?.result ?? "below") as Result;
    return {
      ...c,
      goal: c.goal!,
      actual,
      result,
      label: resultLabel(c, actual, result, weekEnded, c.goal!.unit),
      // Habits without a unit count times.
      displayUnit: c.unit ?? c.goal!.unit ?? (c.goal!.kind === "habit" ? "times" : null),
    };
  });
  return { week, commitments, tally: tally(commitments.map((c) => c.result)) };
}

/** Last week's commitments that weren't achieved, offered to bring forward (never automatic). */
export async function getUnfinishedFrom(week: IsoDate, today: IsoDate): Promise<CommitmentView[]> {
  const previous = await getWeekPlan(addDays(week, -7), today);
  return previous.commitments.filter((c) => c.result !== "achieved");
}

/** Commitment results for one goal across a range of weeks (for focus dots). */
export async function getGoalWeekResults(goalId: string, from: IsoDate, to: IsoDate) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("commitment_progress")
    .select("week_start, result")
    .eq("goal_id", goalId)
    .gte("week_start", from)
    .lte("week_start", to);
  return (data ?? []) as Array<{ week_start: IsoDate; result: Result }>;
}
