import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CurrentMember = {
  id: string;
  displayName: string;
  timezone: string;
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
    .select("display_name, timezone")
    .eq("id", userId)
    .single();

  return {
    id: userId,
    displayName: profile?.display_name ?? "",
    timezone: profile?.timezone ?? "Africa/Kampala",
  };
}
