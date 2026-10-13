import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { safeNextPath } from "@/lib/auth/safe-next";
import { createClient } from "@/lib/supabase/server";

// Landing point for magic links. Supports both the PKCE `code` flow and the
// `token_hash` email template flow.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let failure: string | null = "missing code or token_hash";

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failure = error ? `code exchange: ${error.code ?? error.name}: ${error.message}` : null;
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    failure = error ? `token_hash: ${error.code ?? error.name}: ${error.message}` : null;
  } else if (searchParams.get("error_code")) {
    // Supabase redirects here with error_code when the link itself was rejected
    // (for example otp_expired after an email scanner opened it first).
    failure = `link rejected: ${searchParams.get("error_code")}`;
  }

  if (failure) {
    // Never log the code or token itself.
    console.error(`[auth/confirm] sign-in failed (${failure})`);
    return NextResponse.redirect(new URL("/sign-in?error=link", origin));
  }
  return NextResponse.redirect(new URL(next, origin));
}
