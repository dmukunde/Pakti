import type { Metadata } from "next";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { getCurrentMember } from "@/lib/auth/current-member";

export const metadata: Metadata = { title: "This Week" };

// Phase 1 placeholder proving the signed-in path end to end. The real This
// Week screen is built in a later phase.
export default function WeekPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 py-8">
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <Signed />
      </Suspense>
    </main>
  );
}

async function Signed() {
  const member = await getCurrentMember();
  return (
    <>
      <h1 className="text-2xl font-semibold">
        {member.displayName ? `Welcome, ${member.displayName}` : "Welcome"}
      </h1>
      <Card eyebrow="Foundation" title="You're signed in">
        <p className="text-ink-muted">The weekly loop arrives in the next phase.</p>
      </Card>
      <form action="/auth/sign-out" method="post">
        <button type="submit" className="min-h-11 text-primary underline-offset-4 hover:underline">
          Sign out
        </button>
      </form>
    </>
  );
}
