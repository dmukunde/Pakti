"use server";

import { headers } from "next/headers";
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
  const redirectTo = new URL("/auth/confirm", await siteOrigin());
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

// The address the member is actually using (production, a preview or
// localhost), so links come back to the same site without per-environment
// configuration. Next.js already rejects Server Actions whose Origin does not
// match the host, and Supabase only redirects to URLs on its allow list.
async function siteOrigin(): Promise<string> {
  const origin = (await headers()).get("origin");
  if (origin && /^https?:\/\/[^/]+$/.test(origin)) return origin;
  return publicEnv().NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
