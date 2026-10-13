"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

// Private evidence upload, run in the browser as the signed-in member.
// Storage policies only accept files under {user_id}/{log_id}/ for a log the
// member owns; the evidence row records the same path.

export const MAX_EVIDENCE_BYTES = 5 * 1024 * 1024;
export const EVIDENCE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,application/pdf";
const ALLOWED = new Set(EVIDENCE_ACCEPT.split(","));

/** Shrink photos to at most 1600px on the long side as JPEG, to save members' data. */
async function compress(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size < 400 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

export function checkEvidence(files: File[]): string | null {
  for (const f of files) {
    if (!ALLOWED.has(f.type)) return `${f.name}: please choose a photo (JPEG, PNG, WebP, HEIC) or a PDF.`;
  }
  return null;
}

export async function uploadEvidence(
  supabase: SupabaseClient,
  userId: string,
  logId: string,
  files: File[],
): Promise<{ uploaded: number; failed: string[] }> {
  const failed: string[] = [];
  let uploaded = 0;
  for (const file of files) {
    const blob = await compress(file);
    const type = blob === file ? file.type : "image/jpeg";
    if (blob.size > MAX_EVIDENCE_BYTES) {
      failed.push(`${file.name} is over 5 MB`);
      continue;
    }
    const ext = type === "application/pdf" ? "pdf" : type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "image/heic" ? "heic" : "jpg";
    const path = `${userId}/${logId}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("evidence").upload(path, blob, { contentType: type });
    if (uploadError) {
      failed.push(file.name);
      continue;
    }
    const { error: rowError } = await supabase
      .from("evidence")
      .insert({ log_id: logId, storage_path: path, mime_type: type, size_bytes: blob.size });
    if (rowError) {
      await supabase.storage.from("evidence").remove([path]);
      failed.push(file.name);
      continue;
    }
    uploaded++;
  }
  return { uploaded, failed };
}
