"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { createInvite, type InviteState } from "./actions";

export function InviteForm({ suggestedLabel }: { suggestedLabel?: string }) {
  const [state, action, pending] = useActionState<InviteState, FormData>(createInvite, {});
  const [open, setOpen] = useState(Boolean(suggestedLabel));
  const [copied, setCopied] = useState(false);

  if (state.link) {
    const url = `${window.location.origin}${state.link}`;
    const message = `I'm using Pakti to grow toward my goals this year. Would you be my accountability partner? ${url}`;
    return (
      <div role="status" className="flex flex-col gap-3 rounded-2xl border-2 border-primary/40 bg-primary-soft p-4">
        <p className="font-medium">Invite link ready{state.label ? ` for ${state.label}` : ""}</p>
        <p className="text-sm text-ink-muted">Send it yourself — it works once and expires in 14 days. Pakti won&apos;t show it again.</p>
        <p className="break-all rounded-xl bg-surface px-3 py-2 font-mono text-xs">{url}</p>
        <div className="grid grid-cols-2 gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-ink hover:opacity-90"
          >
            Send on WhatsApp
          </a>
          <Button
            variant="secondary"
            className="text-sm"
            onClick={async () => {
              if (navigator.share) {
                await navigator.share({ title: "Pakti invite", text: message }).catch(() => {});
              } else {
                await navigator.clipboard.writeText(url);
                setCopied(true);
              }
            }}
          >
            {copied ? "Copied!" : "Share or copy"}
          </Button>
        </div>
      </div>
    );
  }

  if (!open) {
    return (
      <Button block variant="secondary" onClick={() => setOpen(true)}>
        Invite a partner
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
      <Field id="inv-label" label="Who is it for?" hint="Just so you remember — e.g. Grace.">
        <Input id="inv-label" name="label" maxLength={80} defaultValue={suggestedLabel} />
      </Field>
      <Field id="inv-email" label="Their email (optional)" hint="If you add it, only that email can accept.">
        <Input id="inv-email" name="email" type="email" inputMode="email" autoComplete="off" />
      </Field>
      {state.error && (
        <p role="alert" className="text-sm text-below">
          {state.error}
        </p>
      )}
      <Button type="submit" block disabled={pending}>
        {pending ? "Creating…" : "Create invite link"}
      </Button>
    </form>
  );
}
