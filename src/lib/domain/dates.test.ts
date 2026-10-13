import { describe, expect, it } from "vitest";
import {
  addDays,
  isInWeek,
  isQuarterStart,
  isWeekStart,
  localDate,
  quarterEnd,
  quarterLabel,
  quarterStart,
  weekEnd,
  weekStart,
} from "./dates";

describe("weeks (Monday to Sunday)", () => {
  it("finds the Monday for every day of a week", () => {
    // 4 Jan 2027 is the Monday the pilot starts.
    for (const day of ["2027-01-04", "2027-01-06", "2027-01-10"]) {
      expect(weekStart(day)).toBe("2027-01-04");
    }
  });

  it("treats Sunday as the last day of the week, not the first", () => {
    expect(weekStart("2027-01-10")).toBe("2027-01-04");
    expect(weekStart("2027-01-11")).toBe("2027-01-11");
  });

  it("crosses month and year boundaries", () => {
    expect(weekStart("2027-01-01")).toBe("2026-12-28");
    expect(weekEnd("2026-12-28")).toBe("2027-01-03");
  });

  it("knows which dates are in a week", () => {
    expect(isWeekStart("2027-01-04")).toBe(true);
    expect(isWeekStart("2027-01-05")).toBe(false);
    expect(isInWeek("2027-01-10", "2027-01-04")).toBe(true);
    expect(isInWeek("2027-01-11", "2027-01-04")).toBe(false);
    expect(isInWeek("2027-01-03", "2027-01-04")).toBe(false);
  });

  it("adds days across leap years", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });
});

describe("calendar quarters", () => {
  it("finds the quarter start and end", () => {
    expect(quarterStart("2027-02-14")).toBe("2027-01-01");
    expect(quarterStart("2027-12-31")).toBe("2027-10-01");
    expect(quarterEnd("2027-01-01")).toBe("2027-03-31");
    expect(quarterEnd("2027-10-01")).toBe("2027-12-31");
  });

  it("labels quarters", () => {
    expect(quarterLabel("2027-01-01")).toBe("Q1 2027");
    expect(quarterLabel("2026-10-01")).toBe("Q4 2026");
    expect(isQuarterStart("2027-04-01")).toBe(true);
    expect(isQuarterStart("2027-04-02")).toBe(false);
  });
});

describe("local dates", () => {
  it("uses the member's timezone, not UTC", () => {
    // 22:30 UTC on Sunday 10 Jan is already Monday 11 Jan in Kampala (UTC+3).
    const instant = new Date("2027-01-10T22:30:00Z");
    expect(localDate("UTC", instant)).toBe("2027-01-10");
    expect(localDate("Africa/Kampala", instant)).toBe("2027-01-11");
    expect(weekStart(localDate("Africa/Kampala", instant))).toBe("2027-01-11");
  });

  it("rejects malformed dates", () => {
    expect(() => weekStart("10/01/2027")).toThrow();
  });
});
