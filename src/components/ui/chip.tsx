import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

const base = "inline-flex items-center gap-1.5 rounded-full border px-3 text-sm";

// A static label, e.g. a goal's life capital on a commitment.
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn(base, "min-h-7 border-line bg-surface-muted text-ink-muted", className)}>{children}</span>;
}

// A toggle chip, e.g. choosing focus capitals. aria-pressed carries the state.
export function Chip({
  selected,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        base,
        "min-h-11 transition-colors",
        selected ? "border-primary bg-primary-soft text-ink" : "border-line-strong bg-surface text-ink-muted hover:bg-surface-muted hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}
