import "server-only";
import { createClient } from "@/lib/supabase/server";

export type EvidenceItem = { path: string; mime: string; url: string };

/**
 * The member's own evidence for some logs, with short-lived signed URLs.
 * Runs as the member, so RLS and storage policies only ever return their files.
 */
export async function getEvidenceForLogs(logIds: string[]): Promise<Record<string, EvidenceItem[]>> {
  if (logIds.length === 0) return {};
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("evidence")
    .select("log_id, storage_path, mime_type")
    .in("log_id", logIds)
    .order("created_at");
  if (!rows?.length) return {};

  const { data: signed } = await supabase.storage
    .from("evidence")
    .createSignedUrls(rows.map((r) => r.storage_path), 300);
  const urls = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]));

  const out: Record<string, EvidenceItem[]> = {};
  for (const r of rows) {
    const url = urls.get(r.storage_path);
    if (!url) continue;
    (out[r.log_id] ??= []).push({ path: r.storage_path, mime: r.mime_type, url });
  }
  return out;
}
