"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { type ReactNode, useState } from "react";
import type { PersistedClient } from "@tanstack/query-persist-client-core";
import { useAnalyticsBeacon } from "@/app/book/hooks/useAnalyticsBeacon";

/**
 * Query keys that should be persisted to localStorage for offline support.
 * Only Tier 1 (static content) and Tier 2 (user state) — NOT ephemeral quiz sessions.
 */
const PERSISTED_KEY_PREFIXES = ["book", "user"];

function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const prefix = queryKey[0];
  if (typeof prefix !== "string") return false;
  // Exclude ephemeral quiz sessions from persistence
  if (queryKey[1] === "quiz") return false;
  return PERSISTED_KEY_PREFIXES.includes(prefix);
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: "offlineFirst",
        retry: 2,
        retryDelay: (attemptIndex) =>
          Math.min(1000 * 2 ** attemptIndex, 10000),
        // Default staleTime for most queries (Tier 2)
        staleTime: 30 * 1000,
        // Keep unused data in cache for 2 minutes (down from 5)
        gcTime: 2 * 60 * 1000,
        refetchOnWindowFocus: true,
      },
      mutations: {
        networkMode: "offlineFirst",
      },
    },
  });
}

const MAX_PERSISTED_BYTES = 512 * 1024; // 512KB

const persister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "chapterflow-query-cache",
  throttleTime: 1000,
  serialize: (data: PersistedClient) => {
    const filteredQueries = data.clientState.queries.filter((q) =>
      shouldPersistQuery(q.queryKey as readonly unknown[]),
    );

    filteredQueries.sort(
      (a, b) =>
        (b.state.dataUpdatedAt ?? 0) - (a.state.dataUpdatedAt ?? 0),
    );

    let trimmed = filteredQueries;
    let serialized = JSON.stringify({
      ...data,
      clientState: { ...data.clientState, queries: trimmed },
    });

    while (serialized.length > MAX_PERSISTED_BYTES && trimmed.length > 0) {
      trimmed = trimmed.slice(0, -1);
      serialized = JSON.stringify({
        ...data,
        clientState: { ...data.clientState, queries: trimmed },
      });
    }

    return serialized;
  },
});

/** Invisible component that mounts the analytics beacon hook. */
function AnalyticsBeaconMount() {
  useAnalyticsBeacon();
  return null;
}

export function BookQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 4 * 60 * 60 * 1000, // 4 hours (down from 24h)
        buster: "v2", // cache buster — bump to invalidate all persisted data
      }}
    >
      {children}
      <AnalyticsBeaconMount />
    </PersistQueryClientProvider>
  );
}

export { QueryClientProvider };
