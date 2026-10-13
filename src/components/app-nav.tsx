"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/week", label: "This Week", icon: WeekIcon },
  { href: "/goals", label: "Goals", icon: GoalsIcon },
  { href: "/partners", label: "Partners", icon: PartnersIcon },
] as const;

// Bottom navigation on phones, a top bar from small tablets up. Reading the
// current path is request data, so the layout renders AppNavStatic as the
// Suspense fallback and this live version streams in with the active tab.
export function AppNav() {
  return <NavTabs pathname={usePathname()} />;
}

export function AppNavStatic() {
  return <NavTabs pathname="" />;
}

function NavTabs({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:static sm:border-t-0 sm:bg-transparent sm:pb-0"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium sm:min-h-11 sm:flex-row sm:gap-2 sm:text-sm",
                  active ? "text-primary" : "text-ink-muted hover:text-ink",
                )}
              >
                <span className={cn("grid h-8 w-14 place-items-center rounded-full transition-colors sm:h-auto sm:w-auto", active && "bg-primary-soft text-primary sm:bg-transparent")}>
                  <Icon />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function WeekIcon() {
  return (
    <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3.5" y="5" width="17" height="15" rx="3" />
      <path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

function GoalsIcon() {
  return (
    <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

function PartnersIcon() {
  return (
    <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="9" cy="8.5" r="3.2" />
      <circle cx="16.5" cy="9.5" r="2.6" />
      <path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8M14.5 14.6c.6-.2 1.3-.3 2-.3 2.2 0 3.9 1.4 4.4 3.9" strokeLinecap="round" />
    </svg>
  );
}
