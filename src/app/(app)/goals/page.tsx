import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GoalProgress } from "@/components/goal-progress";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/chip";
import { requireOnboardedMember } from "@/lib/auth/current-member";
import { listGoals, type GoalSummary } from "@/lib/data/goals";
import { LIFE_CAPITALS } from "@/lib/domain/capitals";
import { CapitalLabel, PrivacyNote } from "@/components/capital-label";

export const metadata: Metadata = { title: "Goals" };

export default function GoalsPage() {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Goals</h1>
        <Link
          href="/goals/new"
          className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-ink hover:bg-primary-hover"
        >
          Add goal
        </Link>
      </div>
      <Suspense fallback={<p className="text-ink-muted">Loading your goals…</p>}>
        <GoalList />
      </Suspense>
    </>
  );
}

async function GoalList() {
  const member = await requireOnboardedMember();
  const goals = await listGoals(member.today);

  if (goals.length === 0) {
    return (
      <Card title="Start with one goal">
        <p className="text-ink-muted">
          Pick one thing that matters this year. You don&apos;t need a goal in every part of life.
        </p>
        <Link href="/goals/new" className="mt-4 inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
          Add your first goal
        </Link>
      </Card>
    );
  }

  const big = goals.find((g) => g.is_primary && g.status !== "archived");
  const rest = goals.filter((g) => g !== big);
  const groups = LIFE_CAPITALS.map((c) => ({ ...c, goals: rest.filter((g) => g.capital === c.key) })).filter(
    (g) => g.goals.length > 0,
  );

  return (
    <div className="flex flex-col gap-6">
      {big && <GoalCard goal={big} emphasis />}
      {groups.map((group) => (
        <section key={group.key} className="flex flex-col gap-3" aria-labelledby={`cap-${group.key}`}>
          <h2 id={`cap-${group.key}`}>
            <CapitalLabel capital={group.key} className="font-medium" />
          </h2>
          {group.goals.map((g) => (
            <GoalCard key={g.id} goal={g} />
          ))}
        </section>
      ))}
    </div>
  );
}

function GoalCard({ goal, emphasis }: { goal: GoalSummary; emphasis?: boolean }) {
  return (
    <Link href={`/goals/${goal.id}`} aria-label={`${emphasis ? "My Big Goal: " : ""}${goal.title}`} className="block rounded-2xl focus-visible:outline-offset-4">
      <Card
        emphasis={emphasis}
        // Grouped cards sit under their life-area heading; only the Big Goal names its area.
        eyebrow={emphasis ? <CapitalLabel capital={goal.capital} prefix="My Big Goal · " /> : undefined}
        title={goal.title}
        className="transition-colors hover:border-primary/40"
      >
        <div className="flex flex-col gap-3">
          <GoalProgress goal={goal} />
          {goal.milestone && (
            <p className="text-sm text-ink-muted">
              This quarter: {goal.milestone.title}
              {goal.milestoneReached ? " · reached" : ""}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {goal.status === "achieved" && <Tag>Achieved</Tag>}
            {goal.status === "paused" && <Tag>Paused</Tag>}
            <PrivacyNote shared={goal.shared_with_partners} />
          </div>
        </div>
      </Card>
    </Link>
  );
}
