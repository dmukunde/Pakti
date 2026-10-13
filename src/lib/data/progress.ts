import "server-only";
import { addDays, quarterEnd, quarterStart, weekStart, type IsoDate } from "@/lib/domain/dates";
import { focusDot, type FocusDot, type Result } from "@/lib/domain/week";
import { createClient } from "@/lib/supabase/server";
import { listGoals, type GoalSummary } from "./goals";

// The Progress screen: a calm look back over a quarter or a year. Read-only;
// everything is calculated from logs, commitment results (the shared
// commitment_progress view) and check-ins.

export type Period = "quarter" | "year";

export type GoalProgressRow = GoalSummary & {
  focusWeeks: number; // completed weeks this goal was in focus
  keptWeeks: number; // of those, weeks its commitments all reached at least the minimum
};

export type CapitalRow = { capital: GoalSummary["capital"]; goals: number; activeWeeks: number };

export type Moment = { date: IsoDate; kind: "win" | "learned" | "note"; text: string; goalTitle?: string };

export type ProgressData = {
  period: Period;
  from: IsoDate;
  to: IsoDate;
  weeks: Array<{ week: IsoDate; dot: FocusDot }>;
  plannedWeeks: number; // completed weeks with at least one commitment
  keptWeeks: number; // of those, weeks where every commitment reached its minimum
  actionsLogged: number;
  goals: GoalProgressRow[];
  capitals: CapitalRow[];
  moments: Moment[];
};

export function periodRange(period: Period, today: IsoDate): { from: IsoDate; to: IsoDate } {
  if (period === "quarter") {
    const from = quarterStart(today);
    return { from, to: quarterEnd(from) };
  }
  const year = today.slice(0, 4);
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export async function getProgress(period: Period, today: IsoDate): Promise<ProgressData> {
  const { from, to } = periodRange(period, today);
  const currentWeek = weekStart(today);
  const firstWeek = weekStart(from);

  const weekList: IsoDate[] = [];
  for (let w = firstWeek; w <= to; w = addDays(w, 7)) weekList.push(w);

  const supabase = await createClient();
  const [allGoals, results, logs, reflections, statuses] = await Promise.all([
    listGoals(today),
    supabase.from("commitment_progress").select("goal_id, week_start, result").gte("week_start", firstWeek).lte("week_start", to),
    supabase
      .from("activity_logs")
      .select("goal_id, occurred_on, note")
      .gte("occurred_on", from)
      .lte("occurred_on", to)
      .order("occurred_on", { ascending: false }),
    supabase
      .from("reflections")
      .select("period_start, wins, learned")
      .eq("period_type", "week")
      .gte("period_start", firstWeek)
      .lte("period_start", to)
      .order("period_start", { ascending: false }),
    supabase.from("goal_checkins").select("goal_id, week_start").gte("week_start", firstWeek).lte("week_start", to),
  ]);

  const commitmentResults = (results.data ?? []) as Array<{ goal_id: string; week_start: IsoDate; result: Result }>;
  const logRows = (logs.data ?? []) as Array<{ goal_id: string; occurred_on: IsoDate; note: string | null }>;
  const goals = allGoals.filter((g) => g.status !== "archived");
  const goalById = new Map(goals.map((g) => [g.id, g]));

  // Week dots across all commitments, like a goal page but for the whole life.
  const weeks = weekList.map((week) => ({ week, dot: focusDot(week, currentWeek, commitmentResults) }));
  const completed = weeks.filter((w) => w.week < currentWeek);
  const plannedWeeks = completed.filter((w) => w.dot !== "not_in_focus").length;
  const keptWeeks = completed.filter((w) => w.dot === "kept").length;

  const goalRows: GoalProgressRow[] = goals.map((g) => {
    const mine = commitmentResults.filter((r) => r.goal_id === g.id);
    const dots = weekList.filter((w) => w < currentWeek).map((w) => focusDot(w, currentWeek, mine));
    return {
      ...g,
      focusWeeks: dots.filter((d) => d !== "not_in_focus").length,
      keptWeeks: dots.filter((d) => d === "kept").length,
    };
  });

  // Life areas: goals, and weeks with at least one logged action.
  const byCapital = new Map<GoalSummary["capital"], { goals: number; weeks: Set<IsoDate> }>();
  for (const g of goals) {
    const entry = byCapital.get(g.capital) ?? { goals: 0, weeks: new Set<IsoDate>() };
    entry.goals++;
    byCapital.set(g.capital, entry);
  }
  for (const l of logRows) {
    const g = goalById.get(l.goal_id);
    if (g) byCapital.get(g.capital)?.weeks.add(weekStart(l.occurred_on));
  }
  // For milestone goals, noting how it is going at a check-in is activity too.
  for (const s of (statuses.data ?? []) as Array<{ goal_id: string; week_start: IsoDate }>) {
    const g = goalById.get(s.goal_id);
    if (g) byCapital.get(g.capital)?.weeks.add(s.week_start);
  }
  const capitals: CapitalRow[] = [...byCapital.entries()].map(([capital, v]) => ({
    capital,
    goals: v.goals,
    activeWeeks: v.weeks.size,
  }));

  // Wins and learnings, newest first: check-in answers and notes on logs.
  const moments: Moment[] = [];
  for (const r of (reflections.data ?? []) as Array<{ period_start: IsoDate; wins: string | null; learned: string | null }>) {
    const date = addDays(r.period_start, 6);
    if (r.wins) moments.push({ date, kind: "win", text: r.wins });
    if (r.learned) moments.push({ date, kind: "learned", text: r.learned });
  }
  for (const l of logRows) {
    if (l.note) moments.push({ date: l.occurred_on, kind: "note", text: l.note, goalTitle: goalById.get(l.goal_id)?.title });
  }
  moments.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  return {
    period,
    from,
    to,
    weeks,
    plannedWeeks,
    keptWeeks,
    actionsLogged: logRows.length,
    goals: goalRows,
    capitals,
    moments: moments.slice(0, 40),
  };
}
