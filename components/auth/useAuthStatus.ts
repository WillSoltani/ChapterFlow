"use client";

import { useEffect, useState } from "react";

export function useAuthStatus() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const res = await fetch("/app/api/auth/session", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { loggedIn?: unknown };
        const v = data.loggedIn === true;
        if (!cancelled) setLoggedIn(v);
      } catch {
        if (!cancelled) setLoggedIn(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return { loggedIn, loading: loggedIn === null };
}
