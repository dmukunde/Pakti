"use client";

import { useRouter } from "next/navigation";
import { createContext, use, useState, useTransition, type ReactNode } from "react";
import { createLog } from "@/app/(app)/log-actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/cn";
import { addDays, type IsoDate } from "@/lib/domain/dates";
import { formatDate } from "@/lib/domain/format";
import type { GoalKind } from "@/lib/domain/goals";
import { loggableDates, type Measure } from "@/lib/domain/week";
import { EVIDENCE_ACCEPT, checkEvidence, uploadEvidence } from "@/lib/evidence/upload";
import { createClient } from "@/lib/supabase/browser";

export type LogCommitment = {
  id: string;
  title: string;
  goal_id: string;
  goalTitle: string;
  week_start: IsoDate;
  measure: Measure;
  displayUnit: string | null;
};

export type LogGoal = { id: string; title: string; kind: GoalKind; unit: string | null };

type Target = { kind: "commitment"; commitment: LogCommitment } | { kind: "goal"; goal: LogGoal };
type Preselect = { commitmentId?: string; goalId?: string };

const LogContext = createContext<((p?: Preselect) => void) | null>(null);

export function useOpenLog() {
  const open = use(LogContext);
  if (!open) throw new Error("useOpenLog must be used inside LogProvider");
  return open;
}

type Props = {
  userId: string;
  today: IsoDate;
  commitments: LogCommitment[];
  goals: LogGoal[];
  children: ReactNode;
};

// Owns the Log sheet so any part of a page can open it, optionally on a
// specific commitment or goal.
export function LogProvider({ userId, today, commitments, goals, children }: Props) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function openLog(p?: Preselect) {
    const c = p?.commitmentId ? commitments.find((x) => x.id === p.commitmentId) : undefined;
    const g = p?.goalId ? goals.find((x) => x.id === p.goalId) : undefined;
    setTarget(c ? { kind: "commitment", commitment: c } : g ? { kind: "goal", goal: g } : null);
    setOpen(true);
  }

  return (
    <LogContext value={openLog}>
      {children}
      {toast && (
        <div role="status" className="fixed inset-x-4 bottom-24 z-30 mx-auto max-w-md rounded-2xl bg-ink px-4 py-3 text-sm text-bg shadow-lg sm:bottom-6">
          {toast}
        </div>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title={target ? "Log progress" : "What did you do?"}>
        {open &&
          (target ? (
            <LogForm
              key={target.kind === "commitment" ? target.commitment.id : target.goal.id}
              target={target}
              goals={goals}
              userId={userId}
              today={today}
              onBack={() => setTarget(null)}
              onDone={(message, again) => {
                setToast(message);
                setTimeout(() => setToast(null), 4000);
                if (again) setTarget(null);
                else setOpen(false);
              }}
            />
          ) : (
            <Chooser commitments={commitments} goals={goals} onPick={setTarget} />
          ))}
      </Sheet>
    </LogContext>
  );
}

function Chooser({ commitments, goals, onPick }: { commitments: LogCommitment[]; goals: LogGoal[]; onPick: (t: Target) => void }) {
  const [showGoals, setShowGoals] = useState(commitments.length === 0);
  return (
    <div className="flex flex-col gap-3">
      {commitments.length > 0 && (
        <>
          <p className="text-sm text-ink-muted">This week</p>
          {commitments.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPick({ kind: "commitment", commitment: c })}
              className="flex min-h-14 flex-col items-start justify-center rounded-2xl border border-line px-4 py-2 text-left hover:bg-surface-muted"
            >
              <span className="font-medium">{c.title}</span>
              <span className="text-sm text-ink-muted">{c.goalTitle}</span>
            </button>
          ))}
        </>
      )}
      {showGoals ? (
        <>
          <p className="mt-2 text-sm text-ink-muted">Log to a goal</p>
          {goals.length === 0 && <p className="text-ink-muted">Add a goal first.</p>}
          {goals.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onPick({ kind: "goal", goal: g })}
              className="min-h-11 rounded-xl border border-line px-4 text-left hover:bg-surface-muted"
            >
              {g.title}
            </button>
          ))}
        </>
      ) : (
        <Button variant="quiet" onClick={() => setShowGoals(true)}>
          Log to a goal…
        </Button>
      )}
    </div>
  );
}

function dayLabel(d: IsoDate, today: IsoDate) {
  if (d === today) return "Today";
  if (d === addDays(today, -1)) return "Yesterday";
  const weekday = new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  return `${weekday} ${formatDate(d)}`;
}

