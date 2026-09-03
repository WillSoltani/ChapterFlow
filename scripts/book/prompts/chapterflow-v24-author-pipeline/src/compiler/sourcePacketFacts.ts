import type { SourcePacketFact, SourcePacketV1 } from "../artifacts/artifactTypes.js";
import type { SourceClaimType } from "../types.js";

/**
 * The v23 blueprint always reserves exactly this many quiz slots
 * (chapterBlueprint.ts quizCount, currently 9). If quizCount ever changes,
 * this constant must change with it — both the source prewrite gate
 * (src/qc/sourceV2Gate.ts) and the packet gate (src/compiler/sourcePacketGate.ts,
 * SP13 via sourcePacket.ts sourceQuality.status) read this single constant so
 * they can never drift out of sync with each other or with the blueprint.
 */
export const REQUIRED_QUIZ_FACT_FLOOR = 9;

// Placeholder strings normalizedFact() stamps when a sidecar fact omits a pedagogy field.
// Exported so rankTeachingFacts() can tell a *real* mechanism/misconception from the
// boilerplate fallback (a fallback mechanism must not earn the "+2 has mechanism" weight).
export const MECHANISM_FALLBACK = "This fact supplies the source-grounded reason the chapter can teach the move.";
export const COMMON_ERROR_FALLBACK = "The reader treats the claim as a vague slogan instead of applying the mechanism.";
export const WHY_WRONG_FALLBACK = "The mechanism, not the slogan, is what makes the lesson transfer.";

const CLAIM_TYPES: SourceClaimType[] = ["core_move", "breakdown_claim", "example", "quiz_prompt", "quiz_key_evidence", "quiz_explanation", "review_card", "implementation_guidance", "takeaway"];

const NUMBER_WORDS: Record<string, string> = {
  zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19", twenty: "20",
  thirty: "30", forty: "40", fifty: "50", sixty: "60", seventy: "70", eighty: "80", ninety: "90", hundred: "100", thousand: "1000", million: "1000000",
};

export function uniq(values: Iterable<string>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const v = raw.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

export function extractGroundedNumbers(text: string): string[] {
  const numbers = new Set<string>();
  for (const m of text.matchAll(/\b\d+(?:[.,]\d+)?\b/g)) numbers.add(m[0].replace(/,/g, ""));
  for (const m of text.toLowerCase().matchAll(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million)\b/g)) {
    numbers.add(NUMBER_WORDS[m[1]] ?? m[1]);
  }
  return [...numbers].sort((a, b) => Number(a) - Number(b));
}

/**
 * R-116 — SENTENCE-INITIAL FILTER.
 *
 * The scan below matches any capitalized run, so the first word of every sentence
 * ("Readers", "Repetition", "Environments") was harvested as a proper noun and shipped
 * into the writer's allowedEntities list and into each fact's groundedEntities. On the
 * live Franklin ch03 packet that made the entity allow-list mostly ordinary vocabulary,
 * which is worse than useless: it tells the writer that common words are source-protected
 * names and it dilutes the list the accuracy gates read.
 *
 * A capitalized run that starts a sentence (start-of-string, or after `.`/`!`/`?` +
 * whitespace) has its FIRST word removed, because that word is capitalized by grammar, not
 * by being a name. What remains is kept when it is still a capitalized run of >= 3 chars —
 * so "Then Franklin" yields "Franklin" and "Readers treat" yields nothing. A run that is
 * only its opener is dropped unless the same token ALSO occurs mid-sentence somewhere in
 * the same text, which is how a genuine proper noun that happens to open a sentence
 * ("Franklin ruled the page. Franklin marked it.") survives.
 *
 * The filter is per-CALL over the text it was given, so a token whose only occurrence in
 * this text is sentence-initial is dropped even if it appears mid-sentence elsewhere in
 * the packet — that is the honest bound of a pure string function, and callers pass the
 * whole field text they care about.
 */
