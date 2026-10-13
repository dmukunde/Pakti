import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentMember } from "@/lib/auth/current-member";
import { OnboardingFlow } from "./onboarding-flow";

export const metadata: Metadata = { title: "Welcome" };

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <Flow />
      </Suspense>
    </main>
  );
}

async function Flow() {
  const member = await getCurrentMember();
  if (member.onboarded) redirect("/week");
  return (
    <OnboardingFlow
      initial={{
        displayName: member.displayName,
        vision: member.vision ?? "",
        visionWhy: member.visionWhy ?? "",
        focusCapitals: member.focusCapitals,
      }}
    />
  );
}
