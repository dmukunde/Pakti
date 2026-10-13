"use server";

import { z } from "zod";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

export type SignInState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "error"; message: string };

const emailSchema = z.email().max(254);

export async function sendMagicLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const parsed = emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  const next = safeNextPath(String(formData.get("next") ?? ""));
  const redirectTo = new URL("/auth/confirm", publicEnv().NEXT_PUBLIC_SITE_URL);
  redirectTo.searchParams.set("next", next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { emailRedirectTo: redirectTo.toString(), shouldCreateUser: true },
  });

  if (error) {
    return { status: "error", message: "We couldn't send the link just now. Please try again in a minute." };
  }
  return { status: "sent", email: parsed.data };
}
