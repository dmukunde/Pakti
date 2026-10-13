import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { InstallHint } from "@/components/install-app";

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-5 py-12">
      <div>
        <Logo size="lg" />
        <h1 className="mt-8 text-4xl font-extrabold leading-tight tracking-tight">
          A few things that matter, <span className="text-primary">every week.</span>
        </h1>
        <p className="mt-4 text-lg text-ink-muted">
          Progress, consistency, learning and restarting — not perfection.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/sign-in?mode=signup"
          className="inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-5 text-base font-semibold text-primary-ink hover:bg-primary-hover"
        >
          Get started
        </Link>
        <Link
          href="/sign-in"
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line-strong bg-surface px-5 text-base font-medium hover:bg-surface-muted"
        >
          I already have an account
        </Link>
      </div>
      <InstallHint />
    </main>
  );
}
