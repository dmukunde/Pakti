import "server-only";
import { z } from "zod";

// Server-only secrets. Importing this file from a Client Component fails the
// build (server-only), so the secret key can never reach the browser bundle.
const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= serverSchema.parse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
  return cached;
}