function LogForm({
  target,
  goals,
  userId,
  today,
  onBack,
  onDone,
}: {
  target: Target;
  goals: LogGoal[];
  userId: string;
  today: IsoDate;
  onBack: () => void;
  onDone: (message: string, again: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  const goal = target.kind === "goal" ? target.goal : goals.find((g) => g.id === target.commitment.goal_id);
  const commitment = target.kind === "commitment" ? target.commitment : null;
  const isDone = commitment ? commitment.measure === "done" : goal?.kind === "milestone";
  const unit = commitment ? commitment.displayUnit : goal?.unit ?? null;
  // Counting a habit: no number means one time.
  const amountOptional = goal?.kind === "habit" && (!commitment || (commitment.measure === "quantity" && commitment.displayUnit === "times"));
  const dates = loggableDates(today, commitment?.week_start);

  function submit(formData: FormData, again: boolean) {
    setError(null);
    const fileError = checkEvidence(files);
    if (fileError) return setError(fileError);
    startTransition(async () => {
      const result = await createLog(formData);
      if (!result.ok) return setError(result.error);
      let message = result.message;
      if (files.length) {
        const { failed } = await uploadEvidence(createClient(), userId, result.logId, files);
        if (failed.length) message += ` Couldn't attach: ${failed.join(", ")}.`;
        router.refresh();
      }
      onDone(message, again);
    });
  }

  return (
    <form action={(fd) => submit(fd, false)} className="flex flex-col gap-4">
      <input type="hidden" name="goal_id" value={goal?.id ?? ""} />
      {commitment && <input type="hidden" name="commitment_id" value={commitment.id} />}

      <div>
        <p className="font-medium">{commitment ? commitment.title : goal?.title}</p>
        {commitment && <p className="text-sm text-ink-muted">{commitment.goalTitle}</p>}
      </div>

      {!isDone && (
        <Field id="log-amount" label={`${amountOptional ? "How many? (optional)" : "How much?"}${unit ? ` · ${unit}` : ""}`}>
          <Input id="log-amount" name="amount" inputMode="decimal" autoFocus placeholder={amountOptional ? "1" : ""} />
        </Field>
      )}

      <Field id="log-date" label="When">
        <select id="log-date" name="occurred_on" defaultValue={dates[0]} className="min-h-11 w-full rounded-xl border border-line bg-surface px-4 text-base">
          {dates.map((d) => (
            <option key={d} value={d}>
              {dayLabel(d, today)}
            </option>
          ))}
        </select>
      </Field>

      <details className="rounded-xl border border-line px-4 py-2">
        <summary className="min-h-9 cursor-pointer py-1 text-sm font-medium">Add a note or evidence</summary>
        <div className="mt-3 flex flex-col gap-4 pb-2">
          <Field id="log-desc" label="What did you do?">
            <Input id="log-desc" name="description" maxLength={160} placeholder="e.g. Gym session · Paid myself first" />
          </Field>
          <Field id="log-note" label="Note or learning">
            <Textarea id="log-note" name="note" rows={2} maxLength={2000} />
          </Field>
          <Field id="log-files" label="Evidence (private)" hint="Photos or PDFs, up to 5 MB each. Only you can see them.">
            <input
              id="log-files"
              type="file"
              multiple
              accept={EVIDENCE_ACCEPT}
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="text-sm file:mr-3 file:min-h-11 file:rounded-xl file:border file:border-line file:bg-surface file:px-4 file:text-ink"
            />
          </Field>
        </div>
      </details>

      {error && (
        <p role="alert" className="text-sm text-below">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button type="submit" block disabled={pending}>
          {pending ? "Saving…" : isDone ? "Mark done" : "Save"}
        </Button>
        <Button
          variant="quiet"
          block
          disabled={pending}
          onClick={(e) => submit(new FormData(e.currentTarget.form!), true)}
        >
          Save and log another
        </Button>
        <button type="button" onClick={onBack} className={cn("min-h-11 text-sm text-ink-muted", pending && "invisible")}>
          Choose something else
        </button>
      </div>
    </form>
  );
}

/** An inline button that opens the Log sheet on one goal. */
export function LogGoalButton({ goalId }: { goalId: string }) {
  const openLog = useOpenLog();
  return (
    <Button block onClick={() => openLog({ goalId })}>
      Log progress
    </Button>
  );
}

/** The floating "+ Log" button. */
export function LogButton() {
  const openLog = useOpenLog();
  return (
    <>
      {/* Room under the content so the floating button never covers the last card. */}
      <div aria-hidden className="h-16" />
      <button
        type="button"
        onClick={() => openLog()}
        className="fixed bottom-20 right-4 z-20 flex min-h-14 items-center gap-2 rounded-full bg-primary px-5 text-base font-semibold text-primary-ink shadow-lg hover:opacity-90 sm:bottom-8 sm:right-8"
      >
        <span aria-hidden className="text-xl leading-none">+</span> Log
      </button>
    </>
  );
}
