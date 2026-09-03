/**
 * Source sidecar schema — Phase 3.
 *
 * THREE shapes exist on disk (measured 2026-06-03 across 1581 sidecars):
 *   - rich-v1  (303 ch): { centralConcept, keyClaims, namedExamples[], hardEdge,
 *               paraphraseNotes, ... } — well-grounded (start-with-why, blink).
 *   - thin-v1  (914 ch): { title, properNouns[], repeatedTerms[], sourceReferences }
 *               — weak grounding; the word-salad predictor (atomic-habits et al.).
 *   - unknown  (364 ch): neither — treat as weakest.
 *
 * v2 (`schemaVersion: "source-v2"`) is the upgrade target. It is ADDITIVE over
 * rich-v1 and adds the spine that makes correct authoring easy:
 *   - testableFacts[]  — claim + becauseMechanism (seeds the explanation, kills
 *                        the echo-template defect) + commonError + errorIsWhy
 *                        (seeds non-strawman distractors).
 *   - namedExamples[].hardSpecifics / .id / .realWorld
 *   - frameworks[]     — named N-part models, so AC11 completeness is automatic.
 *
 * The HARD RULE (red-team): nothing enforces v2 on a v1 sidecar. v1 is advisory
 * only; v2 is enforced. This guarantees the 1581 existing v1 sidecars cannot brick.
 */

export type SidecarShape = "rich-v1" | "thin-v1" | "v2" | "unknown";

export function detectSidecarShape(sc: any): SidecarShape {
  if (sc?.schemaVersion === "source-v2") return "v2";
  if (Array.isArray(sc?.namedExamples) || Array.isArray(sc?.keyClaims)) return "rich-v1";
  if (Array.isArray(sc?.properNouns)) return "thin-v1";
  return "unknown";
}

export function isV2(sc: any): boolean {
  return detectSidecarShape(sc) === "v2";
}

export type AnchorId = string; // e.g. "ch01.ex.car-door", "ch01.fact.3"

/**
 * Replication standing of a claim, as judged by the researcher at source time.
 * OPTIONAL and additive — absence means "not assessed" (treated as robust; the
 * legacy default, so the 1581 existing sidecars are unaffected). When present,
 * STEP-2 R9 requires the writer to HEDGE anything below `robust` instead of
 * stating it as settled law; the WT-E `factual_accuracy` rubric scores the
 * faithful-but-disputed case the realness gate cannot see.
 *   - robust    — replicates reliably; state plainly.
 *   - mixed     — some support, some failures to replicate; hedge ("evidence is mixed").
 *   - contested — actively disputed in the field; hedge or reframe as a heuristic.
 *   - failed    — failed to replicate / largely retracted; use only with an explicit caveat.
 */
export type ReplicationStatus = "robust" | "mixed" | "contested" | "failed";

export const REPLICATION_STATUSES: readonly ReplicationStatus[] = [
  "robust",
  "mixed",
  "contested",
  "failed",
];

export type TestableFact = {
  id: AnchorId;
  claim: string; // a single verifiably-true proposition (the keyed-answer seed)
  becauseMechanism: string; // 1 causal sentence — the explanation seed
  commonError: string; // the plausible WRONG belief — a non-strawman distractor seed
  errorIsWhy: string; // why the commonError is wrong
  derivedFrom?: AnchorId;
  replicationStatus?: ReplicationStatus; // OPTIONAL — flags a claim with known replication trouble (see ReplicationStatus)
  /**
   * R-046: a verbatim run of the chapter's own source span that supports `claim`.
   * REQUIRED when the run was given the book's text (`sourceProvenance:
   * "source-text"`); `null`/absent on a model-memory sidecar, where there is no
   * text to quote. A fact whose quote cannot be found in the span is dropped, not
   * repaired — see src/source/sourceQuoteGrounding.ts.
   */
  sourceQuote?: string | null;
};

