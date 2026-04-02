"use client";

import { useEffect, useState } from "react";

export type AuthUser = {
  displayName: string;
  email: string | null;
};

export function useAuthStatus() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch("/app/api/auth/session", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
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
        }
      } catch {
        if (!cancelled) setLoggedIn(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { loggedIn, loading: loggedIn === null, user };
}
