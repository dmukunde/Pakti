import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import { Tag } from "@/components/ui/chip";
import { requireOnboardedMember } from "@/lib/auth/current-member";
import { getMyNotes, getPartnerCheckins, getPartnerships, type Snapshot } from "@/lib/data/checkins";
import { formatAmount, formatDate } from "@/lib/domain/format";
import { NoteForm } from "./note-form";

export const metadata: Metadata = { title: "Partner" };

const RESULT_TEXT = { achieved: "Achieved", within: "Minimum reached", below: "Below minimum" } as const;

export default function PartnerPage({ params }: PageProps<"/partners/[memberId]">) {
  return (
    <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
      <PartnerView params={params} />
    </Suspense>
  );
}

async function PartnerView({ params }: { params: PageProps<"/partners/[memberId]">["params"] }) {
  const member = await requireOnboardedMember();
  const { memberId } = await params;
  const supported = (await getPartnerships()).find((p) => p.role === "i_support" && p.other_user_id === memberId);
  if (!supported) notFound();

  const checkins = await getPartnerCheckins(memberId);
  const myNotes = await getMyNotes(checkins.map((c) => c.reflection_id), member.id);
  const name = supported.other_display_name || "Your partner";

  return (
    <>
      <Link href="/partners" className="inline-flex min-h-11 items-center text-sm text-primary">
        ← Partners
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{name}</h1>
        <p className="mt-1 text-ink-muted">Encourage, don&apos;t audit. A few warm words go a long way.</p>
      </div>

      {checkins.length === 0 && (
        <Card title="Nothing shared yet">
          <p className="text-ink-muted">When {name} publishes a weekly check-in, it will appear here.</p>
        </Card>
      )}

      {checkins.map((c) => (
        <Card key={c.reflection_id} eyebrow={`Week of ${formatDate(c.period_start)}`} title={`Shared ${formatDate(c.published_at.slice(0, 10))}`}>
          <SnapshotView snapshot={c.snapshot} />
          <div className="mt-4 border-t border-line pt-4">
            <NoteForm reflectionId={c.reflection_id} existing={myNotes[c.reflection_id] ?? ""} name={name} />
          </div>
        </Card>
      ))}
    </>
  );
}

function SnapshotView({ snapshot }: { snapshot: Snapshot }) {
  const r = snapshot.reflection;
  const answers: Array<[string, string | null]> = [
    ["Wins", r.wins],
    ["Challenges", r.challenges],
    ["What I learned", r.learned],
    ["Support I need", r.support_needed],
    ["Next commitments", r.next_steps],
  ];
  return (
    <div className="flex flex-col gap-4">
      {snapshot.commitments.length > 0 && (
        <ul className="flex flex-col gap-2">
          {snapshot.commitments.map((c, i) => (
            <li key={i} className="flex items-start justify-between gap-3 text-sm">
              <span>
                {c.title}
                <span className="block text-ink-muted">{c.goal_title}</span>
              </span>
              <span className="shrink-0 text-right">
                {RESULT_TEXT[c.result]}
                {c.measure === "quantity" && c.actual !== null && c.target !== null && (
                  <span className="block text-ink-muted">
                    {formatAmount(c.actual, c.unit)} of {formatAmount(c.target, c.unit)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {answers
        .filter(([, v]) => v)
        .map(([label, v]) => (
          <div key={label}>
            <p className="text-sm text-ink-muted">{label}</p>
            <p className="whitespace-pre-line">{v}</p>
          </div>
        ))}
      {snapshot.goals.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {snapshot.goals.map((g, i) => (
            <Tag key={i}>
              {g.is_primary ? "Big Goal: " : ""}
              {g.title} · {g.progress_label}
            </Tag>
          ))}
        </div>
      )}
    </div>
  );
}