export function properNounTokens(text: string): string[] {
  const stop = new Set(["The", "A", "An", "If", "When", "Because", "This", "That", "Chapter", "Book"]);
  type Hit = { token: string; sentenceInitial: boolean };
  const hits: Hit[] = [];
  for (const m of text.matchAll(/\b[A-Z][A-Za-z0-9&.'-]*(?:\s+[A-Z][A-Za-z0-9&.'-]*){0,4}\b/g)) {
    const token = m[0].trim();
    if (token.length < 3 || stop.has(token)) continue;
    const before = text.slice(0, m.index ?? 0);
    // Sentence-initial = nothing but whitespace before it, or terminal punctuation +
    // whitespace. A quote/bracket between the punctuation and the word still counts.
    const sentenceInitial = /(?:^|[.!?])\s*["'\u201C\u2018(\[]?\s*$/.test(before);
    hits.push({ token, sentenceInitial });
  }
  const midSentence = new Set(hits.filter((h) => !h.sentenceInitial).map((h) => h.token));
  const kept: string[] = [];
  for (const hit of hits) {
    if (!hit.sentenceInitial || midSentence.has(hit.token)) { kept.push(hit.token); continue; }
    const tail = hit.token.split(/\s+/).slice(1).join(" ").trim();
    if (tail.length >= 3 && /^[A-Z]/.test(tail)) kept.push(tail);
  }
  return uniq(kept).slice(0, 80);
}

export function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizedFact(raw: any, fallbackId: string): SourcePacketFact | null {
  const id = asText(raw?.id) || fallbackId;
  const claim = asText(raw?.claim);
  if (!claim) return null;
  const mechanism = asText(raw?.becauseMechanism) || asText(raw?.mechanism) || MECHANISM_FALLBACK;
  const commonError = asText(raw?.commonError) || COMMON_ERROR_FALLBACK;
  const whyWrong = asText(raw?.errorIsWhy) || asText(raw?.whyWrong) || WHY_WRONG_FALLBACK;
  const text = [claim, mechanism, commonError, whyWrong].join(" ");
  return {
    id,
    claim,
    mechanism,
    commonError,
    whyWrong,
    allowedClaimTypes: CLAIM_TYPES,
    groundedNumbers: extractGroundedNumbers(text),
    groundedEntities: properNounTokens(text),
    groundedPlaces: [],
    verificationRefs: [id],
    replicationStatus: raw?.replicationStatus,
  };
}

/**
 * Pedagogy fields of a compiled fact that are MISSING or are the compiler's own
 * boilerplate, in packet-field order.
 *
 * R-028: the packet gate's SP7 asked `!f.mechanism || !f.commonError ||
 * !f.whyWrong`, but normalizedFact() above substitutes MECHANISM_FALLBACK /
 * COMMON_ERROR_FALLBACK / WHY_WRONG_FALLBACK for an empty sidecar field FIRST,
 * so that predicate was permanently false and SP7 could never fire. The
 * substituted text is a sentence about the pipeline's own contract ("This fact
 * supplies the source-grounded reason the chapter can teach the move.") and it
 * shipped to writers as the fact's causal explanation. Treating a fallback as
 * absent is what makes SP7 check the property it was written for. The same
 * placeholder-vs-real distinction already backs rankTeachingFacts' weights
 * (hasRealMechanism below); this exports it for the gate.
 */
export function factPedagogyPlaceholders(fact: Pick<SourcePacketFact, "mechanism" | "commonError" | "whyWrong">): string[] {
  const missing: string[] = [];
  const mechanism = (fact.mechanism ?? "").trim();
  const commonError = (fact.commonError ?? "").trim();
  const whyWrong = (fact.whyWrong ?? "").trim();
  if (mechanism.length === 0 || mechanism === MECHANISM_FALLBACK) missing.push("mechanism");
  if (commonError.length === 0 || commonError === COMMON_ERROR_FALLBACK) missing.push("commonError");
  if (whyWrong.length === 0 || whyWrong === WHY_WRONG_FALLBACK) missing.push("whyWrong");
  return missing;
}

