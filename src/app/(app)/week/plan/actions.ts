"use server";

import { refresh } from "next/cache";
import { requireOnboardedMember } from "@/lib/auth/current-member";
import { addDays, weekStart } from "@/lib/domain/dates";
import { parseAmount } from "@/lib/domain/format";
import { createClient } from "@/lib/supabase/server";

export type CommitmentFormState = {
  ok?: boolean;
  error?: string;
  fields?: Partial<Record<string, string>>;
  values?: Record<string, string>;
};

const CAP_MESSAGE = "Five is the most for one week — keep it doable. Remove one to add another.";

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

/** Members plan the current week or the next one. */
function allowedWeek(requested: string, today: string): string | null {
  const current = weekStart(today);
  const next = addDays(current, 7);
  return requested === current || requested === next ? requested : null;
}

function isCapError(error: { hint?: string | null; message?: string } | null): boolean {
  return Boolean(error && (error.hint === "pakti_commitment_cap" || error.message?.includes("at most 5 commitments")));
}

export async function saveCommitment(_prev: CommitmentFormState, formData: FormData): Promise<CommitmentFormState> {
  const member = await requireOnboardedMember();
  const values = Object.fromEntries([...formData.entries()].filter(([k, v]) => typeof v === "string" && !k.startsWith("$"))) as Record<string, string>;
  const fields: Record<string, string> = {};

  const week = allowedWeek(text(formData, "week"), member.today);
  const goalId = text(formData, "goal_id");
  const title = text(formData, "title");
  const measure = text(formData, "measure");
  if (!week) return { error: "You can plan this week or next week." };
  if (!goalId) fields.goal_id = "Which goal does this serve?";
  if (!title) fields.title = "What will you do?";
  else if (title.length > 160) fields.title = "Please keep this under 160 characters.";
  if (measure !== "done" && measure !== "quantity") fields.measure = "Choose how you'll count it.";

  let unit: string | null = null;
  let target: number | null = null;
  let minimum: number | null = null;
  if (measure === "quantity") {
    if (text(formData, "unit_choice") === "own") {
      unit = text(formData, "unit") || null;
      if (!unit) fields.unit = "What are you counting? e.g. questions, pages.";
      else if (unit.length > 30) fields.unit = "Please keep the unit short.";
    }
    target = parseAmount(formData.get("target_value"));
    minimum = parseAmount(formData.get("minimum_value"));
    if (target === null || Number.isNaN(target) || target <= 0) fields.target_value = "Enter your target for the week.";
    if (minimum !== null && (Number.isNaN(minimum) || minimum <= 0)) fields.minimum_value = "Enter a number, or leave it empty.";
    else if (minimum !== null && target !== null && minimum > target) fields.minimum_value = "The minimum can't be more than the target.";
  }
  if (Object.keys(fields).length) return { error: "A few things need a look.", fields, values };

  const supabase = await createClient();
  const { count } = await supabase.from("commitments").select("id", { count: "exact", head: true }).eq("week_start", week);
  if ((count ?? 0) >= 5) return { error: CAP_MESSAGE, values };

  const { error } = await supabase.from("commitments").insert({
    goal_id: goalId,
    week_start: week,
    title,
    measure,
    unit,
    target_value: target,
    minimum_value: minimum,
    position: count ?? 0,
  });
  if (isCapError(error)) return { error: CAP_MESSAGE, values };
  if (error) return { error: "We couldn't add that just now. Please try again.", values };

  refresh();
  return { ok: true };
}

export async function removeCommitment(formData: FormData) {
  await requireOnboardedMember();
  const supabase = await createClient();
  // Logs linked to it are kept; only the link is cleared.
  await supabase.from("commitments").delete().eq("id", text(formData, "id"));
  refresh();
}

export async function bringForward(formData: FormData) {
  const member = await requireOnboardedMember();
  const week = allowedWeek(text(formData, "week"), member.today);
  if (!week) return;
  const supabase = await createClient();
  const { data: source } = await supabase
    .from("commitments")
    .select("goal_id, title, measure, unit, target_value, minimum_value")
    .eq("id", text(formData, "id"))
    .single();
  if (!source) return;
  const { count } = await supabase.from("commitments").select("id", { count: "exact", head: true }).eq("week_start", week);
  if ((count ?? 0) >= 5) return;
  await supabase.from("commitments").insert({ ...source, week_start: week, position: count ?? 0 });
  refresh();
}
