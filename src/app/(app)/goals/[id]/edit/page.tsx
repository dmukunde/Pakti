import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireOnboardedMember } from "@/lib/auth/current-member";
import { getGoal } from "@/lib/data/goals";
import { addDays, quarterLabel, quarterStart } from "@/lib/domain/dates";
import { totalFor } from "@/lib/domain/goals";
import { GoalForm } from "../../goal-form";

export const metadata: Metadata = { title: "Edit goal" };

export default function EditGoalPage({ params }: PageProps<"/goals/[id]/edit">) {
  return (
    <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
      <EditGoal params={params} />
    </Suspense>
  );
}

const str = (n: number | null) => (n === null ? "" : String(n));

async function EditGoal({ params }: { params: PageProps<"/goals/[id]/edit">["params"] }) {
  const member = await requireOnboardedMember();
  const { id } = await params;
  const goal = await getGoal(id, member.today);
  if (!goal) notFound();

  const qStart = quarterStart(member.today);
  const before = totalFor(goal, goal.logs,goal.start_date, addDays(qStart, -1));

  return (
    <>
      <h1 className="text-2xl font-semibold">Edit goal</h1>
      <GoalForm
        cancelHref={`/goals/${goal.id}`}
        today={member.today}
        quarterLabel={quarterLabel(qStart)}
        actualBeforeQuarter={before}
        values={{
          id: goal.id,
          capital: goal.capital,
          title: goal.title,
          kind: goal.kind,
          unit: goal.unit ?? "",
          target_value: str(goal.target_value),
          weekly_target: str(goal.weekly_target),
          weekly_minimum: str(goal.weekly_minimum),
          outcome: goal.outcome ?? "",
          why: goal.why ?? "",
          target_date: goal.target_date,
          reward: goal.reward ?? "",
          is_primary: goal.is_primary,
          shared_with_partners: goal.shared_with_partners,
          show_numbers: goal.show_numbers,
          milestone_title: goal.milestone?.title ?? "",
          milestone_target: str(goal.milestone?.target_value ?? null),
          milestone_reward: goal.milestone?.reward ?? "",
        }}
      />
    </>
  );
}
