// WS4-006: pure Accept-header API version resolution — no `server-only`
// import, no AWS deps — so it stays directly unit-testable under `tsx --test`
// (mirroring http-guards-core.ts). See docs/API-VERSIONING.md for the policy
// this implements; http.ts wires the decision into withBookApiErrors.

/** Only v1 exists today; extend this set the day a v2 ships. */
const SUPPORTED_VERSIONS = new Set([1]);

/** Matches a `application/vnd.chapterflow.v{N}+json` media range anywhere in the Accept header. */
const VENDOR_VERSION_PATTERN = /application\/vnd\.chapterflow\.v(\d+)\+json/;

export type ApiVersionResolution =
  | { supported: true; version: 1 }
  | { supported: false; requested: string };

/**
 * Resolve the requested API version from a raw `Accept` header value.
 *
 * Scans the (possibly comma-separated, multi-range) Accept header for a
 * `application/vnd.chapterflow.v{N}+json` vendor media type. No match —
 * absent header, plain `application/json`, a browser's wildcard/`text/html`
 * Accept list, or any Accept that simply doesn't mention our vendor type —
 * defaults to v1
 * so every existing web/native client is unaffected. A vendor type IS present
 * with N===1 also resolves to v1. A vendor type present with N!==1 is
 * rejected as unsupported; the whole matched media type is echoed back as
 * `requested` for the error envelope's `details`.
 */
export function resolveApiVersion(acceptHeader: string | null): ApiVersionResolution {
  const match = acceptHeader?.match(VENDOR_VERSION_PATTERN);
  if (!match) return { supported: true, version: 1 };

  const requestedVersion = Number(match[1]);
  if (SUPPORTED_VERSIONS.has(requestedVersion)) return { supported: true, version: 1 };

  return { supported: false, requested: match[0] };
}
