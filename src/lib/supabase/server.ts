import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { publicEnv } from "@/lib/env";
import type { Database } from "./database.types";

// Server Components, Server Actions and Route Handlers. Acts as the signed-in
// member (publishable key + session cookie), so RLS always applies.
export async function createClient() {
  // Member data is always per request. Stop prerendering here, before the
  // auth client reads the clock (token expiry) or any member data.
  await connection();
  const env = publicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies. The proxy refreshes the
            // session on every request, so this is safe to ignore here.
          }
        },
      },
    },
  );
}
