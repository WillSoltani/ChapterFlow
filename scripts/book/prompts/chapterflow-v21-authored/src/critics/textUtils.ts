/**
 * Shared text helpers for the critics.
 *
 * `splitSentences` was copy-pasted as a local function in plainLanguage.ts and prose.ts,
 * and as a bare inline `.split(/(?<=[.!?])\s+/)` in scaffoldLeak.ts. One source of truth
 * here so a future tweak to sentence boundaries (abbreviations, ellipses) lands once.
 */

/** Split prose into trimmed, non-empty sentences on terminal punctuation + whitespace. */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}
