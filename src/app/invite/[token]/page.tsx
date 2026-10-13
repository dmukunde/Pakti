import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { acceptInvite } from "@/app/(app)/partners/actions";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invitation" };

const ERRORS: Record<string, string> = {
  self: "This is your own invite link — send it to the person you'd like as a partner.",
  email: "This invitation was meant for a different email address. Sign in with that one, or ask for a new link.",
  duplicate: "You already support this person.",
  full: "They already have two partners, so this invite can't be used.",
  invalid: "This invitation has expired or was already used. Ask for a new link.",
};

export default function InvitePage({ params, searchParams }: PageProps<"/invite/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-12">
      <Logo size="lg" />
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <Invite params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Invite({
  params,
  searchParams,
}: {
  params: PageProps<"/invite/[token]">["params"];
  searchParams: PageProps<"/invite/[token]">["searchParams"];
}) {
  const { token } = await params;
  const error = (await searchParams).error;
  const supabase = await createClient();
  const [{ data: preview }, { data: auth }] = await Promise.all([
    supabase.rpc("invite_preview", { p_token: token }),
    supabase.auth.getClaims(),
  ]);
  const invite = preview?.[0];
  const signedIn = Boolean(auth?.claims?.sub);
  const next = encodeURIComponent(`/invite/${token}`);

  if (!invite || !invite.valid) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">This invitation can&apos;t be used</h1>
        <p className="mt-2 text-ink-muted">{ERRORS.invalid}</p>
      </div>
    );
  }

  const who = invite.inviter_name || "Someone";
  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">{who} would like you as an accountability partner</h1>
        <p className="mt-3 text-ink-muted">
          You&apos;ll see the weekly check-ins {who} chooses to share, and you can leave an encouraging note. Their goals,
          logs and photos stay private.
        </p>
        {invite.invited_email && <p className="mt-2 text-sm text-ink-muted">Sent to {invite.invited_email}.</p>}
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-surface-muted px-4 py-3 text-sm">
          {ERRORS[String(error)] ?? ERRORS.invalid}
        </p>
      )}

      {signedIn ? (
        <form action={acceptInvite}>
          <input type="hidden" name="token" value={token} />
          <Button type="submit" block>
            Accept and support {who}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <Link
            href={`/sign-in?mode=signup&next=${next}`}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-5 font-medium text-primary-ink hover:opacity-90"
          >
            Create a Pakti account
          </Link>
          <Link href={`/sign-in?next=${next}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-surface font-medium">
            I already have an account
          </Link>
        </div>
      )}
    </>
  );
}
