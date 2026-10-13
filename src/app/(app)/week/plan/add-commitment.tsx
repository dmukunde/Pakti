"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { capitalLabel, type LifeCapital } from "@/lib/domain/capitals";
import { formatAmount } from "@/lib/domain/format";
import type { GoalKind } from "@/lib/domain/goals";
import { saveCommitment, type CommitmentFormState } from "./actions";

export type PlanGoal = {
  id: string;
  title: string;
  capital: LifeCapital;
  kind: GoalKind;
  unit: string | null;
  is_primary: boolean;
  weekly_target: number | null;
  weekly_minimum: number | null;
  /** Amount goals with a numeric milestone: remaining ÷ weeks left in the quarter. */
  weeklyHint: number | null;
};

export function AddCommitment({ goals, week, full }: { goals: PlanGoal[]; week: string; full: boolean }) {
  const [open, setOpen] = useState(false);
  const [goalId, setGoalId] = useState("");
  const [measure, setMeasure] = useState<"done" | "quantity" | "">("");
  const [unitChoice, setUnitChoice] = useState<"goal" | "own">("goal");
  const [state, action, pending] = useActionState<CommitmentFormState, FormData>(async (prev, formData) => {
    const result = await saveCommitment(prev, formData);
    if (result.ok) {
      // Close and reset after a successful add.
      setOpen(false);
      setGoalId("");
      setMeasure("");
      setUnitChoice("goal");
    }
    return result;
  }, {});
  const goal = goals.find((g) => g.id === goalId);
  const err = state.fields ?? {};
  const v = state.values ?? {};

  function pickGoal(id: string) {
    setGoalId(id);
    const g = goals.find((x) => x.id === id);
    // Sensible starting point: habits and amounts count, milestones are done-or-not.
    setMeasure(g?.kind === "milestone" ? "done" : "quantity");
    // Amount and habit goals count in the goal's own terms by default; milestones have none.
    setUnitChoice(g?.kind === "milestone" ? "own" : "goal");
  }

  if (full) {
    return <p className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-ink-muted">Five is the most for one week. Remove one to add another.</p>;
  }

  if (!open) {
    return (
      <Button block variant="secondary" onClick={() => setOpen(true)}>
        Add a commitment
      </Button>
    );
  }

  const defaultTarget =
    v.target_value ??
    (goal?.kind === "habit" && goal.weekly_target ? String(goal.weekly_target) : goal?.weeklyHint ? String(goal.weeklyHint) : "");
  const defaultMinimum = v.minimum_value ?? (goal?.kind === "habit" && goal.weekly_minimum ? String(goal.weekly_minimum) : "");

  return (
    <form action={action} className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-4">
      <input type="hidden" name="week" value={week} />
      <input type="hidden" name="goal_id" value={goalId} />
      <input type="hidden" name="measure" value={measure} />
      <input type="hidden" name="unit_choice" value={unitChoice} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-semibold">Which goal does it serve?</legend>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Goal">
          {goals.map((g) => (
            <button
              key={g.id}
              type="button"
              role="radio"
              aria-checked={goalId === g.id}
              aria-label={`${g.title}${g.is_primary ? ", Big Goal" : ""}, ${capitalLabel(g.capital)}`}
              onClick={() => pickGoal(g.id)}
              className={cn(
                "flex min-h-11 flex-col items-start rounded-xl border px-4 py-2 text-left",
                goalId === g.id ? "border-primary bg-primary-soft" : "border-line hover:bg-surface-muted",
              )}
            >
              <span className="font-medium">{g.title}</span>
              <span className="text-sm text-ink-muted">
                {g.is_primary ? "Big Goal · " : ""}
                {capitalLabel(g.capital)}
              </span>
            </button>
          ))}
        </div>
        {err.goal_id && <p className="text-sm text-below">{err.goal_id}</p>}
      </fieldset>

      {goal && (
        <>
          <Field id="c-title" label="What will you do this week?" error={err.title} hint="Small and concrete, e.g. Complete Module 3 · Exercise 3 times">
            <Input id="c-title" name="title" defaultValue={v.title ?? ""} maxLength={160} autoFocus />
          </Field>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-semibold">How will you count it?</legend>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How to count it">
              {(
                [
                  ["done", "Done or not"],
                  ["quantity", "An amount"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={measure === key}
                  onClick={() => setMeasure(key)}
                  className={cn(
                    "min-h-11 rounded-xl border px-3 text-sm font-medium",
                    measure === key ? "border-primary bg-primary-soft" : "border-line hover:bg-surface-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          {measure === "quantity" && (
            <div className="flex flex-col gap-4">
              {goal.kind !== "milestone" && (
                <div className="flex flex-col gap-2 text-sm" role="radiogroup" aria-label="Unit">
                  <label className="flex min-h-11 items-center gap-3">
                    <input type="radio" checked={unitChoice === "goal"} onChange={() => setUnitChoice("goal")} className="size-5 accent-primary" />
                    {goal.unit ? `In ${goal.unit}` : "Times"} — counts toward “{goal.title}”
                  </label>
                  <label className="flex min-h-11 items-center gap-3">
                    <input type="radio" checked={unitChoice === "own"} onChange={() => setUnitChoice("own")} className="size-5 accent-primary" />
                    In its own unit (e.g. practice questions)
                  </label>
                </div>
              )}
              {unitChoice === "own" && (
                <Field id="c-unit" label="Unit" error={err.unit}>
                  <Input id="c-unit" name="unit" defaultValue={v.unit ?? ""} maxLength={30} placeholder="questions" />
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field id="c-target" label="Target" error={err.target_value}>
                  <Input key={`t-${goalId}`} id="c-target" name="target_value" inputMode="decimal" defaultValue={defaultTarget} />
                </Field>
                <Field id="c-min" label="Minimum that counts" error={err.minimum_value}>
                  <Input key={`m-${goalId}`} id="c-min" name="minimum_value" inputMode="decimal" defaultValue={defaultMinimum} />
                </Field>
              </div>
              {goal.weeklyHint && unitChoice === "goal" && (
                <p className="-mt-2 text-sm text-ink-muted">
                  About {formatAmount(goal.weeklyHint, goal.unit)} a week reaches this quarter&apos;s milestone.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-below">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending || !goal} className="flex-1">
          {pending ? "Adding…" : "Add"}
        </Button>
        <Button variant="quiet" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
