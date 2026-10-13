"use server";

import { redirect } from "next/navigation";
import { requireOnboardedMember } from "@/lib/auth/current-member";
import { isLifeCapital } from "@/lib/domain/capitals";
import { quarterStart } from "@/lib/domain/dates";
import { parseAmount } from "@/lib/domain/format";
import type { GoalKind } from "@/lib/domain/goals";
import { createClient } from "@/lib/supabase/server";

export type GoalFormState = {
  error?: string;
  fields?: Partial<Record<string, string>>;
  /** What was submitted, so the form can refill after React resets it. */
  values?: Record<string, string>;
};

function submitted(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  return out;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function optional(formData: FormData, name: string): string | null {
  const v = text(formData, name);
  return v === "" ? null : v;
}

export async function saveGoal(_prev: GoalFormState, formData: FormData): Promise<GoalFormState> {
  const member = await requireOnboardedMember();
  const fields: Record<string, string> = {};

  const id = optional(formData, "id");
  const capital = text(formData, "capital");
  const title = text(formData, "title");
  const kind = text(formData, "kind") as GoalKind;

  if (!isLifeCapital(capital)) fields.capital = "Choose the part of life this goal belongs to.";
  if (title.length < 1) fields.title = "Give your goal a short name.";
  else if (title.length > 120) fields.title = "Please keep the name under 120 characters.";
  if (!["amount", "habit", "milestone"].includes(kind)) fields.kind = "Choose how you'll know you're progressing.";

  let unit: string | null = null;
  let target: number | null = null;
  let weeklyTarget: number | null = null;
  let weeklyMinimum: number | null = null;

  if (kind === "amount") {
    unit = optional(formData, "unit");
    target = parseAmount(formData.get("target_value"));
    if (!unit) fields.unit = "What are you counting? e.g. UGX, km, pages.";
    if (target === null || Number.isNaN(target) || target <= 0) fields.target_value = "Enter the total you're aiming for.";
  }
  if (kind === "habit") {
    unit = optional(formData, "unit");
    weeklyTarget = parseAmount(formData.get("weekly_target"));
    weeklyMinimum = parseAmount(formData.get("weekly_minimum"));
    target = parseAmount(formData.get("target_value"));
    if (weeklyTarget === null || Number.isNaN(weeklyTarget) || weeklyTarget <= 0)
      fields.weekly_target = "How many times a week?";
    if (weeklyMinimum !== null && (Number.isNaN(weeklyMinimum) || weeklyMinimum <= 0))
      fields.weekly_minimum = "Enter a number, or leave it empty.";
    else if (weeklyMinimum !== null && weeklyTarget !== null && weeklyMinimum > weeklyTarget)
      fields.weekly_minimum = "The minimum can't be more than the target.";
    if (target !== null && (Number.isNaN(target) || target <= 0)) fields.target_value = "Enter a number, or leave it empty.";
  }

  const targetDate = text(formData, "target_date") || `${member.today.slice(0, 4)}-12-31`;
  if (!ISO.test(targetDate)) fields.target_date = "Choose a target date.";

  const outcome = optional(formData, "outcome");
  const why = optional(formData, "why");
  const reward = optional(formData, "reward");
  if (outcome && outcome.length > 1000) fields.outcome = "Please keep this under 1000 characters.";
  if (why && why.length > 1000) fields.why = "Please keep this under 1000 characters.";
  if (reward && reward.length > 300) fields.reward = "Please keep the reward under 300 characters.";

  const milestoneTitle = optional(formData, "milestone_title");
  const milestoneReward = optional(formData, "milestone_reward");
  const milestoneTarget = kind === "milestone" ? null : parseAmount(formData.get("milestone_target"));
  if (milestoneTitle && milestoneTitle.length > 160) fields.milestone_title = "Please keep this under 160 characters.";
  if (milestoneTarget !== null && (Number.isNaN(milestoneTarget) || milestoneTarget <= 0))
    fields.milestone_target = "Enter a number, or leave it empty.";
  if (!milestoneTitle && (milestoneTarget !== null || milestoneReward))
    fields.milestone_title = "Name this quarter's milestone, or clear its target and reward.";

  if (Object.keys(fields).length > 0) {
    return { error: "A few things need a look.", fields, values: submitted(formData) };
  }

  const isPrimary = formData.get("is_primary") === "on";
  const shared = formData.get("shared_with_partners") === "on";
  const row = {
    capital,
    title,
    kind,
    unit,
    target_value: target,
    weekly_target: weeklyTarget,
    weekly_minimum: weeklyMinimum,
    outcome,
    why,
    reward,
    target_date: targetDate,
    is_primary: isPrimary,
    shared_with_partners: shared,
    show_numbers: shared && formData.get("show_numbers") === "on",
  };

  const supabase = await createClient();

  // One Big Goal per year: the new one takes over from any other that year.
  if (isPrimary) {
    const year = targetDate.slice(0, 4);
    let unset = supabase
      .from("goals")
      .update({ is_primary: false })
      .eq("is_primary", true)
      .gte("target_date", `${year}-01-01`)
      .lte("target_date", `${year}-12-31`);
    if (id) unset = unset.neq("id", id);
    await unset;
  }

  let goalId = id;
  if (id) {
    const { error } = await supabase.from("goals").update(row).eq("id", id);
    if (error) return { error: friendly(error.code), values: submitted(formData) };
  } else {
    const { data, error } = await supabase
      .from("goals")
      .insert({ ...row, start_date: member.today < targetDate ? member.today : targetDate })
      .select("id")
      .single();
    if (error || !data) return { error: friendly(error?.code), values: submitted(formData) };
    goalId = data.id;
  }

  // This quarter's milestone lives in the same form.
  const qStart = quarterStart(member.today);
  if (milestoneTitle) {
    const { error } = await supabase.from("milestones").upsert(
      {
        goal_id: goalId!,
        quarter_start: qStart,
        title: milestoneTitle,
        target_value: milestoneTarget,
        reward: milestoneReward,
      },
      { onConflict: "goal_id,quarter_start" },
    );
    if (error) return { error: "Your goal was saved, but this quarter's milestone wasn't. Please try again." };
  } else {
    await supabase.from("milestones").delete().eq("goal_id", goalId!).eq("quarter_start", qStart);
  }

  redirect(formData.get("welcome") === "1" ? "/week" : `/goals/${goalId}`);
}

function friendly(code: string | undefined): string {
  if (code === "23505") return "You already have a Big Goal for that year.";
  if (code === "23514") return "Some of these values don't fit together. Check the target and dates.";
  return "We couldn't save your goal just now. Please try again.";
}

export async function setGoalStatus(formData: FormData) {
  await requireOnboardedMember();
  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!["active", "achieved", "paused", "archived"].includes(status)) return;
  const supabase = await createClient();
  const update: { status: string; is_primary?: boolean } = { status };
  if (status === "archived") update.is_primary = false;
  await supabase.from("goals").update(update).eq("id", id);
  redirect(status === "archived" ? "/goals" : `/goals/${id}`);
}

export async function deleteGoal(formData: FormData) {
  await requireOnboardedMember();
  const id = text(formData, "id");
  if (formData.get("confirm") !== "yes") redirect(`/goals/${id}?confirm=delete`);
  const supabase = await createClient();
  // Cascades to milestones, commitments, logs and evidence rows. Deleting rows
  // does not delete stored files, so remove the goal's evidence files first.
  const { data: files } = await supabase
    .from("evidence")
    .select("storage_path, log:activity_logs!evidence_log_fk!inner(goal_id)")
    .eq("log.goal_id", id);
  const paths = (files ?? []).map((f) => f.storage_path);
  if (paths.length) await supabase.storage.from("evidence").remove(paths);
  await supabase.from("goals").delete().eq("id", id);
  redirect("/goals");
}

export async function setMilestoneAchieved(formData: FormData) {
  await requireOnboardedMember();
  const milestoneId = text(formData, "milestone_id");
  const goalId = text(formData, "goal_id");
  const achieved = formData.get("achieved") === "yes";
  const supabase = await createClient();
  await supabase
    .from("milestones")
    .update({ achieved_at: achieved ? new Date().toISOString() : null })
    .eq("id", milestoneId);
  redirect(`/goals/${goalId}`);
}
