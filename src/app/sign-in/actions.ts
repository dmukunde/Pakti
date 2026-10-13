"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { publicEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

export type SignInState =
  | { status: "idle" }
  | { status: "sent"; email: string }
  | { status: "reset-sent"; email: string }
  | { status: "error"; message: string; email?: string };

import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

const emailSchema = z.email().max(254);

function readEmail(formData: FormData) {
  return emailSchema.safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
}

// Supabase error messages are technical; members get plain, calm ones.
function friendlyAuthError(message: string | undefined, fallback: string): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match. Try again, or reset your password.";
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already exists"))
    return "There's already an account with this email. Sign in instead.";
  if (m.includes("password") && (m.includes("weak") || m.includes("at least") || m.includes("short")))
    return `Please choose a stronger password — at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Please wait a minute and try again.";
  return fallback;
}

export async function signInWithPassword(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");
  if (!email.success) return { status: "error", message: "Please enter a valid email address." };
  if (!password) return { status: "error", message: "Please enter your password.", email: email.data };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.data, password });
  if (error || !data.session) {
    return { status: "error", message: friendlyAuthError(error?.message, "We couldn't sign you in just now. Please try again."), email: email.data };
  }
  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function signUpWithPassword(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");
  if (!email.success) return { status: "error", message: "Please enter a valid email address." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { status: "error", message: `Please choose a password with at least ${MIN_PASSWORD_LENGTH} characters.`, email: email.data };
  }

  const supabase = await createClient();
  const redirectTo = new URL("/auth/confirm", await siteOrigin());
  const { data, error } = await supabase.auth.signUp({
    email: email.data,
    password,
    options: { emailRedirectTo: redirectTo.toString() },
  });
  if (error) {
    return { status: "error", message: friendlyAuthError(error.message, "We couldn't create your account just now. Please try again."), email: email.data };
  }
  // With "Confirm email" off in Supabase, sign-up starts a session at once.
  // If it's ever switched back on, the member is asked to confirm first.
  if (!data.session) return { status: "sent", email: email.data };
  redirect("/onboarding");
}

export async function sendPasswordReset(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = readEmail(formData);
  if (!email.success) return { status: "error", message: "Enter your email above, then tap “Forgot password?” again." };

  const redirectTo = new URL("/auth/confirm", await siteOrigin());
  redirectTo.searchParams.set("next", "/auth/reset-password");
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: redirectTo.toString() });
  if (error) {
    return { status: "error", message: friendlyAuthError(error.message, "We couldn't send the reset email just now. Please try again later."), email: email.data };
  }
  // Same answer whether or not the account exists, so emails can't be probed.
  return { status: "reset-sent", email: email.data };
}

export async function sendMagicLink(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const email = readEmail(formData);
  if (!email.success) return { status: "error", message: "Please enter a valid email address." };

  const next = safeNextPath(String(formData.get("next") ?? ""));
  const redirectTo = new URL("/auth/confirm", await siteOrigin());
  redirectTo.searchParams.set("next", next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: redirectTo.toString(), shouldCreateUser: true },
  });
  if (error) {
    return { status: "error", message: friendlyAuthError(error.message, "We couldn't send the link just now. Please try again in a minute."), email: email.data };
  }
  return { status: "sent", email: email.data };
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
