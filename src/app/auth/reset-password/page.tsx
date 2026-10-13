"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { updatePassword, type ResetState } from "./actions";

export default function ResetPasswordPage() {
  const [state, action, pending] = useActionState<ResetState, FormData>(updatePassword, {});
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
        <p className="mt-2 text-ink-muted">At least {MIN_PASSWORD_LENGTH} characters.</p>
      </div>
      <form action={action} className="flex flex-col gap-4">
        <Field id="new-password" label="New password">
          <Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required />
        </Field>
        <Field id="confirm-password" label="Type it again" error={state.error}>
          <Input id="confirm-password" name="confirm" type="password" autoComplete="new-password" required aria-invalid={Boolean(state.error)} />
        </Field>
        <Button type="submit" block disabled={pending}>
          {pending ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </main>
  );
}
