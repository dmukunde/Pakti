import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-5 py-12">
      <div>
        <p className="text-sm font-medium tracking-wide text-primary">Pakti</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight">
          A few things that matter, every week.
        </h1>
        <p className="mt-4 text-lg text-ink-muted">
          Progress, consistency, learning and restarting — not perfection.
        </p>
      </div>
      <Link
        href="/sign-in"
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 text-base font-medium text-primary-ink hover:opacity-90"
      >
        Sign in
      </Link>
    </main>
  );
}
