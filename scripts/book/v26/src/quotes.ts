/** Quote normalising and matching: a direct port of the Python norm()/matcher used to check that
 *  quoted spans in a chapter really appear in the source text. Keep the two in lockstep. */

export function norm(t: string): string {
  let s = t.replace(/\[\d+\]/g, "").replace(/_/g, "");
  s = s.replace(/’/g, "'").replace(/‘/g, "'").replace(/“/g, '"').replace(/”/g, '"');
  s = s.replace(/—/g, " ").replace(/–/g, " ").replace(/--/g, " ");
  s = s.toLowerCase().replace(/[^a-z0-9' ]/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

/** Inner text of every "straight" and “curly” quoted span of 8+ characters on a single line. */
export function findQuotes(t: string): string[] {
  const out: string[] = [];
  for (const re of [/"([^"\n]{8,}?)"/g, /“([^”\n]{8,}?)”/g]) {
    for (const m of t.matchAll(re)) out.push(m[1]);
  }
  return out;
}

/** True when every ellipsis-separated part of the quote appears in the already-normalised source. */
export function quoteInSource(q: string, normalizedSource: string): boolean {
  return q
    .split(/\.\.\.|…|\. \. \./)
    .map(norm)
    .filter((part) => part !== "")
    .every((part) => normalizedSource.includes(part));
}
