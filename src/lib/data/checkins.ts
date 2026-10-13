import "server-only";
import type { IsoDate } from "@/lib/domain/dates";
import type { CheckinStatus } from "@/lib/domain/goals";
import type { Result } from "@/lib/domain/week";
import { createClient } from "@/lib/supabase/server";

export type Reflection = {
  id: string;
  period_start: IsoDate;
  wins: string | null;
  challenges: string | null;
  learned: string | null;
  support_needed: string | null;
  next_steps: string | null;
  published_at: string | null;
};

/** The member's own weekly check-in for a week, if they've started one. */
export async function getWeeklyReflection(week: IsoDate): Promise<Reflection | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reflections")
    .select("id, period_start, wins, challenges, learned, support_needed, next_steps, published_at")
    .eq("period_type", "week")
    .eq("period_start", week)
    .maybeSingle();
  return (data as Reflection | null) ?? null;
}

export async function getGoalStatuses(week: IsoDate): Promise<Record<string, CheckinStatus>> {
  const supabase = await createClient();
  const { data } = await supabase.from("goal_checkins").select("goal_id, status").eq("week_start", week);
  return Object.fromEntries((data ?? []).map((r) => [r.goal_id, r.status as CheckinStatus]));
}

/** Notes partners left on one of the member's check-ins (the owner can read them; RLS). */
export async function getNotesOn(reflectionId: string) {
  const supabase = await createClient();
  const { data: notes } = await supabase
    .from("partner_notes")
    .select("id, author_id, body, updated_at")
    .eq("reflection_id", reflectionId)
    .order("created_at");
  if (!notes?.length) return [];
  const names = await partnerNames();
  return notes.map((n) => ({ ...n, authorName: names.get(n.author_id) ?? "Your partner" }));
}

export type Partnership = {
  partnership_id: string;
  role: "supports_me" | "i_support";
  other_user_id: string | null;
  other_display_name: string | null;
  invite_email: string | null;
  invite_label: string | null;
  status: "pending" | "active" | "ended";
  created_at: string;
  accepted_at: string | null;
  invite_expires_at: string | null;
};

export async function getPartnerships(): Promise<Partnership[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_partnerships");
  return (data ?? []) as Partnership[];
}

async function partnerNames(): Promise<Map<string, string>> {
  const all = await getPartnerships();
  return new Map(all.filter((p) => p.other_user_id).map((p) => [p.other_user_id!, p.other_display_name || "Your partner"]));
}

export type Snapshot = {
  v: 1;
  week_start: IsoDate;
  reflection: { wins: string | null; challenges: string | null; learned: string | null; support_needed: string | null; next_steps: string | null };
  commitments: Array<{
    title: string;
    goal_title: string;
    capital: string;
    measure: "done" | "quantity";
    unit: string | null;
    target: number | null;
    minimum: number | null;
    actual: number | null;
    result: Result;
  }>;
  goals: Array<{ title: string; capital: string; kind: string; is_primary: boolean; progress_label: string }>;
};

export type PartnerCheckin = {
  reflection_id: string;
  member_id: string;
  member_display_name: string;
  period_start: IsoDate;
  published_at: string;
  snapshot: Snapshot;
};

/** Published check-ins of members the caller supports (frozen snapshots only). */
export async function getPartnerCheckins(memberId?: string): Promise<PartnerCheckin[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("partner_checkins", memberId ? { p_member_id: memberId } : {});
  return (data ?? []) as unknown as PartnerCheckin[];
}

/** The caller's own notes on check-ins they can read, keyed by reflection. */
export async function getMyNotes(reflectionIds: string[], userId: string): Promise<Record<string, string>> {
  if (!reflectionIds.length) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("partner_notes")
    .select("reflection_id, body")
    .eq("author_id", userId)
    .in("reflection_id", reflectionIds);
  return Object.fromEntries((data ?? []).map((n) => [n.reflection_id, n.body]));
}
