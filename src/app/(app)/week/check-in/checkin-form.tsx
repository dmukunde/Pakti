"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Checkbox, Field, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { CHECKIN_STATUS_LABELS, type CheckinStatus } from "@/lib/domain/goals";
import type { Result } from "@/lib/domain/week";
import { saveCheckin, type CheckinState } from "./actions";

export type CheckinCommitment = {
  id: string;
  title: string;
  goalTitle: string;
  result: Result;
  label: string;
  /** Pre-ticked for publishing when its goal is shared. */
  shared: boolean;
};

export type MilestoneGoal = { id: string; title: string; status: CheckinStatus | null };

type Props = {
  week: string;
  weekLabel: string;
  recovery: boolean;
  values: Record<"wins" | "challenges" | "learned" | "support_needed" | "next_steps", string>;
  commitments: CheckinCommitment[];
  milestoneGoals: MilestoneGoal[];
  sharedGoalTitles: string[];
  partnerNames: string[];
  published: boolean;
};

const RESULT_TEXT: Record<Result, string> = { achieved: "Achieved", within: "Minimum reached", below: "Below minimum" };

export function CheckinForm(props: Props) {
  const { week, recovery, values, commitments, milestoneGoals, sharedGoalTitles, partnerNames, published } = props;
  const [state, action, pending] = useActionState<CheckinState, FormData>(saveCheckin, {});
  const [ticked, setTicked] = useState<Set<string>>(new Set(commitments.filter((c) => c.shared).map((c) => c.id)));
  const [previewing, setPreviewing] = useState(false);
  const [text, setText] = useState(values);

  const prompts: Array<[keyof Props["values"], string, string]> = recovery
    ? [
        ["challenges", "What got in the way this week?", "No judgement — just what happened."],
        ["learned", "What did you learn?", ""],
        ["wins", "Anything that went well, however small?", ""],
        ["support_needed", "What support would help?", ""],
        ["next_steps", "What's the smallest useful step next week?", "One small thing is enough."],
      ]
    : [
        ["wins", "Wins", "What went well? Small wins count."],
        ["challenges", "Challenges", "What was hard?"],
        ["learned", "What I learned", ""],
        ["support_needed", "Support I need", "What would help from your partner?"],
        ["next_steps", "My next commitments", "What will you focus on next week?"],
      ];

  const hasPartners = partnerNames.length > 0;
  const tickedList = commitments.filter((c) => ticked.has(c.id));

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="week" value={week} />
      {[...ticked].map((id) => (
        <input key={id} type="hidden" name="share" value={id} />
      ))}

      {commitments.length > 0 && (
        <section aria-labelledby="summary" className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
          <h2 id="summary" className="font-semibold">
            Your week at a glance
          </h2>
          <ul className="flex flex-col gap-2">
            {commitments.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3 text-sm">
                <span>
                  {c.title}
                  <span className="block text-ink-muted">{c.goalTitle}</span>
                </span>
                <span
                  className={cn(
                    "shrink-0",
                    c.result === "achieved" && "text-achieved",
                    c.result === "within" && "text-within",
                    c.result === "below" && "text-ink-muted",
                  )}
                >
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recovery && (
        <p className="rounded-2xl bg-surface-muted px-4 py-3 text-ink-muted">
          A hard week is part of the journey. Coming back to reflect is what matters.
        </p>
      )}

      {prompts.map(([name, label, hint]) => (
        <Field key={name} id={`ci-${name}`} label={label} hint={hint || undefined}>
          <Textarea
            id={`ci-${name}`}
            name={name}
            rows={3}
            maxLength={2000}
            value={text[name]}
            onChange={(e) => setText((t) => ({ ...t, [name]: e.target.value }))}
          />
        </Field>
      ))}

      {milestoneGoals.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="font-semibold">How are these going?</h2>
          {milestoneGoals.map((g) => (
            <MilestoneStatus key={g.id} goal={g} />
          ))}
        </section>
      )}

      {hasPartners && commitments.length > 0 && (
        <fieldset className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
          <legend className="px-1 font-semibold">Include when publishing</legend>
          <p className="mb-2 text-sm text-ink-muted">Ticked for goals you share. Everything else stays private.</p>
          {commitments.map((c) => (
            <Checkbox
              key={c.id}
              checked={ticked.has(c.id)}
              onChange={(e) =>
                setTicked((s) => {
                  const next = new Set(s);
                  if (e.target.checked) next.add(c.id);
                  else next.delete(c.id);
                  return next;
                })
              }
              label={c.title}
              description={c.goalTitle}
            />
          ))}
        </fieldset>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p role="status" className="text-sm font-medium text-achieved">
          {state.ok}
        </p>
      )}

      {previewing && hasPartners ? (
        <section aria-label="Preview" className="flex flex-col gap-3 rounded-2xl border-2 border-primary/40 bg-primary-soft p-4">
          <h2 className="font-semibold">{partnerNames.join(" and ")} will see:</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {tickedList.length === 0 && <li className="text-ink-muted">No commitments</li>}
            {tickedList.map((c) => (
              <li key={c.id}>
                {c.title} — {RESULT_TEXT[c.result]}
              </li>
            ))}
          </ul>
          {sharedGoalTitles.length > 0 && <p className="text-sm">Shared goals: {sharedGoalTitles.join(" · ")} (progress, amounts only if you chose to show them)</p>}
          <p className="text-sm">Your answers above.</p>
          <p className="text-sm text-ink-muted">Never shared: your logs, notes, evidence photos and private goals.</p>
          <div className="flex flex-col gap-2">
            <Button type="submit" name="intent" value="publish" block disabled={pending}>
              {pending ? "Publishing…" : published ? "Update what partners see" : "Publish to partners"}
            </Button>
            <Button variant="quiet" block onClick={() => setPreviewing(false)}>
              Back to editing
            </Button>
          </div>
        </section>
      ) : (
        <div className="flex flex-col gap-2">
          {hasPartners ? (
            <Button block onClick={() => setPreviewing(true)}>
              {published ? "Review and update for partners" : "Preview and publish"}
            </Button>
          ) : (
            <p className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-ink-muted">
              Check-ins are private until you have an accountability partner.{" "}
              <Link href="/partners" className="font-medium text-primary">
                Invite a partner
              </Link>
            </p>
          )}
          <Button type="submit" name="intent" value="save" variant={hasPartners ? "quiet" : "primary"} block disabled={pending}>
            {pending ? "Saving…" : "Save privately"}
          </Button>
        </div>
      )}
    </form>
  );
}

function MilestoneStatus({ goal }: { goal: MilestoneGoal }) {
  const [status, setStatus] = useState<CheckinStatus | null>(goal.status);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium">{goal.title}</p>
      {status && <input type="hidden" name={`status:${goal.id}`} value={status} />}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`How ${goal.title} is going`}>
        {(Object.keys(CHECKIN_STATUS_LABELS) as CheckinStatus[]).map((s) => (
          <Chip key={s} selected={status === s} role="radio" aria-checked={status === s} aria-pressed={undefined} onClick={() => setStatus(s)}>
            {CHECKIN_STATUS_LABELS[s]}
          </Chip>
        ))}
      </div>
    </div>
  );
}
