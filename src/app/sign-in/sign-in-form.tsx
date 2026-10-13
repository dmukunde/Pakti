"use client";

import { use, useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { sendMagicLink, type SignInState } from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function SignInForm({ searchParams }: { searchParams: SearchParams }) {
  const params = use(searchParams);
  const next = typeof params.next === "string" ? params.next : "";
  const linkFailed = params.error === "link";

  const [state, action, pending] = useActionState<SignInState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div role="status" className="rounded-2xl border border-line bg-surface p-5">
        <p className="font-medium">Check your email</p>
        <p className="mt-1 text-ink-muted">
          We sent a sign-in link to {state.email}. It works once and expires in an hour.
        </p>
      </div>
    );
  }

  const error =
    state.status === "error"
      ? state.message
      : linkFailed
        ? "That link has expired or was already used. Send yourself a new one."
        : undefined;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field id="email" label="Email" error={error}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "email-error" : undefined}
        />
      </Field>
      <Button type="submit" block disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
