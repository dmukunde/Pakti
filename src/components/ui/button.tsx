import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "quiet";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-primary-ink hover:opacity-90",
  secondary: "border border-line bg-surface text-ink hover:bg-surface-muted",
  quiet: "text-primary hover:bg-primary-soft",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  block?: boolean;
};

// 44px minimum height for comfortable touch targets.
export function Button({ variant = "primary", block, className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-base font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        block && "w-full",
        className,
      )}
      {...props}
    />
  );
}
