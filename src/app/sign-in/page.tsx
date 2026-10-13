import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Sign in to Pakti</h1>
        <p className="mt-2 text-ink-muted">We&apos;ll email you a link. No password to remember.</p>
      </div>
      <Suspense>
        <SignInForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
