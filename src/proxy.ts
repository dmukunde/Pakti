import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Paths a signed-out visitor may open. Everything else requires a session.
// /styleguide is development-only (the page 404s in production).
// /invite/<token> shows who sent an invite before the person signs in.
const PUBLIC_PATHS = ["/", "/sign-in", "/auth/confirm", "/styleguide", "/invite"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Optimistic check only: it refreshes the session and redirects signed-out
// visitors. Authorisation is enforced by RLS and re-checked in every Server
// Action and Route Handler, never here alone.
export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!userId && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (userId && pathname === "/sign-in") {
    const url = request.nextUrl.clone();
    url.pathname = "/week";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // Skip static files and image optimisation.
    // Skip static files, image optimisation, the PWA manifest, icons and service worker.
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
