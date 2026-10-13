import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireOnboardedMember } from "@/lib/auth/current-member";
import { getPartnerCheckins, getPartnerships } from "@/lib/data/checkins";
import { formatDate } from "@/lib/domain/format";
import { cancelInvite, endPartnership } from "./actions";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Partners" };

export default function PartnersPage({ searchParams }: PageProps<"/partners">) {
  return (
    <>
      <h1 className="text-2xl font-semibold">Partners</h1>
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <Partners searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Partners({ searchParams }: { searchParams: PageProps<"/partners">["searchParams"] }) {
  const member = await requireOnboardedMember();
  const accepted = (await searchParams).accepted === "1";
  const [all, checkins] = await Promise.all([getPartnerships(), getPartnerCheckins()]);
  const supportMe = all.filter((p) => p.role === "supports_me");
  const iSupport = all.filter((p) => p.role === "i_support");
  const full = supportMe.length >= 2;
  const latestBy = new Map<string, string>();
  for (const c of checkins) if (!latestBy.has(c.member_id)) latestBy.set(c.member_id, c.published_at);

  // After accepting: offer to make it mutual, if they don't already support you.
  const newest = accepted ? iSupport[0] : undefined;
  const alreadyMutual = newest && supportMe.some((p) => p.other_user_id === newest.other_user_id);

  return (
    <>
      {newest && (
        <Card emphasis title={`You're now supporting ${newest.other_display_name || "your partner"}`}>
          {!alreadyMutual && !full ? (
            <div className="flex flex-col gap-3">
              <p className="text-ink-muted">Would you like {newest.other_display_name || "them"} to support you too?</p>
              <InviteForm suggestedLabel={newest.other_display_name || undefined} />
            </div>
          ) : (
            <p className="text-ink-muted">You&apos;ll see their check-ins here when they publish them.</p>
          )}
        </Card>
      )}

      <section aria-labelledby="supports-me" className="flex flex-col gap-3">
        <h2 id="supports-me" className="text-lg font-semibold">
          Supporting you
        </h2>
        <p className="text-sm text-ink-muted">
          Up to two people who see only the check-ins you choose to publish. Everything else stays private.
        </p>
        {supportMe.map((p) => (
          <div key={p.partnership_id} className="flex items-start justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
            <div>
              <p className="font-medium">
                {p.status === "active" ? p.other_display_name || "Your partner" : p.invite_label || p.invite_email || "Invite"}
              </p>
              <p className="text-sm text-ink-muted">
                {p.status === "active"
                  ? `Partner since ${formatDate((p.accepted_at ?? p.created_at).slice(0, 10))}`
                  : `Invite waiting · expires ${formatDate((p.invite_expires_at ?? p.created_at).slice(0, 10))}`}
              </p>
            </div>
            <form action={p.status === "active" ? endPartnership : cancelInvite}>
              <input type="hidden" name="id" value={p.partnership_id} />
              <Button type="submit" variant="quiet" className="px-3 text-sm text-ink-muted">
                {p.status === "active" ? "End" : "Cancel"}
              </Button>
            </form>
          </div>
        ))}
        {!full && !newest && <InviteForm />}
        {supportMe.length === 0 && (
          <p className="text-sm text-ink-muted">Accountability works best with someone in your corner.</p>
        )}
      </section>

      <section aria-labelledby="i-support" className="flex flex-col gap-3">
        <h2 id="i-support" className="text-lg font-semibold">
          You support
        </h2>
        {iSupport.length === 0 ? (
          <p className="text-sm text-ink-muted">When someone invites you and you accept, they&apos;ll appear here.</p>
        ) : (
          iSupport.map((p) => (
            <div key={p.partnership_id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
              <Link href={`/partners/${p.other_user_id}`} className="flex flex-1 flex-col">
                <span className="font-medium">{p.other_display_name || "Member"}</span>
                <span className="text-sm text-ink-muted">
                  {latestBy.get(p.other_user_id!)
                    ? `Latest check-in ${formatDate(latestBy.get(p.other_user_id!)!.slice(0, 10))}`
                    : "No check-ins shared yet"}
                </span>
              </Link>
              <form action={endPartnership}>
                <input type="hidden" name="id" value={p.partnership_id} />
                <Button type="submit" variant="quiet" className="px-3 text-sm text-ink-muted">
                  Stop
                </Button>
              </form>
            </div>
          ))
        )}
      </section>

      <Card title="What partners can see">
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink-muted">
          <li>Only check-ins you publish, frozen as you published them</li>
          <li>Commitments you tick, and goals you mark as shared</li>
          <li>Amounts only for goals where you turn on “Show amounts”</li>
          <li>Never: your logs, notes, evidence photos, vision or private goals</li>
        </ul>
        <p className="mt-2 text-sm text-ink-muted">Signed in as {member.displayName || "you"}.</p>
      </Card>
    </>
  );
}
