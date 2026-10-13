import { cn } from "@/lib/cn";
import { capitalColorVar, capitalLabel, type LifeCapital } from "@/lib/domain/capitals";

/**
 * A life capital as secondary text with its small muted colour dot. The dot
 * is decorative; the name carries the meaning.
 */
export function CapitalLabel({ capital, prefix, className }: { capital: LifeCapital; prefix?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-ink-muted", className)}>
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: capitalColorVar(capital) }} />
      {prefix}
      {capitalLabel(capital)}
    </span>
  );
}

/** Private / Shared, understated but readable. */
export function PrivacyNote({ shared }: { shared: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
      <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {shared ? (
          <>
            <circle cx="9" cy="9" r="3" />
            <circle cx="16.5" cy="10" r="2.5" />
            <path d="M3.5 19c.6-3 2.8-4.8 5.5-4.8s4.9 1.8 5.5 4.8M15 14.5c2.5-.5 4.8 1 5.5 4" />
          </>
        ) : (
          <>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </>
        )}
      </svg>
      {shared ? "Shared with partners" : "Private"}
    </span>
  );
}