/**
 * Derives the same authoring-ready facts the source packet compiler produces,
 * so any caller that needs to know "how many usable facts will this sidecar
 * compile to" (e.g. the source prewrite gate) counts identically to
 * compileSourcePacketFromSidecar. Malformed testableFacts entries (no claim)
 * are dropped here exactly as they are at compile time — do not count
 * `testableFacts.length` as a substitute.
 */
export function compiledFactsFromSidecar(sidecar: any, chapterNumber: number): SourcePacketFact[] {
  return (Array.isArray(sidecar?.testableFacts) ? sidecar.testableFacts : [])
    .map((f: any, i: number) => normalizedFact(f, `ch${String(chapterNumber).padStart(2, "0")}.fact.${i + 1}`))
    .filter((f: SourcePacketFact | null): f is SourcePacketFact => !!f);
}

// ── Fact/case helpers (moved here from chapterBlueprint.ts in P13) ────────────────
// These are pure functions OVER a source packet's facts/cases with no dependency on the
// blueprint layer, so they belong in the low-level facts module. chapterBlueprint.ts now
// imports them (and re-exports isSourceGroundingMetaFact for back-compat). Moving them also
// lets rankTeachingFacts() reuse the SAME keyword-linkage logic the blueprint's example
// dealer uses (rankedCaseIdsForFact), instead of duplicating it.

/** Rotate an array left by `offset` (wrapping). Used by the case dealer. */
export function rotate<T>(xs: T[], offset: number): T[] {
  if (xs.length === 0) return [];
  const n = ((offset % xs.length) + xs.length) % xs.length;
  return xs.slice(n).concat(xs.slice(0, n));
}

const KEYWORD_STOP = new Set([
  "about", "after", "again", "against", "because", "before", "being", "between", "chapter", "claim", "could", "every",
  "evidence", "example", "from", "into", "more", "should", "source", "than", "that", "their", "there", "these", "this",
  "through", "when", "where", "which", "while", "with", "without", "would",
]);

/** Stemmed content-word roots of a string, for keyword overlap between a fact and a case. */
export function keywordRoots(value: string): Set<string> {
  const words = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word
      .replace(/ies$/, "y")
      .replace(/(?:ing|ed|es|s)$/, ""));
  return new Set(words.filter((word) => word.length >= 4 && !KEYWORD_STOP.has(word)));
}

function factKeywordTerms(fact: SourcePacketFact): Set<string> {
  return keywordRoots([
    fact.claim,
    fact.mechanism,
    fact.commonError,
    fact.whyWrong,
    ...fact.groundedEntities,
    ...fact.groundedNumbers,
  ].join(" "));
}

function caseTermOverlap(factTerms: Set<string>, c: SourcePacketV1["namedCases"][number]): number {
  const caseTerms = keywordRoots([c.label, c.summary, ...c.hardSpecifics].join(" "));
  let score = 0;
  for (const term of caseTerms) if (factTerms.has(term)) score++;
  return score;
}

/** A keyword-overlap score at/above which a fact is considered genuinely LINKED to a case
 *  (rather than needing the positional fallback rotation). Matches the historical threshold
 *  in rankedCaseIdsForFact and is reused by rankTeachingFacts' "+2 cased" weight. */
export const CASE_LINKAGE_MIN_SCORE = 2;

/** Best keyword-linked case for a fact, with its overlap score and hardSpecifics count.
 *  score < CASE_LINKAGE_MIN_SCORE means no genuine link was found. */
export function bestCaseLinkage(packet: SourcePacketV1, factId: string | undefined): { caseId?: string; score: number; hardSpecifics: number } {
  const fact = packet.facts.find((f) => f.id === factId);
  if (!fact || packet.namedCases.length === 0) return { score: 0, hardSpecifics: 0 };
  const factTerms = factKeywordTerms(fact);
  let best: { caseId?: string; score: number; hardSpecifics: number } = { score: -1, hardSpecifics: 0 };
  for (const c of packet.namedCases) {
    const score = caseTermOverlap(factTerms, c);
    if (score > best.score) best = { caseId: c.id, score, hardSpecifics: c.hardSpecifics.length };
  }
  return best.score < 0 ? { score: 0, hardSpecifics: 0 } : best;
}

