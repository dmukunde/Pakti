"use server";

import { createHash, randomBytes } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentMember, requireOnboardedMember } from "@/lib/auth/current-member";
import { createClient } from "@/lib/supabase/server";

export type InviteState = { link?: string; label?: string; error?: string };

/**
 * Creates an invite link the member shares themselves (WhatsApp, SMS), like
 * TutuSave. Only the token's hash is stored; the link is shown once.
 */
export async function createInvite(_prev: InviteState, formData: FormData): Promise<InviteState> {
  await requireOnboardedMember();
  const label = String(formData.get("label") ?? "").trim().slice(0, 80) || null;
  const rawEmail = String(formData.get("email") ?? "").trim().toLowerCase();
  let email: string | null = null;
  if (rawEmail) {
    const parsed = z.email().max(254).safeParse(rawEmail);
    if (!parsed.success) return { error: "That email doesn't look right. Leave it empty if you're not sure." };
    email = parsed.data;
  }

  const supabase = await createClient();
  const { data: mine } = await supabase.rpc("my_partnerships");
  const taken = (mine ?? []).filter((p) => p.role === "supports_me" && (p.status === "active" || p.status === "pending")).length;
  if (taken >= 2) return { error: "You can have two partners. Cancel an invite or end a partnership to invite someone new." };

  const token = randomBytes(24).toString("base64url");
  const { error } = await supabase.from("partnerships").insert({
    invite_label: label,
    invite_email: email,
    invite_token_hash: createHash("sha256").update(token, "utf8").digest("hex"),
  });
  if (error?.code === "23505") return { error: "There's already an open invite for that email." };
  if (error) return { error: "We couldn't create the invite just now. Please try again." };

  refresh();
  return { link: `/invite/${token}`, label: label ?? undefined };
}

export async function cancelInvite(formData: FormData) {
  await requireOnboardedMember();
  const supabase = await createClient();
  await supabase.from("partnerships").delete().eq("id", String(formData.get("id") ?? "")).eq("status", "pending");
  refresh();
}

export async function endPartnership(formData: FormData) {
  await requireOnboardedMember();
  const supabase = await createClient();
  await supabase.rpc("end_partnership", { p_partnership_id: String(formData.get("id") ?? "") });
  refresh();
}

export async function acceptInvite(formData: FormData) {
  // New partners may not have onboarded yet; accepting comes first.
  const member = await getCurrentMember();
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_partner_invite", { p_token: token });
  if (error) {
    const reason =
      error.hint === "pakti_invite_self"
        ? "self"
        : error.hint === "pakti_invite_wrong_email"
          ? "email"
          : error.hint === "pakti_invite_duplicate"
            ? "duplicate"
            : error.hint === "pakti_partner_cap"
              ? "full"
              : "invalid";
    redirect(`/invite/${token}?error=${reason}`);
  }
  redirect(member.onboarded ? "/partners?accepted=1" : "/onboarding");
}

export type NoteState = { ok?: boolean; error?: string };

/** One encouragement note per partner per check-in; saving again edits it. */
export async function saveNote(_prev: NoteState, formData: FormData): Promise<NoteState> {
  const member = await requireOnboardedMember();
  const reflectionId = String(formData.get("reflection_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Write a few words first." };
  if (body.length > 500) return { error: "Please keep notes under 500 characters." };

  const supabase = await createClient();
  const { error } = await supabase.from("partner_notes").insert({ reflection_id: reflectionId, body });
  if (error?.code === "23505") {
    const { error: updateError } = await supabase
      .from("partner_notes")
      .update({ body })
      .eq("reflection_id", reflectionId)
      .eq("author_id", member.id);
    if (updateError) return { error: "We couldn't save your note just now." };
  } else if (error) {
    return { error: "We couldn't save your note just now." };
  }
  refresh();
  return { ok: true };
}
