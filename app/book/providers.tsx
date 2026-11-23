"use client";

import { type ReactNode } from "react";

/**
 * Client-side providers for the /book section. The opt-in analytics beacon now
 * mounts once in the root layout (app/_lib/signed-in-shell-effects.tsx) so it
 * also covers Home and Rewards; the former React Query / persist-client stack
 * was removed (it had zero `useQuery`/`useMutation` consumers).
 */
export function BookProviders({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
