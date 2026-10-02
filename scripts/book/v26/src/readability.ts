/** Flesch-Kincaid grade with a heuristic syllable counter: an exact port of the Python scorer, so
 *  grades here match the ones the earlier pipeline recorded. */

export function syllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  w = w.replace(/^y/, "");
  const n = (w.match(/[aeiouy]{1,2}/g) ?? []).length;
  return Math.max(1, n);
}

// Split after . ! ? (plus any closing quote/bracket) when the next sentence opens with a capital or digit.
const SENTENCE_BREAK = /(?<=[.!?])["'”’)]*\s+(?=["'“‘(]?[A-Z0-9])/;

export function sentences(text: string): string[] {
  const t = (text ?? "").replace(/\s+/g, " ").trim();
  return t.split(SENTENCE_BREAK).filter((p) => /[A-Za-z]/.test(p));
}

function wordsOf(text: string): string[] {
  return (text ?? "").match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
}

const round1 = (x: number): number => Math.round(x * 10) / 10 + 0; // "+ 0" turns -0 into 0

export function fkGrade(text: string): number | null {
  const sents = sentences(text);
  const words = wordsOf(text);
  if (sents.length === 0 || words.length === 0) return null;
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  return round1((0.39 * words.length) / sents.length + (11.8 * syl) / words.length - 15.59);
}

export function textStats(t: string): { fk: number | null; words: number; sentences: number; avgSentence: number } {
  const words = wordsOf(t).length;
  const sents = sentences(t).length;
  return { fk: fkGrade(t), words, sentences: sents, avgSentence: sents ? round1(words / sents) : 0 };
}
