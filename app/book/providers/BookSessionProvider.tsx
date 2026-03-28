"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Locked interface for BookSession.
 *
 * This context provides ONLY authentication identity and token access.
 * It does NOT hold domain data (progress, settings, badges, etc.) — those
 * live in TanStack Query hooks.
 *
 * Review gate: Any PR adding a field here must justify why it can't be a
 * TanStack Query hook. Ask: "Does every component in the book layout need
 * this value on every render?" If no, use a query hook instead.
 */
export interface BookSession {
  /** Cognito user sub */
  userId: string;
  /** User email from Cognito token */
  email: string;
  /** Resolved display name */
  displayName: string;
  /** Whether user is in the admin Cognito group */
  isAdmin: boolean;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Timestamp when session was hydrated (for staleness detection) */
  hydratedAt: number;
}

const BookSessionContext = createContext<BookSession | null>(null);

export function BookSessionProvider({
  session,
  children,
}: {
  session: BookSession;
  children: ReactNode;
}) {
  return (
    <BookSessionContext.Provider value={session}>
      {children}
    </BookSessionContext.Provider>
  );
}

export function useBookSession(): BookSession {
  const ctx = useContext(BookSessionContext);
  if (!ctx) {
    throw new Error(
      "useBookSession must be used within a BookSessionProvider"
    );
  }
  return ctx;
}

/**
 * Returns the session if available, or null if not within a provider.
 * Useful for components that can render both authenticated and unauthenticated.
 */
export function useOptionalBookSession(): BookSession | null {
  return useContext(BookSessionContext);
}
