import type { Metadata } from "next";
import { Suspense } from "react";
import { requireOnboardedMember } from "@/lib/auth/current-member";
import { listGoals } from "@/lib/data/goals";
import { quarterLabel, quarterStart } from "@/lib/domain/dates";
import { GoalForm } from "../goal-form";

export const metadata: Metadata = { title: "New goal" };

export default function NewGoalPage({ searchParams }: PageProps<"/goals/new">) {
  return (
    <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
      <NewGoal searchParams={searchParams} />
    </Suspense>
  );
}

async function NewGoal({ searchParams }: { searchParams: PageProps<"/goals/new">["searchParams"] }) {
  const member = await requireOnboardedMember();
  const welcome = (await searchParams).welcome === "1";
  const existing = await listGoals(member.today);
  const hasBigGoal = existing.some((g) => g.is_primary && g.target_date.startsWith(member.today.slice(0, 4)));

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">{welcome ? "Your first goal" : "New goal"}</h1>
        <p className="mt-1 text-ink-muted">
          {welcome ? "Start with the one that matters most this year. You can add more later." : "One clear goal at a time."}
        </p>
      </div>
      <GoalForm
        welcome={welcome}
        cancelHref={welcome ? "/week" : "/goals"}
        today={member.today}
        quarterLabel={quarterLabel(quarterStart(member.today))}
        actualBeforeQuarter={0}
        values={{
          capital: welcome ? member.focusCapitals[0] : undefined,
          title: "",
          unit: "",
          target_value: "",
          weekly_target: "",
          weekly_minimum: "",
          outcome: "",
          why: "",
          target_date: `${member.today.slice(0, 4)}-12-31`,
          reward: "",
          is_primary: !hasBigGoal,
          shared_with_partners: false,
          show_numbers: false,
          milestone_title: "",
          milestone_target: "",
          milestone_reward: "",
        }}
      />
    </>
  );
}
