"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISSED_KEY = "pakti.install-hint-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Registers the (no-cache) service worker. Rendered once in the root layout. */
export function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installability is a nice-to-have; the app works without it.
      });
    }
  }, []);
  return null;
}

/**
 * A quiet hint to install Pakti on the home screen. Android/Chrome gets a
 * one-tap Install button; iPhone gets the Share → Add to Home Screen steps.
 * Hidden once installed or dismissed.
 */
export function InstallHint() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "prompt" | "ios">("hidden");

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || readDismissed()) return;

    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIos) timer = setTimeout(() => setMode("ios"), 0);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
      setMode("prompt");
    };
    const onInstalled = () => setMode("hidden");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Private mode or blocked storage: just hide for now.
    }
    setMode("hidden");
  }

  if (mode === "hidden") return null;

  return (
    <aside aria-label="Install Pakti" className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon */}
      <img src="/icons/icon-192.png" alt="" width={40} height={40} className="rounded-xl" />
      <div className="flex flex-1 flex-col gap-2">
        <p className="font-medium">Put Pakti on your home screen</p>
        {mode === "prompt" ? (
          <p className="text-sm text-ink-muted">It opens like an app, full screen, one tap away.</p>
        ) : (
          <p className="text-sm text-ink-muted">
            In Safari, tap the Share button <span aria-hidden>(□↑)</span>, then <strong>Add to Home Screen</strong>.
          </p>
        )}
        <div className="flex gap-2">
          {mode === "prompt" && prompt && (
            <button
              type="button"
              onClick={async () => {
                await prompt.prompt();
                await prompt.userChoice;
                setPrompt(null);
                setMode("hidden");
              }}
              className="min-h-11 rounded-xl bg-primary px-4 text-sm font-medium text-primary-ink hover:opacity-90"
            >
              Install Pakti
            </button>
          )}
          <button type="button" onClick={dismiss} className="min-h-11 rounded-xl px-3 text-sm text-ink-muted hover:bg-surface-muted">
            Not now
          </button>
        </div>
      </div>
    </aside>
  );
}
