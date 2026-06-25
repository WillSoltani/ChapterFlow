// Pure redaction helper for license-key audit logging.
//
// A license code is a single-use credential (CF-XXXX-XXXX-XXXX). The analytics
// table records a `license_redemption_attempt` event for EVERY attempt — success
// AND failure — and previously persisted the full uppercased code verbatim
// (`code: args.code`). That copied a live/unredeemed credential into a second
// datastore with a different retention/access profile, and on the failure paths
// (invalid_format / not_found) it persisted attacker-supplied strings unmodified.
//
// This module is the single source of truth for turning a raw code into an
// audit-safe, NON-REVERSIBLE fingerprint. It is pure (only `node:crypto`) so it
// can be unit-tested via `tsx --test` — analytics-repo.ts pulls in `server-only`
// (via aws.ts / keys.ts) and cannot be imported by the test runner directly.
import { createHash } from "node:crypto";

/** Number of trailing characters retained verbatim for human-readable triage. */
const SUFFIX_LEN = 4;

export interface RedactedLicenseCode {
  /**
   * Non-reversible SHA-256 (base64url) fingerprint of the raw code. Stable for a
   * given input, so repeated attempts of the same code still correlate (abuse /
   * brute-force detection) without the code itself being recoverable.
   */
  codeFingerprint: string;
  /**
   * Last few characters of the raw code, kept for human triage. For a valid
   * CF-XXXX-XXXX-XXXX key this is the final group's tail only — far too little to
   * reconstruct the 12 entropy characters. `null` when the input is too short to
   * mask safely (i.e. shorter than the suffix would leave anything hidden).
   */
  codeSuffix: string | null;
}

/**
 * Redact a raw license code into an audit-safe fingerprint. Accepts any string
 * (including the empty/`(empty)` sentinel and arbitrary attacker-supplied probe
 * strings on the failure paths) and NEVER returns the raw value.
 */
export function redactLicenseCode(rawCode: string): RedactedLicenseCode {
  const code = typeof rawCode === "string" ? rawCode : "";
  return {
    codeFingerprint: createHash("sha256").update(code).digest("base64url"),
    // Only expose a suffix when at least one character stays hidden, so we never
    // echo back a short probe string in full.
    codeSuffix: code.length > SUFFIX_LEN ? code.slice(-SUFFIX_LEN) : null,
  };
}
