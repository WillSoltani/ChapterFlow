/**
 * Shared cache keys for server reads that have MORE THAN ONE consumer (WS3-022).
 * Two hooks reading the same endpoint MUST import the same constant so the
 * shared cache (lib/client/book-api-cache.ts) dedupes them to one request per
 * navigation, and so a mutation's invalidateBookCache(<KEY>) reaches every
 * reader. Single-consumer keys stay inline in their hook.
 *
 * Source of truth lives here under lib/client so `components/**` and `lib/**`
 * consumers (e.g. useAuthStatus, WorkspacePage) can import it without crossing
 * the components/lib -> app/book route-tree import boundary
 * (tests/frontend-import-boundaries.test.ts). The app/book/hooks/book-read-keys
 * module re-exports these for route-tree callers.
 */
export const SETTINGS_KEY = "/app/api/book/me/settings"; // useBookPreferences + useStarterPrescription
export const ENTITLEMENTS_KEY = "/app/api/book/me/entitlements"; // useBookEntitlements + useAuthStatus
export const COMMITMENTS_KEY = "/app/api/book/me/commitments"; // useCommitments + WorkspacePage
