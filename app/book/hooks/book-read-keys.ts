/**
 * Shared cache keys for server reads that have MORE THAN ONE consumer (WS3-022).
 * Two hooks reading the same endpoint MUST import the same constant so the
 * shared cache (lib/client/book-api-cache.ts) dedupes them to one request per
 * navigation, and so a mutation's invalidateBookCache(<KEY>) reaches every
 * reader. Single-consumer keys stay inline in their hook.
 *
 * The constants are defined once in lib/client/book-read-keys so components/lib
 * consumers can import them without crossing the app/book import boundary; this
 * route-tree module re-exports them so app/book/hooks/* callers keep importing
 * from a sibling (and the mandated unit test resolves ./book-read-keys).
 */
export { SETTINGS_KEY, ENTITLEMENTS_KEY, COMMITMENTS_KEY } from "@/lib/client/book-read-keys";
