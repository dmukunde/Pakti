import { cn } from "@/lib/cn";

/** Pakti's mark: a progress ring with a soft-white "restart" dot, on a lavender tile. */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 512 512" className={cn("shrink-0", className)}>
      <rect width="512" height="512" rx="128" fill="#a78bfa" />
      <path d="M256 136 a120 120 0 1 1 -120 120" fill="none" stroke="#11131f" strokeWidth="48" strokeLinecap="round" />
      <circle cx="256" cy="136" r="38" fill="#f5f3ff" />
    </svg>
  );
}

/** The mark with the Pakti wordmark beside it. */
export function Logo({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  const lg = size === "lg";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={lg ? 44 : 32} />
      <span className={cn("font-extrabold tracking-tight text-ink", lg ? "text-3xl" : "text-2xl")}>Pakti</span>
    </span>
  );
}
