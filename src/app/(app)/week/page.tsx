import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GoalProgress } from "@/components/goal-progress";
import { Card } from "@/components/ui/card";
import { requireOnboardedMember } from "@/lib/auth/current-member";
import { listGoals } from "@/lib/data/goals";
import { capitalLabel } from "@/lib/domain/capitals";
import { formatDate } from "@/lib/domain/format";
import { weekStart } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "This Week" };

export default function WeekPage() {
  return (
    <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
      <ThisWeek />
    </Suspense>
  );
}

async function ThisWeek() {
  const member = await requireOnboardedMember();
  const goals = (await listGoals(member.today)).filter((g) => g.status === "active");
  const big = goals.find((g) => g.is_primary);
  const others = goals.filter((g) => g !== big);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">{member.displayName ? `Hello, ${member.displayName}` : "Hello"}</h1>
        <p className="mt-1 text-ink-muted">Week of {formatDate(weekStart(member.today))}</p>
      </div>

      {big ? (
        <Link href={`/goals/${big.id}`} className="block rounded-2xl">
          <Card emphasis eyebrow={`My Big Goal · ${capitalLabel(big.capital)}`} title={big.title}>
            <div className="flex flex-col gap-3">
              <GoalProgress goal={big} />
              {big.milestone && <p className="text-sm text-ink-muted">This quarter: {big.milestone.title}</p>}
            </div>
          </Card>
        </Link>
      ) : (
        <Card title={goals.length ? "Choose your Big Goal" : "Set your first goal"}>
          <p className="text-ink-muted">
            {goals.length
              ? "Which goal matters most this year? Mark it as your Big Goal and it will lead this screen."
              : "Start with the one thing that matters most this year."}
          </p>
          <Link href={goals.length ? "/goals" : "/goals/new"} className="mt-3 inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
            {goals.length ? "Go to goals" : "Add a goal"}
          </Link>
        </Card>
      )}

      <Card eyebrow="Coming next" title="What matters this week?">
        <p className="text-ink-muted">
          Soon you&apos;ll choose up to five commitments for the week here, log progress in a few seconds, and check in on
          Sunday.
        </p>
      </Card>

      {others.length > 0 && (
        <p className="text-sm text-ink-muted">
          Also in your year: {others.map((g) => g.title).join(" · ")}
        </p>
      )}
    </>
  );
}
