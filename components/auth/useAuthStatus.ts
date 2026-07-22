"use client";

import { useEffect, useState } from "react";
import { fetchBookJsonCached } from "@/lib/client/book-api-cache";
import { BookClientError } from "@/lib/client/book-api";
import { ENTITLEMENTS_KEY } from "@/app/book/hooks/book-read-keys";

export type AuthUser = {
  displayName: string;
  email: string | null;
};

const AUTH_SESSION_KEY = "/app/api/auth/session";

type SessionResponse = {
  loggedIn?: unknown;
  user?: { displayName?: string; email?: string | null };
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
        let data: SessionResponse;
        try {
          data = await fetchBookJsonCached<SessionResponse>(
            AUTH_SESSION_KEY,
            undefined,
            attempt > 1 ? { forceRevalidate: true } : undefined
          );
        } catch (error) {
          if (error instanceof BookClientError && error.status < 500) {
            if (!cancelled) setLoggedIn(false); // definitive 4xx — not logged in
            return;
          }
          // transient 5xx / network failure — retry, and on persistent failure
          // stay in loading rather than claiming logged-out
          if (attempt < MAX_ATTEMPTS) await delay(attempt);
          continue;
        }
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
            // Same ENTITLEMENTS_KEY as useBookEntitlements — one request per
            // navigation even when Pricing and Settings are both mounted.
            fetchBookJsonCached<{ entitlement?: { plan?: string } }>(ENTITLEMENTS_KEY)
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
