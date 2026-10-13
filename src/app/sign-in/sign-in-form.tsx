"use client";

import { use, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import {
  sendMagicLink,
  sendPasswordReset,
  signInWithPassword,
  signUpWithPassword,
  type SignInState,
} from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Mode = "signin" | "signup" | "link";

const IDLE: SignInState = { status: "idle" };

export function SignInForm({ searchParams }: { searchParams: SearchParams }) {
  const params = use(searchParams);
  const next = typeof params.next === "string" ? params.next : "";
  const linkFailed = params.error === "link";

  const [mode, setMode] = useState<Mode>(params.mode === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [signInState, signIn, signingIn] = useActionState(signInWithPassword, IDLE);
  const [signUpState, signUp, signingUp] = useActionState(signUpWithPassword, IDLE);
  const [resetState, reset, resetting] = useActionState(sendPasswordReset, IDLE);
  const [linkState, sendLink, sendingLink] = useActionState(sendMagicLink, IDLE);

  const state = mode === "signup" ? signUpState : mode === "link" ? linkState : resetState.status !== "idle" ? resetState : signInState;
  const pending = signingIn || signingUp || resetting || sendingLink;

  if (state.status === "sent" || state.status === "reset-sent") {
    return (
      <div role="status" className="rounded-2xl border border-line bg-surface p-5">
        <p className="font-medium">Check your email</p>
        <p className="mt-1 text-ink-muted">
          {state.status === "reset-sent"
            ? `If there's an account for ${state.email}, we've sent a link to set a new password.`
            : `We sent a link to ${state.email}. It works once and expires in an hour.`}
        </p>
        <p className="mt-3 text-sm text-ink-muted">
          Using Pakti from your home screen? The email link opens in your browser, so after setting your password, come
          back here and sign in with it.
        </p>
        {/* A plain link (full reload) resets this message and the form. */}
        <a href="/sign-in" className="mt-3 inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </a>
      </div>
    );
  }

  const error =
    state.status === "error"
      ? state.message
      : linkFailed
        ? "That link has expired or was already used. Sign in with your password, or ask for a new link."
        : undefined;

  const action = mode === "signup" ? signUp : mode === "link" ? sendLink : signIn;

  return (
    <div className="flex flex-col gap-5">
      {mode !== "link" && (
        <div role="tablist" aria-label="Sign in or create an account" className="grid grid-cols-2 rounded-xl bg-surface-muted p-1">
          {(
            [
              ["signin", "Sign in"],
              ["signup", "Create account"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              onClick={() => setMode(key)}
              className={cn(
                "min-h-11 rounded-lg text-sm font-medium",
                mode === key ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />
        <Field id="email" label="Email" error={error && mode === "link" ? error : undefined}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        {mode !== "link" && (
          <Field
            id="password"
            label="Password"
            hint={mode === "signup" ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
            error={error}
          >
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
                required
                aria-invalid={Boolean(error)}
                className="pr-20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute inset-y-0 right-1 my-1 min-w-16 rounded-lg px-2 text-sm text-ink-muted hover:bg-surface-muted"
                aria-pressed={showPassword}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </Field>
        )}

        <Button type="submit" block disabled={pending}>
          {pending
            ? "One moment…"
            : mode === "signup"
              ? "Create my account"
              : mode === "link"
                ? "Email me a sign-in link"
                : "Sign in"}
        </Button>
      </form>

      <div className="flex flex-col items-center gap-1 text-sm">
        {mode === "signin" && (
          <form action={reset}>
            <input type="hidden" name="email" value={email} />
            <button type="submit" disabled={pending} className="min-h-11 text-primary underline-offset-4 hover:underline">
              Forgot password?
            </button>
          </form>
        )}
        {mode === "link" ? (
          <button type="button" onClick={() => setMode("signin")} className="min-h-11 text-primary underline-offset-4 hover:underline">
            Use a password instead
          </button>
        ) : (
          <button type="button" onClick={() => setMode("link")} className="min-h-11 text-ink-muted underline-offset-4 hover:underline">
            Email me a sign-in link instead
          </button>
        )}
      </div>
    </div>
  );
}