/**
 * Cases ranked by keyword linkage to a fact, WITH each case's overlap score; falls back to a
 * positional rotation (all scores 0) when no case clears CASE_LINKAGE_MIN_SCORE.
 *
 * The scores are what makes fact-relevant cue dealing possible: a dealer that only sees the
 * ORDER cannot tell "the top case beats the rest by nine points" from "every case ties at
 * zero", so it load-balances the two identically and hands a slot the worst-linked case
 * (R-101, live ch03 ex05). Ties break by case id so the ranking is deterministic — the
 * pre-existing `.sort((a,b) => b.score - a.score)` was not stable across engines for ties.
 */
export function scoredCaseIdsForFact(packet: SourcePacketV1, factId: string | undefined, fallbackIndex: number): Array<{ id: string; score: number }> {
  const cases = packet.namedCases;
  if (!cases.length) return [];
  const fallback = (): Array<{ id: string; score: number }> =>
    rotate(cases.map((c) => c.id).filter(Boolean), fallbackIndex).map((id) => ({ id, score: 0 }));
  const fact = packet.facts.find((f) => f.id === factId);
  if (!fact) return fallback();
  const factTerms = factKeywordTerms(fact);
  const scored = cases
    .map((c) => ({ id: c.id, score: caseTermOverlap(factTerms, c) }))
    .filter((item) => !!item.id)
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (!scored.length || scored[0].score < CASE_LINKAGE_MIN_SCORE) return fallback();
  return scored;
}

/** Cases ranked by keyword linkage to a fact; falls back to a positional rotation when no
 *  case clears CASE_LINKAGE_MIN_SCORE. Thin id-only projection of scoredCaseIdsForFact. */
export function rankedCaseIdsForFact(packet: SourcePacketV1, factId: string | undefined, fallbackIndex: number): string[] {
  return uniq(scoredCaseIdsForFact(packet, factId, fallbackIndex).map((item) => item.id));
}

// Source-grounding META facts: facts *about* the research contract (use named cases, keep
// claims checkable, seed distractors, etc.) that the sidecar sometimes carries as testableFacts.
// They read like real facts to the schema but are process instructions, not something a reader
// should be taught or quizzed on. (Moved from chapterBlueprint.ts; re-exported there for
// back-compat.) rankTeachingFacts penalizes them (-2) and the blueprint drops them from the
// teaching pool.
export function isSourceGroundingMetaFact(fact: SourcePacketFact): boolean {
  const value = `${fact.claim ?? ""} ${fact.mechanism ?? ""}`.toLowerCase();
  return /\bat least\s+\d+\s+named cases\b/.test(value)
    || /\bconcrete settings give memory a handle\b/.test(value)
    || /\bmake the claim checkable\b/.test(value)
    || /\bnamed people, places, dates,? or numbers\b/.test(value)
    || /\bprevent the writer from inventing\b/.test(value)
    || /\bquiz-worthy material\b/.test(value)
    || /\bcase can test a different misreading\b/.test(value)
    || /\bseeds? distractors?\b/.test(value)
    || /\blater qc\b/.test(value)
    || /\bsource anchors?\b/.test(value);
}

// ── Pedagogical fact ranking (P13) ────────────────────────────────────────────────
//
// Replaces positional fact dealing (coreMove = facts[0], slots = round-robin) with a
// deterministic pedagogical rank, so a chapter's core move is its BEST idea and the
// quiz/cards/summaries divide the fact space by role instead of re-teaching facts[0..k]
// ~4x each (the rubric Density/Insight leak). Pure deterministic code — no LLM.
//
// WEIGHTS (documented, tunable in one place):
//   +3 chapter-distinct   — not a bookWideDuplicate (SP14 tag). The single strongest signal:
//                           a fact drawn from THIS chapter's content, not the book thesis.
//   +2 has mechanism      — a REAL becauseMechanism (not the normalizedFact placeholder);
//                           mechanism-bearing facts are what apply/analyze quiz slots need.
//   +2 cased w/ specifics — keyword-linked (>= CASE_LINKAGE_MIN_SCORE) to a named case that
//                           itself carries >= 2 hardSpecifics; the fact can anchor a concrete example.
//   +1 misconception      — a REAL commonError + whyWrong pair (not placeholders); good distractor/
//                           boundary material.
//   +1 grounded numbers   — carries at least one grounded number.
//   -2 meta fact          — a source-grounding process instruction, not teachable content.
// Ties break by fact id ascending, so the ranking is fully deterministic.
export const RANKING_WEIGHTS = {
  chapterDistinct: 3,
  hasMechanism: 2,
  casedWithSpecifics: 2,
  misconception: 1,
  groundedNumbers: 1,
  metaFact: -2,
} as const;

