"use server";

import { redirect } from "next/navigation";
import { getCurrentMember } from "@/lib/auth/current-member";
import { createClient } from "@/lib/supabase/server";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

export type ResetState = { error?: string };

// The reset link signs the member in (via /auth/confirm); here they choose a
// new password for that session.
export async function updatePassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  await getCurrentMember();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) return { error: `Please use at least ${MIN_PASSWORD_LENGTH} characters.` };
  if (password !== confirm) return { error: "The two passwords don't match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "We couldn't update your password just now. Please try again." };
  redirect("/week");
}
