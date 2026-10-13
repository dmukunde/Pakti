import { describe, expect, it } from "vitest";
import {
  commitmentActual,
  commitmentResult,
  focusDot,
  habitWeekResult,
  isRecoveryWeek,
  loggableDates,
  matchCommitment,
  resultLabel,
  tally,
  weekStateLine,
  type CommitmentLike,
} from "./week";

const week = "2027-01-04";
const c = (over: Partial<CommitmentLike>): CommitmentLike => ({
  id: "c1",
  goal_id: "g1",
  week_start: week,
  title: "Exercise 3 times",
  measure: "quantity",
  unit: null,
  target_value: 3,
  minimum_value: 2,
  ...over,
});
const log = (commitment_id: string | null, amount: number | null = null) => ({ commitment_id, amount });

describe("commitment results", () => {
  it("distinguishes achieved, within minimum and below (architecture example)", () => {
    const exercise = c({});
    expect(commitmentResult(exercise, 3)).toBe("achieved");
    expect(commitmentResult(exercise, 2)).toBe("within");
    expect(commitmentResult(exercise, 1)).toBe("below");
  });

  it("treats a missing minimum as the target", () => {
    expect(commitmentResult(c({ minimum_value: null }), 2)).toBe("below");
  });

  it("counts only logs linked to the commitment", () => {
    const logs = [log("c1"), log("c1"), log("c2"), log(null)];
    expect(commitmentActual(c({}), logs)).toBe(2);
  });

  it("sums amounts for quantity commitments", () => {
    expect(commitmentActual(c({ target_value: 250000 }), [log("c1", 100000), log("c1", 150000)])).toBe(250000);
  });

  it("done-type commitments are achieved by any linked log", () => {
    const done = c({ measure: "done", target_value: null, minimum_value: null });
    expect(commitmentResult(done, 0)).toBe("below");
    expect(commitmentResult(done, 1)).toBe("achieved");
  });

  it("speaks gently while the week is running", () => {
    const exercise = c({});
    expect(resultLabel(exercise, 0, "below", false, "sessions")).toBe("2 sessions to your minimum");
    expect(resultLabel(exercise, 0, "below", true, "sessions")).toBe("Below minimum");
    expect(resultLabel(exercise, 2, "within", false, null)).toBe("Minimum reached");
  });
});

describe("week state and recovery", () => {
  it("chooses the line from the tally", () => {
    expect(weekStateLine(tally([]), "2027-01-06", week)).toMatch(/^Plan your week/);
    expect(weekStateLine(tally(["achieved", "achieved"]), "2027-01-06", week)).toBe("Everything you planned, done.");
    expect(weekStateLine(tally(["achieved", "within"]), "2027-01-06", week)).toMatch(/minimums/);
    expect(weekStateLine(tally(["achieved", "below"]), "2027-01-06", week)).toBe("5 days left. What's the smallest next step?");
    expect(weekStateLine(tally(["below"]), "2027-01-10", week)).toMatch(/^Last day/);
  });

  it("flags a recovery week only when most commitments fell below", () => {
    expect(isRecoveryWeek(tally(["below", "below", "achieved"]))).toBe(true);
    expect(isRecoveryWeek(tally(["below", "achieved"]))).toBe(false);
    expect(isRecoveryWeek(tally([]))).toBe(false);
  });
});

describe("auto-linking a goal-level log", () => {
  const save = c({ id: "save", title: "Save", unit: null, target_value: 250000 });
  const questions = c({ id: "q", title: "50 questions", unit: "questions", target_value: 50 });
  const module3 = c({ id: "m3", measure: "done", target_value: null, minimum_value: null });
  const revision = c({ id: "rev", measure: "done", target_value: null, minimum_value: null });

  it("links an amount to the single commitment in the goal's unit", () => {
    expect(matchCommitment({ amount: 250000 }, [save, questions])).toBe("save");
  });

  it("never links an amount to a commitment in its own unit", () => {
    expect(matchCommitment({ amount: 50 }, [questions])).toBeNull();
  });

  it("links a done log only when there is exactly one done commitment", () => {
    expect(matchCommitment({ amount: null }, [module3])).toBe("m3");
    expect(matchCommitment({ amount: null }, [module3, revision])).toBeNull();
  });
});

describe("dates and focus", () => {
  it("offers the last 14 days, optionally inside one week", () => {
    expect(loggableDates("2027-01-20")).toHaveLength(14);
    expect(loggableDates("2027-01-20", "2027-01-11")).toEqual([
      "2027-01-17", "2027-01-16", "2027-01-15", "2027-01-14", "2027-01-13", "2027-01-12", "2027-01-11",
    ]);
  });

  it("never marks an out-of-focus week as missed", () => {
    const commitments = [c({ week_start: week })];
    expect(focusDot("2027-01-11", "2027-01-18", commitments, [])).toBe("not_in_focus");
    expect(focusDot(week, "2027-01-18", commitments, [])).toBe("missed");
    expect(focusDot(week, "2027-01-18", commitments, [log("c1"), log("c1")])).toBe("kept");
    expect(focusDot("2027-01-25", "2027-01-18", commitments, [])).toBe("upcoming");
  });

  it("judges habit weeks against target and minimum", () => {
    expect(habitWeekResult(3, 3, 2)).toBe("achieved");
    expect(habitWeekResult(2, 3, 2)).toBe("within");
    expect(habitWeekResult(1, 3, 2)).toBe("below");
  });
});
