// Pure helper (no server-only / no I/O) so it can be unit-tested. The server
// entrypoint resolveCognitoDomain (cognito-domain.ts) calls this.

export function ensureHttpsUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Missing env var: COGNITO_DOMAIN");
  // Strip any leading scheme and force https. (Reassigning URL.protocol does NOT
  // work for a non-special input scheme like `foo://` — the WHATWG URL setter
  // silently ignores special<->non-special transitions — so rebuild from https.)
  const withoutScheme = trimmed.replace(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//, "");
  const parsed = new URL(`https://${withoutScheme}`);
  return parsed.toString().replace(/\/+$/, "");
}
