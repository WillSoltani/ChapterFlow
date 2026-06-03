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

export type TestableFact = {
  id: AnchorId;
  claim: string; // a single verifiably-true proposition (the keyed-answer seed)
  becauseMechanism: string; // 1 causal sentence — the explanation seed
  commonError: string; // the plausible WRONG belief — a non-strawman distractor seed
  errorIsWhy: string; // why the commonError is wrong
  derivedFrom?: AnchorId;
};

export type NamedExampleV2 = {
  id: AnchorId;
  label: string;
  summary: string;
  teachesWhat?: string;
  hardSpecifics: string[]; // 2-4 concrete checkable tokens (a number, place, person, date)
  realWorld: boolean; // true = a real case; false = an author's named device (exempt from realness)
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
};
