import { cn } from "@/lib/cn";

export type ProgressTone = "achieved" | "within" | "below" | "neutral";

const fill: Record<ProgressTone, string> = {
  achieved: "bg-achieved",
  within: "bg-within",
  below: "bg-below",
  neutral: "bg-primary",
};

export type ProgressLineProps = {
  value: number;
  target: number;
  /** Optional minimum acceptable threshold, drawn as a small marker. */
  minimum?: number | null;
  tone?: ProgressTone;
  /** Accessible description, e.g. "2 of 3 sessions, minimum 2". */
  label: string;
  className?: string;
};

// A quiet horizontal bar: actual against target, with the minimum marked.
// Only for numeric goals and commitments; qualitative goals never get one.
export function ProgressLine({ value, target, minimum, tone = "neutral", label, className }: ProgressLineProps) {
  const pct = target > 0 ? Math.min(100, Math.max(0, (value / target) * 100)) : 0;
  const minPct = minimum && target > 0 ? Math.min(100, (minimum / target) * 100) : null;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuenow={Math.min(value, target)}
      className={cn("relative h-2 w-full rounded-full bg-surface-muted", className)}
    >
      <div className={cn("h-full rounded-full transition-[width]", fill[tone])} style={{ width: `${pct}%` }} />
      {minPct !== null && (
        <span
          aria-hidden
          className="absolute -top-1 h-4 w-0.5 rounded-full bg-ink-muted"
          style={{ left: `calc(${minPct}% - 1px)` }}
        />
      )}
    </div>
  );
}
