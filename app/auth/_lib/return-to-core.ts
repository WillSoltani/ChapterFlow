/**
 * Pure, dependency-free returnTo safety predicates.
 *
 * Kept free of "server-only" and env access so the open-redirect guard can be
 * unit-tested (see return-to-core.test.ts). The env/allowlist-aware wrapper
 * lives in return-to.ts.
 */

// ASCII control characters (incl. TAB, LF, CR) and DEL.
// The WHATWG URL parser strips TAB/LF/CR *before* parsing, so a value like
// "/\t/evil.com" would collapse to "//evil.com" and resolve cross-origin.
// We reject any control char outright — legitimate internal paths never carry
// them — which closes that bypass class entirely. Built from a string so no
// literal control byte ever lives in this source file.
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001F\\u007F]");

/**
 * True iff `raw` is a safe *same-origin* path we can hand to
 * `new URL(raw, origin)` without it escaping to another host.
 *
 * Rejects:
 *  - empty / non-string
 *  - values not starting with "/"
 *  - protocol-relative "//host" and the backslash variant "/\\host"
 *    (browsers treat "\\" as "/" for special schemes, so "/\\evil.com"
 *    resolves to https://evil.com)
 *  - anything containing ASCII control characters (tab/newline smuggling)
 */
export function isSafeInternalPath(raw: string): boolean {
  if (!raw) return false;
  if (CONTROL_CHARS.test(raw)) return false;
  if (!raw.startsWith("/")) return false;
  // Second character must not be "/" or "\" — both open a host segment.
  if (/^\/[/\\]/.test(raw)) return false;
  return true;
}
