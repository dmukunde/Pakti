"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Field, Input, Textarea } from "@/components/ui/field";
import { LIFE_CAPITALS, type LifeCapital } from "@/lib/domain/capitals";
import { completeOnboarding, type OnboardingState } from "./actions";

type Initial = { displayName: string; vision: string; visionWhy: string; focusCapitals: LifeCapital[] };

const STEPS = ["name", "vision", "why", "capitals"] as const;

export function OnboardingFlow({ initial }: { initial: Initial }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial.displayName);
  const [vision, setVision] = useState(initial.vision);
  const [why, setWhy] = useState(initial.visionWhy);
  const [capitals, setCapitals] = useState<LifeCapital[]>(initial.focusCapitals);
  const [state, action, pending] = useActionState<OnboardingState, FormData>(completeOnboarding, {});

  const current = STEPS[step];
  const last = step === STEPS.length - 1;
  const canContinue = current !== "name" || name.trim().length > 0;

  return (
    <form
      action={action}
      onSubmit={(e) => {
        // Enter on an earlier step moves forward instead of finishing.
        if (!last) {
          e.preventDefault();
          if (canContinue) setStep((s) => s + 1);
        }
      }}
      className="flex flex-1 flex-col gap-6"
    >
      {/* Every answer travels with the final submit. */}
      <input type="hidden" name="display_name" value={name} />
      <input type="hidden" name="vision" value={vision} />
      <input type="hidden" name="vision_why" value={why} />
      {capitals.map((c) => (
        <input key={c} type="hidden" name="focus_capitals" value={c} />
      ))}

      <p className="text-sm text-ink-muted" aria-live="polite">
        Step {step + 1} of {STEPS.length}
      </p>

      {current === "name" && (
        <section className="flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-semibold">Welcome to Pakti</h1>
            <p className="mt-2 text-ink-muted">
              Progress, consistency, learning and restarting — not perfection. A few quick questions to set your
              direction. You can change any of this later.
            </p>
          </div>
          <Field id="ob-name" label="What should we call you?">
            <Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={80} autoFocus />
          </Field>
        </section>
      )}

      {current === "vision" && (
        <section className="flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-semibold">Where are you heading?</h1>
            <p className="mt-2 text-ink-muted">In three years, what would you love to be true of your life? A sentence or two is enough.</p>
          </div>
          <Field id="ob-vision" label="My 3-year vision" hint="e.g. Financially steady, healthy, and leading my team with confidence.">
            <Textarea id="ob-vision" rows={4} value={vision} onChange={(e) => setVision(e.target.value)} maxLength={2000} autoFocus />
          </Field>
        </section>
      )}

      {current === "why" && (
        <section className="flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-semibold">Why does it matter?</h1>
            <p className="mt-2 text-ink-muted">On hard weeks, this is what you&apos;ll come back to.</p>
          </div>
          <Field id="ob-why" label="Why this matters to me">
            <Textarea id="ob-why" rows={4} value={why} onChange={(e) => setWhy(e.target.value)} maxLength={2000} autoFocus />
          </Field>
        </section>
      )}

      {current === "capitals" && (
        <section className="flex flex-col gap-5">
          <div>
            <h1 className="text-2xl font-semibold">Where will you focus?</h1>
            <p className="mt-2 text-ink-muted">Pick the areas of life you want to grow in this year. You don&apos;t need all seven.</p>
          </div>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Focus capitals</legend>
            {LIFE_CAPITALS.map((c) => (
              <Chip
                key={c.key}
                selected={capitals.includes(c.key)}
                onClick={() => setCapitals((s) => (s.includes(c.key) ? s.filter((k) => k !== c.key) : [...s, c.key]))}
              >
                {c.label}
              </Chip>
            ))}
          </fieldset>
        </section>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-3">
        {/* Distinct keys matter: if React reused a "next" button as a submit
            button mid-click, the browser would submit the form early. */}
        {!last ? (
          <>
            <Button key="next" block disabled={!canContinue} onClick={() => setStep((s) => s + 1)}>
              Continue
            </Button>
            {current !== "name" && (
              <Button key="skip" block variant="quiet" onClick={() => setStep((s) => s + 1)}>
                Skip for now
              </Button>
            )}
          </>
        ) : (
          <>
            <Button key="finish-goal" type="submit" name="then" value="goal" block disabled={pending}>
              {pending ? "Saving…" : "Set my first goal"}
            </Button>
            <Button key="finish-week" type="submit" name="then" value="week" block variant="quiet" disabled={pending}>
              I&apos;ll add goals later
            </Button>
          </>
        )}
        {step > 0 && (
          <Button block variant="quiet" onClick={() => setStep((s) => s - 1)} disabled={pending}>
            Back
          </Button>
        )}
      </div>
    </form>
  );
}
