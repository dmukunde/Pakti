import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type CardProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  eyebrow?: ReactNode;
  emphasis?: boolean;
};

// The basic surface for Home and detail screens. `emphasis` is reserved for
// the one card that matters most on a screen (e.g. My Big Goal).
export function Card({ title, eyebrow, emphasis, className, children, ...props }: CardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border p-5",
        emphasis ? "border-primary/30 bg-primary-soft" : "border-line bg-surface",
        className,
      )}
      {...props}
    >
      {eyebrow && <p className="text-sm text-ink-muted">{eyebrow}</p>}
      {title && <h2 className="mt-0.5 text-lg font-semibold text-ink">{title}</h2>}
      {children && <div className={cn(Boolean(title || eyebrow) && "mt-3")}>{children}</div>}
    </section>
  );
}
