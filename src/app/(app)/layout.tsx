import Link from "next/link";
import { Suspense } from "react";
import { AppNav, AppNavStatic } from "@/components/app-nav";

// Shell for signed-in screens. Static on purpose: each page reads the member
// inside its own Suspense boundary, so the shell renders instantly.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-5 pt-5">
        <Link href="/week" className="text-sm font-semibold tracking-wide text-primary">
          Pakti
        </Link>
        <form action="/auth/sign-out" method="post">
          <button type="submit" className="min-h-11 px-2 text-sm text-ink-muted hover:text-ink">
            Sign out
          </button>
        </form>
      </header>
      <div className="sm:border-b sm:border-line">
        <Suspense fallback={<AppNavStatic />}>
          <AppNav />
        </Suspense>
      </div>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 pb-28 pt-4 sm:pb-12">{children}</main>
    </div>
  );
}
