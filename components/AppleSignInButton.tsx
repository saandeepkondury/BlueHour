"use client";

import { useEffect, useId, useState, useTransition } from "react";
import { completeAppleSignIn } from "@/app/auth-actions";

declare global {
  interface Window {
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope: string;
          redirectURI: string;
          state?: string;
          usePopup: boolean;
        }) => void;
        signIn: () => Promise<{
          authorization: { id_token: string; code?: string };
          user?: {
            email?: string;
            name?: { firstName?: string; lastName?: string };
          };
        }>;
      };
    };
  }
}

const SCRIPT_SRC =
  "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";

function loadAppleScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.AppleID) return Promise.resolve();

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Apple sign-in script failed.")), {
        once: true,
      });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Apple sign-in script failed."));
    document.head.appendChild(script);
  });
}

/**
 * Sign in with Apple for the browser. Hidden unless NEXT_PUBLIC_APPLE_CLIENT_ID
 * is set (Services ID). Creates or links the account, then sets the session.
 */
export function AppleSignInButton({
  next = "/",
  label = "Continue with Apple",
}: {
  next?: string;
  label?: string;
}) {
  const clientId = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID?.trim() ?? "";
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const state = useId().replace(/:/g, "");

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    loadAppleScript()
      .then(() => {
        if (cancelled || !window.AppleID) return;
        window.AppleID.auth.init({
          clientId,
          scope: "name email",
          redirectURI: `${window.location.origin}/api/auth/apple/callback`,
          state,
          usePopup: true,
        });
        setReady(true);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, state]);

  if (!clientId) return null;

  function onClick() {
    setError(null);
    startTransition(async () => {
      try {
        if (!window.AppleID) {
          setError("Apple sign-in is still loading. Try again in a moment.");
          return;
        }
        const result = await window.AppleID.auth.signIn();
        const identityToken = result.authorization?.id_token ?? "";
        const first = result.user?.name?.firstName?.trim() ?? "";
        const last = result.user?.name?.lastName?.trim() ?? "";
        const name = [first, last].filter(Boolean).join(" ");

        const outcome = await completeAppleSignIn({ identityToken, name, next });
        if ("error" in outcome) {
          setError(outcome.error);
          return;
        }
        window.location.assign(outcome.path);
      } catch (err) {
        const message =
          err && typeof err === "object" && "error" in err
            ? String((err as { error: string }).error)
            : err instanceof Error
              ? err.message
              : "Apple sign-in was cancelled.";
        // Apple popup cancel is noisy; keep it calm.
        if (/popup_closed|user_cancelled|1001/i.test(message)) {
          setError(null);
          return;
        }
        setError(message);
      }
    });
  }

  return (
    <div className="apple-auth">
      <button
        type="button"
        className="btn btn--apple btn--block"
        disabled={!ready || pending}
        onClick={onClick}
      >
        <AppleGlyph />
        {pending ? "Signing in…" : label}
      </button>
      {error ? <p className="notice notice--bad">{error}</p> : null}
    </div>
  );
}

function AppleGlyph() {
  return (
    <svg
      className="btn--apple__glyph"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M16.365 1.43c0 1.14-.433 2.2-1.21 3.02-.84.9-2.23 1.6-3.4 1.5-.15-1.1.43-2.27 1.18-3.05.84-.88 2.3-1.52 3.43-1.47zM20.5 17.2c-.55 1.27-.82 1.84-1.53 2.96-1 1.55-2.4 3.48-4.15 3.5-1.55.02-1.95-1.01-4.06-1-2.1.01-2.55 1.03-4.1 1.01-1.75-.02-3.09-1.76-4.09-3.3C.7 17.1-.6 12.4 1.3 9.2c1.2-2.02 3.1-3.2 4.9-3.2 1.83 0 2.98 1.03 4.49 1.03 1.46 0 2.35-1.04 4.5-1.04 1.6 0 3.3.87 4.5 2.37-3.95 2.16-3.31 7.8.81 8.84z" />
    </svg>
  );
}
