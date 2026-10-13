import "server-only";
import { redirect } from "next/navigation";
import { isLifeCapital, type LifeCapital } from "@/lib/domain/capitals";
import { localDate, type IsoDate } from "@/lib/domain/dates";
import { createClient } from "@/lib/supabase/server";

export type CurrentMember = {
  id: string;
  displayName: string;
  timezone: string;
  vision: string | null;
  visionWhy: string | null;
  focusCapitals: LifeCapital[];
  onboarded: boolean;
  /** The member's local calendar date right now. */
  today: IsoDate;
};

// Data Access Layer entry point: verifies the session (getClaims validates the
// JWT) and returns a narrow member shape. Call it close to the data in every
// Server Component, Server Action and Route Handler that needs the member.
export async function getCurrentMember(): Promise<CurrentMember> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) {
    redirect("/sign-in");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, timezone, vision, vision_why, focus_capitals, onboarded_at")
    .eq("id", userId)
    .single();

  const timezone = profile?.timezone ?? "Africa/Kampala";
  return {
    id: userId,
    displayName: profile?.display_name ?? "",
    timezone,
    vision: profile?.vision ?? null,
    visionWhy: profile?.vision_why ?? null,
    focusCapitals: ((profile?.focus_capitals ?? []) as string[]).filter(isLifeCapital),
    onboarded: Boolean(profile?.onboarded_at),
    today: localDate(timezone),
  };
}

/** Same as getCurrentMember, but sends members who haven't onboarded yet to onboarding. */
export async function requireOnboardedMember(): Promise<CurrentMember> {
  const member = await getCurrentMember();
  if (!member.onboarded) redirect("/onboarding");
  return member;
}