/**
 * R-056 — a hardSpecific plus the proposition it belongs to and the source run
 * that carries it.
 *
 * A hardSpecific is capped at five words, which deletes the RELATION between
 * tokens: the released Franklin ch01 arrival case stored
 * `['three puffy rolls','one Dutch dollar','Market Street']`, and the downstream
 * verbatim quota then had to invent a predicate to join two of them in one
 * 14-word line ("just one Dutch dollar. He spent it on three puffy rolls" — a
 * false predicate that shipped on six surfaces). Storing the proposition beside
 * the token means the relation is never re-derived downstream.
 */
export type HardSpecificEvidence = {
  /** Must equal one of the case's `hardSpecifics` entries. */
  specific: string;
  /** One sentence stating the fact this token belongs to. */
  proposition: string;
  /** Verbatim source run supporting the proposition (source-text runs only). */
  sourceQuote?: string | null;
};

/**
 * R-282 — a maxim, prayer or aphorism the chapter genuinely turns on.
 *
 * Such a line is a CLAUSE, so it can never be a hardSpecific (which must compose
 * inside a word-budgeted unit as a noun phrase). Stored here with a ready-made
 * attribution frame, the writer has a grammatical slot for it instead of
 * stitching it into a sentence that is not English ("Turning the grindstone wore
 * him down until a speckled Ax is best won out").
 */
export type SourceQuotation = {
  id: AnchorId;
  /** The quoted line itself, verbatim from the source span. */
  quote: string;
  /** A complete sentence CONTAINING the quote, e.g. `Franklin's line is "…"`. */
  attributionFrame: string;
  sourceQuote?: string | null;
};

/** R-052 — an item the researcher could not quote and therefore ABSTAINED on. */
export type DroppedSourceItem = {
  kind: "fact" | "case" | "specific" | "quotation";
  id: string;
  reason: string;
  attempts: number;
};

export type NamedExampleV2 = {
  id: AnchorId;
  label: string;
  summary: string;
  teachesWhat?: string;
  hardSpecifics: string[]; // 2-4 concrete checkable tokens (a number, place, person, date)
  realWorld: boolean; // true = a real case; false = an author's named device (exempt from realness)
  /** R-046: verbatim source run supporting `summary` (source-text runs only). */
  sourceQuote?: string | null;
  /** R-056: one entry per hardSpecific (source-text runs only). */
  hardSpecificEvidence?: HardSpecificEvidence[];
};

export type NamedFramework = { name: string; members: string[]; acronym?: boolean };

/** v2 is additive over the rich-v1 shape; old readers ignore the new fields. */
export type SourceSidecarV2 = {
  schemaVersion: "source-v2";
  chapterNumber: number;
  chapterTitle: string;
  centralConcept: { id?: AnchorId; name: string; plainDefinition: string; whyItMatters?: string };
  keyClaims: string[];
  namedExamples: NamedExampleV2[];
  hardEdge: string;
  paraphraseNotes?: string;
  testableFacts: TestableFact[]; // >= the chapter's quiz floor (9)
  frameworks?: NamedFramework[];
  /**
   * R-046 — how these claims were obtained. Absent on every sidecar written
   * before ingestion existed, which is read as "model-memory": the field is
   * additive, and no reader may treat its absence as source-grounding.
   */
  sourceProvenance?: SourceTextProvenanceLabel;
  /** sha256 of the frozen source text these quotes were checked against. */
  sourceTextSha256?: string;
  /** R-282 — clause-shaped source lines with a ready-made attribution frame. */
  quotations?: SourceQuotation[];
  /** R-052 — items the researcher abstained on rather than fabricate. */
  droppedItems?: DroppedSourceItem[];
};

/** Duplicated from src/source/sourceText.ts as a plain union so the sidecar
 *  schema (a pure type module) does not depend on the fs-touching ingestion
 *  module. A contract test pins the two lists equal. */
export type SourceTextProvenanceLabel = "source-text" | "model-memory";
