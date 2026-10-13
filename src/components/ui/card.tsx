import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type CardProps = HTMLAttributes<HTMLElement> & {
  title?: ReactNode;
  eyebrow?: ReactNode;
  emphasis?: boolean;
  /** A sunny card for rewards and celebrations. */
  reward?: boolean;
};

// The basic surface for Home and detail screens. `emphasis` is reserved for
// the one card that matters most on a screen (e.g. My Big Goal).
export function Card({ title, eyebrow, emphasis, reward, className, children, ...props }: CardProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border p-5",
        emphasis
          ? "border-primary/25 bg-gradient-to-br from-primary-soft via-surface to-sun-soft"
          : reward
            ? "border-sun/50 bg-gradient-to-br from-sun-soft to-accent-soft"
            : "border-line bg-surface",
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
