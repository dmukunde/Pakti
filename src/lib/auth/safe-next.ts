// Only allow redirects to paths on this site, never to another origin
// (prevents open redirects through ?next=https://evil.example).
export function safeNextPath(next: string | null | undefined, fallback = "/week"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
