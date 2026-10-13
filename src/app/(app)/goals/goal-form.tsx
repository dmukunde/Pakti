"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { LIFE_CAPITALS, type LifeCapital } from "@/lib/domain/capitals";
import { formatAmount, parseAmount } from "@/lib/domain/format";
import { GOAL_KINDS, suggestedQuarterTarget, type GoalKind } from "@/lib/domain/goals";
import { saveGoal, type GoalFormState } from "./actions";

export type GoalFormValues = {
  id?: string;
  capital?: LifeCapital;
  title: string;
  kind?: GoalKind;
  unit: string;
  target_value: string;
  weekly_target: string;
  weekly_minimum: string;
  outcome: string;
  why: string;
  target_date: string;
  reward: string;
  is_primary: boolean;
  shared_with_partners: boolean;
  show_numbers: boolean;
  milestone_title: string;
  milestone_target: string;
  milestone_reward: string;
};

type Props = {
  values: GoalFormValues;
  today: string;
  quarterLabel: string;
  /** Amount already logged before this quarter, for the milestone suggestion. */
  actualBeforeQuarter: number;
  welcome?: boolean;
  cancelHref: string;
};

export function GoalForm({ values, today, quarterLabel, actualBeforeQuarter, welcome, cancelHref }: Props) {
  const [state, action, pending] = useActionState<GoalFormState, FormData>(saveGoal, {});
  const [capital, setCapital] = useState<LifeCapital | undefined>(values.capital);
  const [kind, setKind] = useState<GoalKind | undefined>(values.kind);
  const [unit, setUnit] = useState(values.unit);
  const [target, setTarget] = useState(values.target_value);
  const [targetDate, setTargetDate] = useState(values.target_date);
  const [shared, setShared] = useState(values.shared_with_partners);
  const err = state.fields ?? {};
  // After a failed save React resets the form; refill it from what was sent.
  const v: GoalFormValues = state.values
    ? {
        ...values,
        ...state.values,
        is_primary: state.values.is_primary === "on",
        shared_with_partners: state.values.shared_with_partners === "on",
        show_numbers: state.values.show_numbers === "on",
      }
    : values;

  const parsedTarget = parseAmount(target);
  const suggestion =
    kind === "amount" && parsedTarget && !Number.isNaN(parsedTarget)
      ? suggestedQuarterTarget(
          { kind, target_value: parsedTarget, start_date: today, target_date: targetDate || `${today.slice(0, 4)}-12-31` },
          actualBeforeQuarter,
          today,
        )
      : null;

  return (
    <form action={action} className="flex flex-col gap-7" noValidate>
      {values.id && <input type="hidden" name="id" value={values.id} />}
      {welcome && <input type="hidden" name="welcome" value="1" />}
      <input type="hidden" name="capital" value={capital ?? ""} />
      <input type="hidden" name="kind" value={kind ?? ""} />

      {/* 1. Capital */}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-base font-semibold">Which part of life is this?</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Life capital">
          {LIFE_CAPITALS.map((c) => (
            <Chip
              key={c.key}
              selected={capital === c.key}
              role="radio"
              aria-checked={capital === c.key}
              aria-pressed={undefined}
              onClick={() => setCapital(c.key)}
            >
              {c.label}
            </Chip>
          ))}
        </div>
        {err.capital && <p className="text-sm text-below">{err.capital}</p>}
      </fieldset>

      {/* 2. Name */}
      <Field id="g-title" label="What's the goal?" error={err.title} hint="Short and specific, e.g. Emergency fund · Pass my certification">
        <Input id="g-title" name="title" defaultValue={v.title} maxLength={120} aria-invalid={Boolean(err.title)} required />
      </Field>

      {/* 3. Kind */}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-3 text-base font-semibold">How will you know you&apos;re progressing?</legend>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Goal kind">
          {GOAL_KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              role="radio"
              aria-checked={kind === k.key}
              aria-label={`${k.label}. ${k.hint}`}
              onClick={() => setKind(k.key)}
              className={cn(
                "rounded-2xl border p-4 text-left transition-colors",
                kind === k.key ? "border-primary bg-primary-soft" : "border-line bg-surface hover:bg-surface-muted",
              )}
            >
              <span className="block font-medium">{k.label}</span>
              <span className="block text-sm text-ink-muted">{k.hint}</span>
              <span className="mt-1 block text-sm italic text-ink-muted">{k.example}</span>
            </button>
          ))}
        </div>
        {err.kind && <p className="text-sm text-below">{err.kind}</p>}
      </fieldset>

      {/* 4. Kind-specific measures */}
      {kind === "amount" && (
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field id="g-target" label="Target for the year" error={err.target_value}>
            <Input id="g-target" name="target_value" inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} aria-invalid={Boolean(err.target_value)} />
          </Field>
          <Field id="g-unit" label="Unit" error={err.unit}>
            <Input id="g-unit" name="unit" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={30} list="unit-suggestions" placeholder="UGX, kg…" aria-invalid={Boolean(err.unit)} />
          </Field>
          <datalist id="unit-suggestions">
            <option value="UGX" />
            <option value="kg" />
            <option value="USD" />
            <option value="km" />
            <option value="pages" />
            <option value="modules" />
          </datalist>
          {/* Phones rarely show datalist suggestions, so offer quick picks too. */}
          <div className="col-span-2 -mt-1 flex flex-wrap gap-2" aria-label="Common units">
            {["UGX", "kg", "km", "pages", "modules"].map((u) => (
              <Chip key={u} selected={unit === u} onClick={() => setUnit(u)} className="min-h-9">
                {u}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {kind === "habit" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field id="g-weekly" label="Times per week" error={err.weekly_target}>
              <Input id="g-weekly" name="weekly_target" inputMode="decimal" defaultValue={v.weekly_target} aria-invalid={Boolean(err.weekly_target)} />
            </Field>
            <Field id="g-min" label="Minimum that counts" error={err.weekly_minimum}>
              <Input id="g-min" name="weekly_minimum" inputMode="decimal" defaultValue={v.weekly_minimum} aria-invalid={Boolean(err.weekly_minimum)} />
            </Field>
          </div>
          <p className="-mt-2 text-sm text-ink-muted">
            On a hard week, what&apos;s still a win? Meeting your minimum keeps you consistent.
          </p>
          <details className="rounded-xl border border-line bg-surface px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-ink">Add a yearly total (optional)</summary>
            <div className="mt-3 grid grid-cols-[1fr_7rem] gap-3">
              <Field id="g-yearly" label="Total for the year" error={err.target_value}>
                <Input id="g-yearly" name="target_value" inputMode="decimal" defaultValue={v.target_value} />
              </Field>
              <Field id="g-hunit" label="Unit">
                <Input id="g-hunit" name="unit" defaultValue={v.kind === "habit" ? v.unit : ""} placeholder="sessions" maxLength={30} />
              </Field>
            </div>
          </details>
        </div>
      )}

      {kind === "milestone" && (
        <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-ink-muted">
          No numbers needed. Each week you can note how it&apos;s going — growing, steady or needs attention — and mark it
          done when it is.
        </p>
      )}

      {/* 5. This quarter */}
      {kind && (
        <fieldset className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
          <legend className="px-1 text-base font-semibold">This quarter · {quarterLabel}</legend>
          <p className="-mt-1 text-sm text-ink-muted">What would good look like by the end of the quarter? Optional.</p>
          <Field id="g-mtitle" label="Quarter milestone" error={err.milestone_title}>
            <Input id="g-mtitle" name="milestone_title" defaultValue={v.milestone_title} maxLength={160} placeholder="e.g. Complete Modules 1–3" />
          </Field>
          {kind !== "milestone" && (
            <Field
              id="g-mtarget"
              label="Quarter target"
              error={err.milestone_target}
              hint={suggestion ? `Suggested: ${formatAmount(suggestion, unit)} keeps you on course for the year.` : undefined}
            >
              <Input id="g-mtarget" name="milestone_target" inputMode="decimal" defaultValue={v.milestone_target} />
            </Field>
          )}
          <Field id="g-mreward" label="Reward when you reach it" hint="Optional — something small and meaningful.">
            <Input id="g-mreward" name="milestone_reward" defaultValue={v.milestone_reward} maxLength={300} />
          </Field>
        </fieldset>
      )}

      {/* 6. Big Goal */}
      <Checkbox
        name="is_primary"
        defaultChecked={v.is_primary}
        label="Make this my Big Goal for the year"
        description="Your Big Goal leads your This Week screen. You can have one per year."
      />

      {/* 7. More */}
      <details className="rounded-2xl border border-line bg-surface px-4 py-3" open={Boolean(v.outcome || v.why || v.reward || err.target_date || err.outcome || err.why || err.reward)}>
        <summary className="cursor-pointer font-medium">More: why, target date, reward, sharing</summary>
        <div className="mt-4 flex flex-col gap-4">
          <Field id="g-outcome" label="Desired outcome" error={err.outcome}>
            <Textarea id="g-outcome" name="outcome" defaultValue={v.outcome} maxLength={1000} />
          </Field>
          <Field id="g-why" label="Why it matters" error={err.why}>
            <Textarea id="g-why" name="why" defaultValue={v.why} maxLength={1000} />
          </Field>
          <Field id="g-date" label="Target date" error={err.target_date}>
            <Input id="g-date" name="target_date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
          </Field>
          <Field id="g-reward" label="Reward for reaching the goal" error={err.reward} hint="Optional.">
            <Input id="g-reward" name="reward" defaultValue={v.reward} maxLength={300} />
          </Field>
          <Checkbox
            name="shared_with_partners"
            checked={shared}
            onChange={(e) => setShared(e.target.checked)}
            label="Share with my accountability partners"
            description="Private by default. When shared, this goal is included in check-ins you choose to publish."
          />
          {shared && kind !== "milestone" && (
            <Checkbox
              name="show_numbers"
              defaultChecked={v.show_numbers}
              label="Show amounts to partners"
              description="Otherwise partners see progress without the numbers."
              className="pl-8"
            />
          )}
        </div>
      </details>

      {state.error && (
        <p role="alert" className="text-sm text-below">
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Button type="submit" block disabled={pending}>
          {pending ? "Saving…" : values.id ? "Save changes" : "Save goal"}
        </Button>
        <Link href={cancelHref} className="inline-flex min-h-11 items-center justify-center rounded-xl text-primary hover:bg-primary-soft">
          {welcome ? "Skip for now" : "Cancel"}
        </Link>
      </div>
    </form>
  );
}
