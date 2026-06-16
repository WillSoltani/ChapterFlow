"use client";

import { type ReactNode } from "react";
import { useAnalyticsBeacon } from "@/app/book/hooks/useAnalyticsBeacon";

/** Invisible component that mounts the analytics beacon hook. */
function AnalyticsBeaconMount() {
  useAnalyticsBeacon();
  return null;
}

/**
 * Client-side providers for the /book section. Currently this only mounts the
 * opt-in analytics beacon — the former React Query / persist-client stack was
 * removed (it had zero `useQuery`/`useMutation` consumers).
 */
export function BookProviders({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <AnalyticsBeaconMount />
    </>
  );
}
