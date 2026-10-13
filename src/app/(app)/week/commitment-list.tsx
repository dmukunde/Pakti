"use client";

import { useOpenLog } from "@/components/log/log-provider";
import { Tag } from "@/components/ui/chip";
import { ProgressLine, type ProgressTone } from "@/components/ui/progress-line";
import { cn } from "@/lib/cn";
import { formatProgress } from "@/lib/domain/format";
import type { Result } from "@/lib/domain/week";

export type CommitmentItem = {
  id: string;
  title: string;
  goalTitle: string;
  measure: "done" | "quantity";
  displayUnit: string | null;
  target_value: number | null;
  minimum_value: number | null;
  actual: number;
  result: Result;
  label: string;
};

const tone = (r: Result, weekEnded: boolean): ProgressTone =>
  r === "achieved" ? "achieved" : r === "within" ? "within" : weekEnded ? "below" : "neutral";

// Each commitment is a tap target that opens the Log sheet on it.
export function CommitmentList({ items, weekEnded }: { items: CommitmentItem[]; weekEnded: boolean }) {
  const openLog = useOpenLog();
  return (
    <ul className="flex flex-col gap-3">
      {items.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            onClick={() => openLog({ commitmentId: c.id })}
            className={cn(
              "flex w-full flex-col gap-2 rounded-2xl border p-4 text-left transition-colors hover:border-primary/40",
              c.result === "achieved"
                ? "border-achieved/35 bg-surface"
                : "border-line bg-surface",
            )}
            aria-label={`${c.title}. ${c.label}. Tap to log progress.`}
          >
            <span className="flex items-start justify-between gap-3">
              <span className="font-medium">{c.title}</span>
              {c.measure === "done" && (
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-sm",
                    c.result === "achieved" ? "border-achieved bg-achieved text-bg" : "border-line-strong",
                  )}
                >
                  {c.result === "achieved" ? "✓" : ""}
                </span>
              )}
            </span>
            {c.measure === "quantity" && c.target_value !== null && (
              <ProgressLine
                value={c.actual}
                target={c.target_value}
                minimum={c.minimum_value}
                tone={tone(c.result, weekEnded)}
                label={formatProgress(c.actual, c.target_value, c.displayUnit)}
              />
            )}
            <span className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span
                className={cn(
                  c.result === "achieved" && "text-achieved",
                  c.result === "within" && "text-within",
                  c.result === "below" && (weekEnded ? "text-below" : "text-ink-muted"),
                )}
              >
                {c.result === "achieved" && <span aria-hidden>✓ </span>}
                {c.measure === "quantity" && c.target_value !== null
                  ? `${formatProgress(c.actual, c.target_value, c.displayUnit)} · ${c.label}`
                  : c.label}
              </span>
              <Tag>{c.goalTitle}</Tag>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
