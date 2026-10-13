// The seven life capitals. Keys match the public.life_capital domain in the
// database; labels and order live here only.
export const LIFE_CAPITALS = [
  { key: "spiritual", label: "Spiritual / Purpose" },
  { key: "financial", label: "Financial" },
  { key: "intellectual", label: "Intellectual" },
  { key: "health", label: "Health / Physical" },
  { key: "family", label: "Family / Relationships" },
  { key: "career", label: "Career" },
  { key: "contribution", label: "Contribution" },
] as const;

export type LifeCapital = (typeof LIFE_CAPITALS)[number]["key"];

export function capitalLabel(key: LifeCapital): string {
  return LIFE_CAPITALS.find((c) => c.key === key)?.label ?? key;
}

export function isLifeCapital(value: string): value is LifeCapital {
  return LIFE_CAPITALS.some((c) => c.key === value);
}
