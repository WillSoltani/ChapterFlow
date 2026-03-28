"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { type ReactNode, useState }from "react";
import type { PersistedClient } from "@tanstack/query-persist-client-core";

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
        // Keep unused data in cache for 5 minutes
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
      },
      mutations: {
        networkMode: "offlineFirst",
      },
    },
  });
}

const persister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "chapterflow-query-cache",
  throttleTime: 1000,
  serialize: (data: PersistedClient) => {
    // Only persist queries matching our prefix filter
    const filtered: PersistedClient = {
      ...data,
      clientState: {
        ...data.clientState,
        queries: data.clientState.queries.filter((q) =>
          shouldPersistQuery(q.queryKey as readonly unknown[])
        ),
      },
    };
    return JSON.stringify(filtered);
  },
});

export function BookQueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        buster: "", // cache buster string, update to invalidate all persisted data
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

export { QueryClientProvider };
