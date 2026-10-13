import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CapitalLabel } from "@/components/capital-label";
import { Card } from "@/components/ui/card";
import { ProgressLine } from "@/components/ui/progress-line";
import { requireOnboardedMember } from "@/lib/auth/current-member";
import { getProgress, type GoalProgressRow, type Period } from "@/lib/data/progress";
import { cn } from "@/lib/cn";
import { quarterLabel, quarterStart } from "@/lib/domain/dates";
import { formatAmount, formatDate, formatNumber, formatProgress } from "@/lib/domain/format";
import { CHECKIN_STATUS_LABELS } from "@/lib/domain/goals";
import type { FocusDot } from "@/lib/domain/week";

export const metadata: Metadata = { title: "Progress" };

const DOT_LABELS: Record<FocusDot, string> = {
  kept: "minimums kept",
  some: "partly kept",
  missed: "below minimum",
  not_in_focus: "not planned",
  upcoming: "still to come",
};

export default function ProgressPage({ searchParams }: PageProps<"/progress">) {
  return (
    <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
      <Progress searchParams={searchParams} />
    </Suspense>
  );
}

async function Progress({ searchParams }: { searchParams: PageProps<"/progress">["searchParams"] }) {
  const member = await requireOnboardedMember();
  const period: Period = (await searchParams).period === "year" ? "year" : "quarter";
  const data = await getProgress(period, member.today);
  const qLabel = quarterLabel(quarterStart(member.today));
  const year = member.today.slice(0, 4);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Progress</h1>
        <nav aria-label="Period" className="grid grid-cols-2 rounded-xl bg-surface-muted p-1 text-sm">
          {(
            [
              ["quarter", qLabel],
              ["year", year],
            ] as const
          ).map(([key, label]) => (
            <Link
              key={key}
              href={key === "quarter" ? "/progress" : "/progress?period=year"}
              aria-current={period === key ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center justify-center rounded-lg px-3 font-medium",
                period === key ? "bg-primary text-primary-ink" : "text-ink-muted hover:text-ink",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {/* At a glance */}
      <section aria-label="At a glance" className="grid grid-cols-3 gap-2">
        <Stat label="Weeks planned" value={formatNumber(data.plannedWeeks)} />
        <Stat label="Minimums kept" value={`${data.keptWeeks}`} sub={data.plannedWeeks ? `of ${data.plannedWeeks}` : undefined} />
        <Stat label="Actions logged" value={formatNumber(data.actionsLogged)} />
      </section>

      <Card title="Your weeks">
        <ol className="flex flex-wrap gap-1.5" aria-label={`Weeks in ${period === "quarter" ? qLabel : year}`}>
          {data.weeks.map(({ week, dot }) => (
            <li key={week}>
              <span
                title={`Week of ${formatDate(week)}: ${DOT_LABELS[dot]}`}
                aria-label={`Week of ${formatDate(week)}: ${DOT_LABELS[dot]}`}
                className={cn(
                  "block rounded-full border",
                  period === "year" ? "size-3" : "size-4",
                  dot === "kept" && "border-achieved bg-achieved",
                  dot === "some" && "border-within bg-within",
                  dot === "missed" && "border-below bg-transparent",
                  dot === "not_in_focus" && "border-line-strong bg-surface-muted",
                  dot === "upcoming" && "border-dashed border-line-strong bg-transparent",
                )}
              />
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-ink-muted">
          Green: minimums kept · Amber: partly · Outline: below · Grey: not planned. Restarting counts — there are no
          streaks here.
        </p>
      </Card>

      {/* Goals */}
      <section aria-labelledby="goals-progress" className="flex flex-col gap-3">
        <h2 id="goals-progress" className="text-lg font-semibold">
          Your goals
        </h2>
        {data.goals.length === 0 ? (
          <p className="text-ink-muted">
            <Link href="/goals/new" className="font-medium text-primary">
              Add a goal
            </Link>{" "}
            to see progress here.
          </p>
        ) : (
          data.goals.map((g) => <GoalRow key={g.id} goal={g} period={period} />)
        )}
      </section>

      {/* Life areas */}
      {data.capitals.length > 0 && (
        <Card title="By life area">
          <ul className="flex flex-col divide-y divide-line">
            {data.capitals.map((c) => (
              <li key={c.capital} className="flex items-center justify-between gap-3 py-2.5">
                <CapitalLabel capital={c.capital} className="text-base text-ink" />
                <span className="text-right text-sm text-ink-muted">
                  {c.goals} {c.goals === 1 ? "goal" : "goals"} · active in {c.activeWeeks} {c.activeWeeks === 1 ? "week" : "weeks"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Wins and learnings */}
      <Card title="Wins and learnings">
        {data.moments.length === 0 ? (
          <p className="text-ink-muted">
            Wins and lessons from your check-ins and notes will gather here — a record of how you&apos;re growing.
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {data.moments.map((m, i) => (
              <li key={i} className="flex flex-col gap-0.5">
                <span className="text-xs font-medium uppercase tracking-wide text-accent">
                  {m.kind === "win" ? "Win" : m.kind === "learned" ? "Learned" : "Note"}
                  <span className="font-normal normal-case tracking-normal text-ink-muted">
                    {" "}
                    · {formatDate(m.date)}
                    {m.goalTitle ? ` · ${m.goalTitle}` : ""}
                  </span>
                </span>
                <p className="whitespace-pre-line">{m.text}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold">
        {value}
        {sub && <span className="ml-1 text-sm font-normal text-ink-muted">{sub}</span>}
      </p>
    </div>
  );
}

function GoalRow({ goal, period }: { goal: GoalProgressRow; period: Period }) {
  // Numeric progress for the chosen period: the quarter milestone, or the year target.
  const numeric = goal.kind === "milestone" ? null : period === "quarter" ? goal.quarterProgress : goal.yearProgress;
  const consistency = goal.focusWeeks > 0 ? `${goal.keptWeeks} of ${goal.focusWeeks} focus ${goal.focusWeeks === 1 ? "week" : "weeks"} kept` : "Not in your weekly plans yet";

  return (
    <Link href={`/goals/${goal.id}`} aria-label={goal.title} className="block rounded-2xl">
      <Card
        eyebrow={<CapitalLabel capital={goal.capital} prefix={goal.is_primary ? "Big Goal · " : undefined} />}
        title={goal.title}
        className="transition-colors hover:border-primary/40"
      >
        <div className="flex flex-col gap-2">
          {goal.kind === "milestone" ? (
            <p className="text-sm">
              <span className="font-medium">
                {goal.status === "achieved" ? "Achieved" : goal.latestStatus ? CHECKIN_STATUS_LABELS[goal.latestStatus] : "In progress"}
              </span>
            </p>
          ) : numeric ? (
            <>
              <ProgressLine
                value={numeric.actual}
                target={numeric.target}
                tone={numeric.share >= 1 ? "achieved" : "neutral"}
                label={formatProgress(numeric.actual, numeric.target, goal.unit)}
              />
              <p className="text-sm text-ink-muted">
                {formatProgress(numeric.actual, numeric.target, goal.unit)} · {Math.round(numeric.share * 100)}%
                {period === "quarter" ? " of this quarter's milestone" : " of the year"}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-muted">
              {period === "quarter"
                ? `${formatAmount(goal.quarterActual, goal.unit ?? (goal.kind === "habit" ? "times" : null))} this quarter`
                : `${formatAmount(goal.yearActual, goal.unit ?? (goal.kind === "habit" ? "times" : null))} this year`}
            </p>
          )}
          <p className="text-sm text-ink-muted">{consistency}</p>
        </div>
      </Card>
    </Link>
  );
}
