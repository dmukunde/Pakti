// Display helpers. Units are free text; currency-like units go in front
// ("UGX 250,000"), everything else after ("3 sessions").

const PREFIX_UNITS = new Set(["UGX", "USD", "KES", "TZS", "RWF", "EUR", "GBP", "$", "€", "£"]);

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export function formatNumber(value: number): string {
  return number.format(value);
}

export function formatAmount(value: number, unit: string | null | undefined): string {
  const n = formatNumber(value);
  if (!unit) return n;
  return PREFIX_UNITS.has(unit.trim().toUpperCase()) || PREFIX_UNITS.has(unit.trim())
    ? `${unit.trim()} ${n}`
    : `${n} ${unit.trim()}`;
}

/** "UGX 1,750,000 of 3,000,000" or "45 of 120 sessions": the unit appears once. */
export function formatProgress(actual: number, target: number, unit: string | null | undefined): string {
  const u = unit?.trim();
  if (!u) return `${formatNumber(actual)} of ${formatNumber(target)}`;
  return PREFIX_UNITS.has(u.toUpperCase()) || PREFIX_UNITS.has(u)
    ? `${u} ${formatNumber(actual)} of ${formatNumber(target)}`
    : `${formatNumber(actual)} of ${formatNumber(target)} ${u}`;
}

/** Parse what people type: "3,000,000", " 250000 ", "2.5". Empty -> null. */
export function parseAmount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const cleaned = String(raw).replace(/[,\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** "31 Dec 2026" from an ISO date. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
