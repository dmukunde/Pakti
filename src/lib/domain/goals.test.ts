import { describe, expect, it } from "vitest";
import { formatAmount, formatProgress, parseAmount } from "./format";
import {
  isContributing,
  numericProgress,
  quartersRemaining,
  suggestedQuarterTarget,
  totalFor,
  weeklyPace,
  type GoalForProgress,
  type LogForProgress,
} from "./goals";

const savings: GoalForProgress = {
  kind: "amount",
  target_value: 3_000_000,
  start_date: "2027-01-01",
  target_date: "2027-12-31",
};

const log = (occurred_on: string, amount: number | null, commitment_unit?: string | null): LogForProgress => ({
  occurred_on,
  amount,
  has_commitment: commitment_unit !== undefined,
  commitment_unit,
});

describe("contributing logs", () => {
  it("counts goal-level logs and logs on commitments in the goal's unit", () => {
    expect(isContributing(log("2027-01-04", 250000))).toBe(true);
    expect(isContributing(log("2027-01-04", 250000, null))).toBe(true);
  });

  it("does not count logs in a commitment's own unit toward the goal", () => {
    expect(isContributing(log("2027-01-04", 50, "questions"))).toBe(false);
  });

  it("sums only contributing logs, so nothing inflates a UGX total", () => {
    const logs = [log("2027-01-04", 250000), log("2027-01-05", 250000, null), log("2027-01-06", 50, "questions")];
    expect(totalFor(savings, logs)).toBe(500000);
  });

  it("filters by date window", () => {
    const logs = [log("2026-12-31", 100), log("2027-01-01", 200), log("2027-03-31", 300), log("2027-04-01", 400)];
    expect(totalFor(savings, logs, "2027-01-01", "2027-03-31")).toBe(500);
  });

  it("counts habit logs without an amount as one each", () => {
    const habit: GoalForProgress = { ...savings, kind: "habit", target_value: 120 };
    expect(totalFor(habit, [log("2027-01-04", null), log("2027-01-05", null), log("2027-01-06", 2)])).toBe(4);
  });
});

describe("numeric progress", () => {
  it("matches the architecture example: 1,750,000 of 3,000,000 is 58%", () => {
    const p = numericProgress(1_750_000, 3_000_000);
    expect(Math.round((p?.share ?? 0) * 100)).toBe(58);
  });

  it("caps at 100% and reports what's beyond", () => {
    expect(numericProgress(3_200_000, 3_000_000)).toMatchObject({ share: 1, beyond: 200_000 });
  });

  it("has no percentage without a numeric target", () => {
    expect(numericProgress(5, null)).toBeNull();
  });
});

describe("pace and quarter suggestions", () => {
  it("spreads what remains over the weeks left", () => {
    const pace = weeklyPace(savings, 1_000_000, "2027-07-01");
    expect(pace).toBeGreaterThan(70_000);
    expect(pace).toBeLessThan(80_000);
  });

  it("shows no pace once the target is reached", () => {
    expect(weeklyPace(savings, 3_000_000, "2027-07-01")).toBeNull();
  });

  it("counts quarters through the target date", () => {
    expect(quartersRemaining("2027-01-15", "2027-12-31")).toBe(4);
    expect(quartersRemaining("2027-10-15", "2027-12-31")).toBe(1);
  });

  it("suggests a tidy quarter target", () => {
    expect(suggestedQuarterTarget(savings, 0, "2027-01-04")).toBe(750_000);
    expect(suggestedQuarterTarget(savings, 1_000_000, "2027-04-01")).toBe(670_000);
  });
});

describe("formatting", () => {
  it("puts currency first and other units after", () => {
    expect(formatAmount(250000, "UGX")).toBe("UGX 250,000");
    expect(formatAmount(3, "sessions")).toBe("3 sessions");
    expect(formatAmount(12.5, null)).toBe("12.5");
  });

  it("shows the unit once in progress text", () => {
    expect(formatProgress(1_750_000, 3_000_000, "UGX")).toBe("UGX 1,750,000 of 3,000,000");
    expect(formatProgress(45, 120, "sessions")).toBe("45 of 120 sessions");
    expect(formatProgress(2, 3, null)).toBe("2 of 3");
  });

  it("parses what people type", () => {
    expect(parseAmount("3,000,000")).toBe(3_000_000);
    expect(parseAmount(" ")).toBeNull();
    expect(Number.isNaN(parseAmount("abc"))).toBe(true);
  });
});
