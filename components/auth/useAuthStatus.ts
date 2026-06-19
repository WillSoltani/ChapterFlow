"use client";

import { useEffect, useState } from "react";

export type AuthUser = {
  displayName: string;
  email: string | null;
};

const RETRY_DELAY_MS = 400;
const MAX_ATTEMPTS = 3;
const delay = (attempt: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, attempt * RETRY_DELAY_MS));

export function useAuthStatus(options?: { withPlan?: boolean }) {
  // The plan lookup is opt-in so the shared session hook stays cheap for
  // consumers that only need login state (e.g. Navbar, which mounts on every
  // marketing page). Only callers that render plan-gated UI (Pricing) pass
  // `withPlan` and pay for the extra authenticated entitlements request.
  const withPlan = options?.withPlan ?? false;
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isPro, setIsPro] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    // The session endpoint returns 503 + {loggedIn:null} when the JWKS verifier
    // is transiently unreachable. Never flip a genuinely-logged-in user to
    // logged-out in that case: retry a few times on a transient (5xx/network)
    // failure, and only set a definitive loggedIn=false from a real answer (a
    // 200 with loggedIn:false, or a 4xx). On persistent transience leave
    // loggedIn at null (the loading state) rather than claiming logged-out.
    async function run() {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS && !cancelled; attempt++) {
        let res: Response;
        try {
          res = await fetch("/app/api/auth/session", { cache: "no-store" });
        } catch {
          if (attempt < MAX_ATTEMPTS) {
            await delay(attempt);
            continue;
          }
          return; // transient network failure — stay in loading, do not logout
        }

        if (res.status >= 500) {
          if (attempt < MAX_ATTEMPTS) {
            await delay(attempt);
            continue;
          }
          return; // persistent transient failure — stay in loading
        }

        if (!res.ok) {
          if (!cancelled) setLoggedIn(false); // definitive 4xx — not logged in
          return;
        }

        const data = (await res.json().catch(() => ({}))) as {
          loggedIn?: unknown;
          user?: { displayName?: string; email?: string | null };
        };
        const v = data.loggedIn === true;
        if (!cancelled) {
          setLoggedIn(v);
          if (v && data.user) {
            setUser({
              displayName: data.user.displayName || "Reader",
              email: data.user.email ?? null,
            });
          }
          if (v && withPlan) {
            // The session endpoint doesn't carry the plan, so fetch it from the
            // authenticated entitlements endpoint as a best-effort signal. A
            // 401 / !ok / network failure leaves isPro=false (the safe default),
            // so any consumer's plan-gated UI degrades to its logged-in-but-
            // unknown-plan behaviour. Guarded by `cancelled` like the rest.
            fetch("/app/api/book/me/entitlements", { cache: "no-store" })
              .then((r) => (r.ok ? r.json() : null))
              .then((d) => {
                if (!cancelled && d?.entitlement?.plan === "PRO") setIsPro(true);
              })
              .catch(() => {
                /* not-Pro / not-reachable — leave isPro=false */
              });
          }
        }
        return;
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [withPlan]);

  return { loggedIn, loading: loggedIn === null, user, isPro };
}
