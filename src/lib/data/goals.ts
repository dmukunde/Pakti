import "server-only";
import type { LifeCapital } from "@/lib/domain/capitals";
import { quarterEnd, quarterStart, type IsoDate } from "@/lib/domain/dates";
import {
  numericProgress,
  totalFor,
  type CheckinStatus,
  type GoalKind,
  type GoalStatus,
  type LogForProgress,
  type NumericProgress,
} from "@/lib/domain/goals";
import { createClient } from "@/lib/supabase/server";

// All reads run as the signed-in member, so RLS limits them to their own rows.

export type Goal = {
  id: string;
  capital: LifeCapital;
  title: string;
  outcome: string | null;
  why: string | null;
  kind: GoalKind;
  unit: string | null;
  target_value: number | null;
  weekly_target: number | null;
  weekly_minimum: number | null;
  start_date: IsoDate;
  target_date: IsoDate;
  is_primary: boolean;
  reward: string | null;
  shared_with_partners: boolean;
  show_numbers: boolean;
  status: GoalStatus;
};

export type Milestone = {
  id: string;
  goal_id: string;
  quarter_start: IsoDate;
  title: string;
  target_value: number | null;
  reward: string | null;
  achieved_at: string | null;
};

export type GoalLog = LogForProgress & {
  id: string;
  description: string | null;
  note: string | null;
};

export type GoalSummary = Goal & {
  yearActual: number;
  yearProgress: NumericProgress | null;
  milestone: Milestone | null;
  quarterActual: number;
  quarterProgress: NumericProgress | null;
  milestoneReached: boolean;
  /** Reached because the logs met its target (not marked by hand). */
  milestoneReachedByLogs: boolean;
  latestStatus: CheckinStatus | null;
};

const GOAL_COLUMNS =
  "id, capital, title, outcome, why, kind, unit, target_value, weekly_target, weekly_minimum, start_date, target_date, is_primary, reward, shared_with_partners, show_numbers, status";

type RawLog = {
  id: string;
  goal_id: string;
  occurred_on: string;
  amount: number | null;
  description: string | null;
  note: string | null;
  commitment_id: string | null;
  commitment: { unit: string | null } | null;
};

function toLog(raw: RawLog): GoalLog {
  return {
    id: raw.id,
    occurred_on: raw.occurred_on,
    amount: raw.amount,
    description: raw.description,
    note: raw.note,
    has_commitment: raw.commitment_id !== null,
    commitment_unit: raw.commitment?.unit ?? null,
  };
}

function summarise(
  goal: Goal,
  logs: GoalLog[],
  milestone: Milestone | null,
  latestStatus: CheckinStatus | null,
  today: IsoDate,
): GoalSummary {
  const qStart = quarterStart(today);
  // Every log on the goal counts toward it, including ones back-dated before
  // the goal was created (members can log up to two weeks back).
  const yearActual = totalFor(goal, logs, undefined, goal.target_date);
  const quarterActual = totalFor(goal, logs, qStart, quarterEnd(qStart));
  const quarterProgress =
    goal.kind === "milestone" ? null : numericProgress(quarterActual, milestone?.target_value ?? null);
  return {
    ...goal,
    yearActual,
    yearProgress: goal.kind === "milestone" ? null : numericProgress(yearActual, goal.target_value),
    milestone,
    quarterActual,
    quarterProgress,
    // A numeric milestone is reached by its logs; others are marked by the member.
    milestoneReached: Boolean(milestone?.achieved_at) || (quarterProgress !== null && quarterProgress.share >= 1),
    milestoneReachedByLogs: !milestone?.achieved_at && quarterProgress !== null && quarterProgress.share >= 1,
    latestStatus,
  };
}

async function loadRelated(goalIds: string[], today: IsoDate) {
  const supabase = await createClient();
  const qStart = quarterStart(today);
  if (goalIds.length === 0) {
    return { logs: [] as RawLog[], milestones: [] as Milestone[], statuses: [] as Array<{ goal_id: string; status: CheckinStatus }> };
  }
  const [logs, milestones, statuses] = await Promise.all([
    supabase
      .from("activity_logs")
      .select("id, goal_id, occurred_on, amount, description, note, commitment_id, commitment:commitments!activity_logs_commitment_fk(unit)")
      .in("goal_id", goalIds)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("milestones")
      .select("id, goal_id, quarter_start, title, target_value, reward, achieved_at")
      .in("goal_id", goalIds)
      .eq("quarter_start", qStart),
    supabase
      .from("goal_checkins")
      .select("goal_id, status, week_start")
      .in("goal_id", goalIds)
      .order("week_start", { ascending: false }),
  ]);
  return {
    logs: (logs.data ?? []) as unknown as RawLog[],
    milestones: (milestones.data ?? []) as Milestone[],
    statuses: (statuses.data ?? []) as Array<{ goal_id: string; status: CheckinStatus }>,
  };
}

/** Active and achieved goals with calculated progress, Big Goal first. */
export async function listGoals(today: IsoDate, { includeArchived = false } = {}): Promise<GoalSummary[]> {
  const supabase = await createClient();
  let query = supabase.from("goals").select(GOAL_COLUMNS).order("is_primary", { ascending: false }).order("created_at");
  if (!includeArchived) query = query.neq("status", "archived");
  const { data } = await query;
  const goals = (data ?? []) as Goal[];

  const { logs, milestones, statuses } = await loadRelated(goals.map((g) => g.id), today);
  return goals.map((g) =>
    summarise(
      g,
      logs.filter((l) => l.goal_id === g.id).map(toLog),
      milestones.find((m) => m.goal_id === g.id) ?? null,
      statuses.find((s) => s.goal_id === g.id)?.status ?? null,
      today,
    ),
  );
}

export type GoalDetail = GoalSummary & {
  /** Every log for this goal, newest first. */
  logs: GoalLog[];
  recentLogs: GoalLog[];
  statusHistory: Array<{ week_start: IsoDate; status: CheckinStatus; note: string | null }>;
};

export async function getGoal(id: string, today: IsoDate): Promise<GoalDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("goals").select(GOAL_COLUMNS).eq("id", id).maybeSingle();
  if (!data) return null;
  const goal = data as Goal;

  const { logs, milestones, statuses } = await loadRelated([goal.id], today);
  const history = await supabase
    .from("goal_checkins")
    .select("week_start, status, note")
    .eq("goal_id", goal.id)
    .order("week_start", { ascending: false })
    .limit(13);

  const allLogs = logs.map(toLog);
  return {
    ...summarise(goal, allLogs, milestones[0] ?? null, statuses[0]?.status ?? null, today),
    logs: allLogs,
    recentLogs: allLogs.slice(0, 10),
    statusHistory: (history.data ?? []) as GoalDetail["statusHistory"],
  };
}
