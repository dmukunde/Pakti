"use server";

import { refresh } from "next/cache";
import { requireOnboardedMember } from "@/lib/auth/current-member";
import { getGoal } from "@/lib/data/goals";
import { weekEnd, weekStart } from "@/lib/domain/dates";
import { formatAmount, formatProgress, parseAmount } from "@/lib/domain/format";
import { loggableDates, matchCommitment, type CommitmentLike } from "@/lib/domain/week";
import { createClient } from "@/lib/supabase/server";

export type LogResult = { ok: true; logId: string; message: string } | { ok: false; error: string };

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

export async function createLog(formData: FormData): Promise<LogResult> {
  const member = await requireOnboardedMember();
  const supabase = await createClient();

  const goalId = text(formData, "goal_id");
  const commitmentIdInput = text(formData, "commitment_id") || null;
  const occurredOn = text(formData, "occurred_on") || member.today;
  const description = text(formData, "description") || null;
  const note = text(formData, "note") || null;
  const rawAmount = parseAmount(formData.get("amount"));

  if (description && description.length > 160) return { ok: false, error: "Please keep the description short." };
  if (note && note.length > 2000) return { ok: false, error: "Please keep the note under 2000 characters." };
  if (!loggableDates(member.today).includes(occurredOn)) {
    return { ok: false, error: "You can log for today or the past two weeks." };
  }

  const { data: goal } = await supabase.from("goals").select("id, title, kind, unit").eq("id", goalId).maybeSingle();
  if (!goal) return { ok: false, error: "That goal wasn't found." };

  let commitment: (CommitmentLike & { goal_id: string }) | null = null;
  if (commitmentIdInput) {
    const { data } = await supabase
      .from("commitments")
      .select("id, goal_id, week_start, title, measure, unit, target_value, minimum_value")
      .eq("id", commitmentIdInput)
      .maybeSingle();
    if (!data || data.goal_id !== goal.id) return { ok: false, error: "That commitment wasn't found." };
    commitment = data as CommitmentLike;
    if (occurredOn < commitment.week_start || occurredOn > weekEnd(commitment.week_start)) {
      return { ok: false, error: "Choose a day within that commitment's week." };
    }
  }

  // Which amounts are required.
  let amount: number | null = null;
  // Counting a habit (no unit of its own): no number means one time.
  const countsTimes = goal.kind === "habit" && (!commitment || (commitment.measure === "quantity" && commitment.unit === null));
  const needsAmount = commitment ? commitment.measure === "quantity" && !countsTimes : goal.kind === "amount";
  const allowsAmount = commitment ? commitment.measure === "quantity" : goal.kind !== "milestone";
  if (rawAmount !== null && Number.isNaN(rawAmount)) return { ok: false, error: "Enter the amount as a number." };
  if (allowsAmount && rawAmount !== null) {
    if (rawAmount <= 0) return { ok: false, error: "Enter an amount above zero." };
    amount = rawAmount;
  }
  if (needsAmount && amount === null) return { ok: false, error: "How much? Enter the amount." };

  // Enter once: a goal-level log links itself to the one matching commitment.
  let commitmentId = commitment?.id ?? null;
  if (!commitment) {
    const { data } = await supabase
      .from("commitments")
      .select("id, goal_id, week_start, title, measure, unit, target_value, minimum_value")
      .eq("goal_id", goal.id)
      .eq("week_start", weekStart(occurredOn));
    // A habit log without a number is one session, so it matches counting commitments.
    commitmentId = matchCommitment({ amount: goal.kind === "habit" ? (amount ?? 1) : amount }, (data ?? []) as CommitmentLike[]);
  }

  const { data: inserted, error } = await supabase
    .from("activity_logs")
    .insert({ goal_id: goal.id, commitment_id: commitmentId, occurred_on: occurredOn, amount, description, note })
    .select("id")
    .single();
  if (error || !inserted) return { ok: false, error: "We couldn't save that just now. Please try again." };

  // A short confirmation that shows the roll-up, e.g. "UGX 250,000 saved — 1,750,000 of 3,000,000".
  const summary = await getGoal(goal.id, member.today);
  let message = "Logged.";
  if (commitment?.measure === "done" || (!commitment && goal.kind === "milestone")) {
    message = `${commitment?.title ?? goal.title} — logged.`;
  } else if (amount !== null) {
    const unit = commitment?.unit ?? goal.unit;
    message = `${formatAmount(amount, unit)} logged`;
    if (summary?.yearProgress && (!commitment || commitment.unit === null)) {
      message += ` — ${formatProgress(summary.yearProgress.actual, summary.yearProgress.target, goal.unit)}`;
    }
  } else {
    message = `${commitment?.title ?? goal.title} — logged.`;
  }

  refresh();
  return { ok: true, logId: inserted.id, message };
}

/** Delete a log and its private evidence files (files first: deleting rows doesn't delete files). */
export async function deleteLog(formData: FormData) {
  await requireOnboardedMember();
  const supabase = await createClient();
  const id = text(formData, "id");
  const { data: files } = await supabase.from("evidence").select("storage_path").eq("log_id", id);
  const paths = (files ?? []).map((f) => f.storage_path);
  if (paths.length) await supabase.storage.from("evidence").remove(paths);
  await supabase.from("activity_logs").delete().eq("id", id);
  refresh();
}
