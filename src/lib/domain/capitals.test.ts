import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LIFE_CAPITALS } from "./capitals";

describe("life capitals", () => {
  it("match the public.life_capital domain in the database", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261008090000_foundation_profiles.sql"),
      "utf8",
    );
    const domain = sql.match(/create domain public\.life_capital[\s\S]*?\);/)?.[0] ?? "";
    const dbKeys = [...domain.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    expect(dbKeys).toEqual(LIFE_CAPITALS.map((c) => c.key));
  });
});
