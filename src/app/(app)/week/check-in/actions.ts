"use server";

import { refresh } from "next/cache";
import { requireOnboardedMember } from "@/lib/auth/current-member";
import { addDays, weekStart } from "@/lib/domain/dates";
import { createClient } from "@/lib/supabase/server";

export type CheckinState = { ok?: string; error?: string };

const FIELDS = ["wins", "challenges", "learned", "support_needed", "next_steps"] as const;
const STATUSES = new Set(["growing", "steady", "needs_attention", "done"]);

/** Check-ins are for this week or last week. */
function allowedWeek(requested: string, today: string): string | null {
  const current = weekStart(today);
  return requested === current || requested === addDays(current, -7) ? requested : null;
}

export async function saveCheckin(_prev: CheckinState, formData: FormData): Promise<CheckinState> {
  const member = await requireOnboardedMember();
  const week = allowedWeek(String(formData.get("week") ?? ""), member.today);
  if (!week) return { error: "You can check in for this week or last week." };

  const text: Partial<Record<(typeof FIELDS)[number], string | null>> = {};
  for (const f of FIELDS) {
    const v = String(formData.get(f) ?? "").trim();
    if (v.length > 2000) return { error: "Please keep each answer under 2000 characters." };
    text[f] = v || null;
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("reflections")
    .select("id")
    .eq("period_type", "week")
    .eq("period_start", week)
    .maybeSingle();

  let id = existing?.id as string | undefined;
  if (id) {
    const { error } = await supabase.from("reflections").update(text).eq("id", id);
    if (error) return { error: "We couldn't save your check-in just now. Please try again." };
  } else {
    const { data, error } = await supabase
      .from("reflections")
      .insert({ period_type: "week", period_start: week, ...text })
      .select("id")
      .single();
    if (error || !data) return { error: "We couldn't save your check-in just now. Please try again." };
    id = data.id;
  }

  // How Milestone goals in focus are going this week.
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("status:") || typeof value !== "string" || !STATUSES.has(value)) continue;
    await supabase
      .from("goal_checkins")
      .upsert({ goal_id: key.slice("status:".length), week_start: week, status: value }, { onConflict: "goal_id,week_start" });
  }

  if (formData.get("intent") === "publish") {
    const ticked = formData.getAll("share").map(String);
    const { error } = await supabase.rpc("publish_checkin", { p_reflection_id: id!, p_commitment_ids: ticked });
    if (error) return { error: "Your check-in was saved, but not published. Please try again." };
    refresh();
    return { ok: "Published. Your partners can see it now." };
  }

  refresh();
  return { ok: "Saved privately." };
}

export async function unpublishCheckin(formData: FormData) {
  await requireOnboardedMember();
  const supabase = await createClient();
  await supabase.rpc("unpublish_checkin", { p_reflection_id: String(formData.get("id") ?? "") });
  refresh();
}
