// Integration test against the LOCAL Supabase stack (npm run db:start):
// proves through the real Storage API that evidence files are owner-only and
// that an active accountability partner cannot reach them.
//
// Run with: npm run test:integration
import { execSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type LocalStatus = { API_URL: string; PUBLISHABLE_KEY: string; SECRET_KEY: string };

// Always read the local stack's own keys so this can never touch a hosted project.
const status = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8" })) as LocalStatus;
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(status.API_URL)) {
  throw new Error(`Refusing to run integration tests against ${status.API_URL}`);
}

const admin = createClient(status.API_URL, status.SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function anonClient() {
  return createClient(status.API_URL, status.PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signedInMember(name: string): Promise<{ id: string; client: SupabaseClient }> {
  const email = `${name}-${randomUUID().slice(0, 8)}@pakti.test`;
  const password = randomBytes(18).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, client };
}

const created: string[] = [];
let owner: { id: string; client: SupabaseClient };
let partner: { id: string; client: SupabaseClient };
let path: string;
const file = new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" });

beforeAll(async () => {
  owner = await signedInMember("owner");
  partner = await signedInMember("partner");
  created.push(owner.id, partner.id);

  // Fixtures written with the secret key (bypasses RLS) to set the scene.
  const goal = await admin
    .from("goals")
    .insert({ user_id: owner.id, capital: "financial", title: "Emergency fund", kind: "amount", unit: "UGX", target_value: 3000000 })
    .select("id")
    .single();
  if (goal.error) throw goal.error;
  const log = await admin
    .from("activity_logs")
    .insert({ user_id: owner.id, goal_id: goal.data.id, occurred_on: new Date().toISOString().slice(0, 10), amount: 250000 })
    .select("id")
    .single();
  if (log.error) throw log.error;
  const partnership = await admin.from("partnerships").insert({
    member_id: owner.id,
    partner_id: partner.id,
    invite_email: "partner@pakti.test",
    invite_token_hash: randomBytes(32).toString("hex"),
    status: "active",
    accepted_at: new Date().toISOString(),
  });
  if (partnership.error) throw partnership.error;

  path = `${owner.id}/${log.data.id}/receipt.png`;
});

afterAll(async () => {
  await admin.storage.from("evidence").remove([path]);
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

describe("evidence storage (real Storage API)", () => {
  it("owner uploads evidence under their own log", async () => {
    const { error } = await owner.client.storage.from("evidence").upload(path, file);
    expect(error).toBeNull();
  });

  it("owner can download and sign their own file", async () => {
    expect((await owner.client.storage.from("evidence").download(path)).error).toBeNull();
    expect((await owner.client.storage.from("evidence").createSignedUrl(path, 60)).error).toBeNull();
  });

  it("active partner cannot download the member's evidence", async () => {
    const { data, error } = await partner.client.storage.from("evidence").download(path);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("active partner cannot create a signed URL for it", async () => {
    const { data, error } = await partner.client.storage.from("evidence").createSignedUrl(path, 60);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });

  it("active partner cannot list the member's evidence folder", async () => {
    const { data } = await partner.client.storage.from("evidence").list(path.split("/").slice(0, 2).join("/"));
    expect(data ?? []).toHaveLength(0);
  });

  it("active partner cannot delete the member's evidence", async () => {
    const { data } = await partner.client.storage.from("evidence").remove([path]);
    expect(data ?? []).toHaveLength(0);
    expect((await owner.client.storage.from("evidence").download(path)).error).toBeNull();
  });

  it("active partner cannot upload into the member's folder", async () => {
    const { error } = await partner.client.storage.from("evidence").upload(path.replace("receipt", "planted"), file);
    expect(error).not.toBeNull();
  });

  it("the bucket is private: no public or anonymous access", async () => {
    const { data, error } = await anonClient().storage.from("evidence").download(path);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    const publicUrl = admin.storage.from("evidence").getPublicUrl(path).data.publicUrl;
    expect((await fetch(publicUrl)).ok).toBe(false);
  });
});
