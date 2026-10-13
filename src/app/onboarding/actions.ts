"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentMember } from "@/lib/auth/current-member";
import { isLifeCapital } from "@/lib/domain/capitals";
import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { error?: string };

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters.`)
    .transform((v) => (v === "" ? null : v));

const schema = z.object({
  display_name: z.string().trim().min(1, "What should we call you?").max(80, "Please keep your name under 80 characters."),
  vision: optionalText(2000),
  vision_why: optionalText(2000),
  focus_capitals: z.array(z.string()).transform((v) => [...new Set(v.filter(isLifeCapital))]),
});

export async function completeOnboarding(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const member = await getCurrentMember();
  const parsed = schema.safeParse({
    display_name: formData.get("display_name") ?? "",
    vision: formData.get("vision") ?? "",
    vision_why: formData.get("vision_why") ?? "",
    focus_capitals: formData.getAll("focus_capitals").map(String),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check your answers." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ ...parsed.data, onboarded_at: new Date().toISOString() })
    .eq("id", member.id);
  if (error) {
    return { error: "We couldn't save that just now. Please try again." };
  }

  redirect(formData.get("then") === "goal" ? "/goals/new?welcome=1" : "/week");
}