// A fact must reach this score to count as a solid teaching fact for SP15's early
// "research is thin" advisory. It is one point ABOVE the chapter-distinct weight, so a
// fact needs distinctness PLUS at least one other pedagogical signal (mechanism, case,
// misconception, or numbers) — distinctness alone is not enough.
export const WEAK_RANKING_MIN_SCORE = RANKING_WEIGHTS.chapterDistinct + 1;

/** True when the fact carries a real (non-placeholder) mechanism. */
export function hasRealMechanism(fact: SourcePacketFact): boolean {
  const m = (fact.mechanism ?? "").trim();
  return m.length > 0 && m !== MECHANISM_FALLBACK;
}

/** True when the fact carries a real (non-placeholder) commonError + whyWrong pair. */
function hasRealMisconception(fact: SourcePacketFact): boolean {
  const ce = (fact.commonError ?? "").trim();
  const ww = (fact.whyWrong ?? "").trim();
  return ce.length > 0 && ww.length > 0 && ce !== COMMON_ERROR_FALLBACK && ww !== WHY_WRONG_FALLBACK;
}

export type FactRanking = { id: string; score: number; reasons: string[] };

/** Deterministic pedagogical ranking of a packet's facts (best teaching fact first).
 *  See RANKING_WEIGHTS. Requires bookWideDuplicate tags to already be applied for the
 *  distinctness weight to be meaningful (compileSourcePackets runs the book-wide dedup
 *  pass before the final ranking). */
export function rankTeachingFacts(packet: SourcePacketV1): FactRanking[] {
  const W = RANKING_WEIGHTS;
  const ranked: FactRanking[] = packet.facts.map((fact) => {
    let score = 0;
    const reasons: string[] = [];
    if (!fact.bookWideDuplicate) { score += W.chapterDistinct; reasons.push("chapter-distinct"); }
    if (hasRealMechanism(fact)) { score += W.hasMechanism; reasons.push("mechanism"); }
    const link = bestCaseLinkage(packet, fact.id);
    if (link.score >= CASE_LINKAGE_MIN_SCORE && link.hardSpecifics >= 2) { score += W.casedWithSpecifics; reasons.push("cased"); }
    if (hasRealMisconception(fact)) { score += W.misconception; reasons.push("misconception"); }
    if ((fact.groundedNumbers?.length ?? 0) > 0) { score += W.groundedNumbers; reasons.push("numbers"); }
    if (isSourceGroundingMetaFact(fact)) { score += W.metaFact; reasons.push("meta"); }
    return { id: fact.id, score, reasons };
  });
  return ranked.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Persist the ranking onto a packet (mutates): each fact gets a 1-based teachingPriority
 *  and the packet gets coreMoveFactId = the top-ranked fact WITH a real mechanism (falling
 *  back to the top-ranked fact). Idempotent — safe to call again after bookWideDuplicate
 *  tagging changes the distinctness inputs. */
export function applyTeachingRanking(packet: SourcePacketV1): void {
  const ranked = rankTeachingFacts(packet);
  const rankById = new Map(ranked.map((r, i) => [r.id, i + 1]));
  for (const f of packet.facts) f.teachingPriority = rankById.get(f.id);
  const topMechanism = ranked.find((r) => {
    const f = packet.facts.find((x) => x.id === r.id);
    return !!f && hasRealMechanism(f);
  });
  packet.coreMoveFactId = (topMechanism ?? ranked[0])?.id;
}
