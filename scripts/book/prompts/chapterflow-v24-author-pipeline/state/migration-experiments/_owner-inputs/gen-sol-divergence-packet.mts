/** READ-ONLY reporting tool (no implementation change, no model call, no writes to
 *  corpus/seal/src). Builds the SOL_JUDGE_SOURCE_REGISTER_DIVERGENCE_PACKET + the
 *  LAYER_N_V2_FINAL_QUALIFICATION_RESULT from the preserved run-3 evidence.
 *
 *  A DISPUTED case = an item where gpt-5.6-sol raised a fabrication / misleading-
 *  source-framing mustFix AND a gpt-5.5 judge (high or xhigh) did NOT. Fields are
 *  populated verbatim from the evidence; classification is left BLANK for the owner.
 *  Passages are NOT pre-classified as "illustrative examples". */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

import { renderChapterReaderDocPhase1 } from "../../../src/review/renderReaderDoc.js";
import { chapterContentHash } from "../../../src/critics/qcAttestation.js";
import { AUTHOR_CHAPTER_BAR, buildReaderReviewTask } from "../../../src/review/readerReview.js";
import { nativeReviewThresholdsSha256, buildNativeReviewInstrumentManifest } from "../../../src/bakeoff/migration/nativeReviewSeal.js";
import type { NativeReviewCorpusV2, NativeReviewThresholdsV2, NativeReviewSealV2 } from "../../../src/bakeoff/migration/nativeReviewTypes.js";

const OI = "state/migration-experiments/_owner-inputs";
const BASE = "state/migration-experiments/layer-n-v2-qualification/native-review-v2";
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

const JUDGE_DIRS = { sol: "gpt-5-6-sol-high", hi: "gpt-5-5-high", xh: "gpt-5-5-xhigh" } as const;
const JUDGE_ID = { sol: "gpt-5.6-sol@high", hi: "gpt-5.5@high", xh: "gpt-5.5@xhigh" } as const;

const corpus = JSON.parse(readFileSync(`${OI}/stage-q/layer-n-v2-corpus.json`, "utf8")) as NativeReviewCorpusV2;
const thresholds = JSON.parse(readFileSync(`${OI}/native-review-thresholds.v2.json`, "utf8")) as NativeReviewThresholdsV2;
const seal = JSON.parse(readFileSync(`${OI}/stage-q/STAGE-Q-LAYER-N-V2-SEAL.json`, "utf8")) as NativeReviewSealV2;
const byId = new Map(corpus.items.map((i) => [i.itemId, i]));

const instrumentManifest = buildNativeReviewInstrumentManifest(nativeReviewThresholdsSha256(thresholds));
const readerTaskSha = sha(buildReaderReviewTask("ch.txt", AUTHOR_CHAPTER_BAR));

type Ev = { review: any; raw: string | null; path: string } | null;
function loadEv(dir: string, itemId: string): Ev {
  const p = `${BASE}/${dir}/${itemId}/evidence.json`;
  if (!existsSync(p)) return null;
  const e = JSON.parse(readFileSync(p, "utf8"));
  return { review: e.parsedReview, raw: e.rawFinalMessage ?? null, path: p };
}
const FAB_RE = /fabricat|invent|misleading|presented as factual|hypothetical|did not happen|not established|fictional|as if (real|it happened)|appears? invented/i;
function fabComplaints(review: any): any[] {
  if (!review) return [];
  return (review.complaints ?? []).filter((c: any) => c.mustFix && FAB_RE.test(String(c.problem)));
}
function allMustFix(review: any): any[] {
  return review ? (review.complaints ?? []).filter((c: any) => c.mustFix) : [];
}

// Heuristic entity detection over a passage (owner verifies against the included text).
function entityScan(text: string) {
  const proper = [...new Set((text.match(/\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+){0,3})\b/g) ?? [])
    .filter((w) => !/^(The|This|That|These|Those|When|Then|While|Because|Once|After|Before|Every|Each|First|Next|Finally|Imagine|Suppose|Consider|Notice|Instead)$/.test(w)))];
  const orgRe = /\b([A-Z][A-Za-z&.'-]*(?:\s+[A-Z][A-Za-z&.'-]+)*\s+(?:Hotel|Inc|Incorporated|Corp|Corporation|Company|Co|University|College|School|Hospital|Clinic|Airlines|Airline|Bank|Institute|Foundation|Department|Deere|Labs?|Studios?|Motors))\b/g;
  const orgs = [...new Set(text.match(orgRe) ?? [])];
  return {
    properNounsDetected: proper,
    namedOrganizationsDetected: orgs,
    namedPeoplePresent: proper.length > orgs.length, // heuristic; owner verifies from passage
    namedOrganizationsPresent: orgs.length > 0,
    datesPresent: /\b(1[5-9]\d\d|20\d\d)\b|\b\d{1,2}\s*(?:st|nd|rd|th)?\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\b|\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i.test(text),
    quotationsPresent: /["“”]/.test(text),
    historicalOccurrenceImplied: /\b(in \d{4}|years ago|back in|historically|famous(?:ly)?|the real|actually happened|documented|case study)\b/i.test(text),
  };
}
function framingLanguage(text: string) {
  const hyp = (text.match(/\b(imagine|suppose|hypothetical(?:ly)?|for example|picture|say that|consider a|a fictional|for instance|let'?s say)\b/gi) ?? []);
  return { hypotheticalFramingMarkers: [...new Set(hyp.map((s) => s.toLowerCase()))], presentsAsNarrative: hyp.length === 0 };
}
// Which example unit a complaint points at (e.g. "example 3" -> examples[2]).
function unitExample(chapter: any, unit: string): any | null {
  const m = String(unit).match(/example\s*(\d+)/i);
  if (!m) return null;
  return (chapter.examples ?? [])[Number(m[1]) - 1] ?? null;
}
function exampleText(ex: any): string {
  if (!ex) return "";
  return [ex.title, ex.scenario, ex.whatToDo, ex.whyItMatters].filter(Boolean).join("\n");
}
function findingSummary(ev: Ev): any {
  if (!ev) return { processed: false };
  const r = ev.review;
  return {
    processed: true,
    pass: r?.pass ?? null, ship84: r?.ship84 ?? null, composite: r?.composite ?? null, valid: r?.valid ?? null,
    fabricationMustFix: fabComplaints(r).map((c: any) => ({ unit: c.unit, problem: c.problem })),
    allMustFixUnits: allMustFix(r).map((c: any) => c.unit),
  };
}

// ── Enumerate disputed cases ──────────────────────────────────────────────────
const disputed: any[] = [];
for (const item of corpus.items) {
  const sol = loadEv(JUDGE_DIRS.sol, item.itemId);
  if (!sol) continue; // sol did not process this item (partial run)
  const solFab = fabComplaints(sol.review);
  if (solFab.length === 0) continue;
  const hi = loadEv(JUDGE_DIRS.hi, item.itemId);
  const xh = loadEv(JUDGE_DIRS.xh, item.itemId);
  const hiFab = hi ? fabComplaints(hi.review) : null;
  const xhFab = xh ? fabComplaints(xh.review) : null;
  const gpt55DidNotFlag = (hi && (hiFab as any[]).length === 0) || (xh && (xhFab as any[]).length === 0);
  if (!gpt55DidNotFlag) continue;

  const base = byId.get(item.baseItemId);
  const renderedDoc = renderChapterReaderDocPhase1(item.chapter);
  // Disputed passages = the example units sol flagged for fabrication.
  const flaggedUnits = [...new Set(solFab.map((c: any) => String(c.unit)))];
  const passages = flaggedUnits.map((u) => {
    const ex = unitExample(item.chapter, u);
    const txt = ex ? exampleText(ex) : (item.chapter as any)[u] ?? "";
    return {
      unit: u,
      exampleId: ex?.exampleId ?? null,
      disputedPassage: ex ? ex.scenario : txt,
      whatToDo: ex?.whatToDo ?? null,
      whyItMatters: ex?.whyItMatters ?? null,
      surroundingContext: exampleText(ex),
      visibleFramingLanguage: framingLanguage(exampleText(ex)),
      entities: entityScan(exampleText(ex)),
    };
  });

  disputed.push({
    caseId: item.itemId,
    kind: item.kind,
    cleanBaseIdentifier: item.baseItemId,
    cleanBaseChapterContentSha256: base ? chapterContentHash(base.chapter) : null,
    itemChapterContentSha256: chapterContentHash(item.chapter),
    completeReaderFacingChapter: renderedDoc,
    completeReaderFacingChapterSha256: sha(renderedDoc),
    disputedPassages: passages,
    sourceUse: {
      sourceAnchorIds: "NONE — chapters carry no structured source anchors/citations/provenance fields (top-level keys: hook, breakdown, examples, quiz, reviewCards, implementationPlan, memorableLines).",
      sourceUseOrigin: "OBSERVED-FROM-TEXT-ONLY — the reviewer received no source plan or source evidence (see callContextManifest.sourcePlanVisibility). Whether a named referent is a real documented case or invented is NOT verifiable from the reviewer's inputs.",
      sourceUseForm: passages.some((p) => !p.visibleFramingLanguage.presentsAsNarrative) ? "MIXED (some hypothetical framing markers present)" : "NAMED-CHARACTER NARRATIVE SCENARIO (no hypothetical-framing markers detected; presented as narrative)",
    },
    // Entity flags computed over the FULL reader-facing chapter the reviewer saw
    // (not just the sol-flagged unit) so grouped units don't under-sample.
    // Heuristic (regex NER) — the verbatim chapter + proper-noun list are included
    // so the owner can verify; namedPeople here means "proper nouns present that
    // are not org-patterned" (people OR places — regex cannot reliably separate).
    entitySummary: (() => {
      const de = entityScan(renderedDoc);
      return {
        namedPeopleOrPlacesPresent: de.properNounsDetected.filter((n) => !de.namedOrganizationsDetected.includes(n)).length > 0,
        namedPeoplePresent: de.properNounsDetected.filter((n) => !de.namedOrganizationsDetected.includes(n)).length > 0,
        namedOrganizationsPresent: de.namedOrganizationsPresent,
        datesPresent: de.datesPresent,
        quotationsPresent: de.quotationsPresent,
        historicalOccurrenceImplied: de.historicalOccurrenceImplied,
        properNounsDetected: de.properNounsDetected.slice(0, 40),
        namedOrganizationsDetected: de.namedOrganizationsDetected,
        heuristicNote: "regex NER over the full rendered chapter; owner verifies against completeReaderFacingChapter",
      };
    })(),
    findings: {
      "gpt-5.6-sol@high": findingSummary(sol),
      "gpt-5.5@high": findingSummary(hi),
      "gpt-5.5@xhigh": findingSummary(xh),
    },
    solEvidenceSpans: (sol.review?.quotes ?? []).map((q: any) => ({ quote: q.quote, verified: q.verified, why: q.why })),
    phase1: {
      "gpt-5.6-sol@high": { composite: sol.review?.composite ?? null, ship84: sol.review?.ship84 ?? null, pass: sol.review?.pass ?? null },
      "gpt-5.5@high": hi ? { composite: hi.review?.composite ?? null, ship84: hi.review?.ship84 ?? null, pass: hi.review?.pass ?? null } : "NOT PROCESSED",
      "gpt-5.5@xhigh": xh ? { composite: xh.review?.composite ?? null, ship84: xh.review?.ship84 ?? null, pass: xh.review?.pass ?? null } : "NOT PROCESSED",
    },
    phase2: item.requiresPhase2 ? {
      "gpt-5.6-sol@high": sol.review?.quizAdjudication ?? null,
      "gpt-5.5@high": hi?.review?.quizAdjudication ?? null,
      "gpt-5.5@xhigh": xh?.review?.quizAdjudication ?? null,
    } : "N/A (not a phase-2 quiz item)",
    mutationManifest: item.mutationManifest ?? "N/A (clean-pass control; not a variant)",
    goldExpectation: item.expected,
    callContextManifest: {
      promptCardSha256: readerTaskSha,
      renderedChapterSha256: sha(renderedDoc),
      sourcePlanVisibility: "NONE — IMP-08 isolated reviewer workspace contains ONLY the phase-1 rendered doc.",
      sourceEvidenceVisibility: "NONE — no source packets/evidence provided to the reviewer.",
      bookChapterMetadataVisibility: "NONE beyond the rendered chapter's own reader-facing content — no external book/chapter metadata, no answer key in phase-1.",
      phase1SchemaHash: readerTaskSha,
      phase2SchemaHash: instrumentManifest.phase2TaskSchemaVersion + ":" + instrumentManifest.outputContractVersion,
    },
    ownerAdjudication: {
      finalClassification: "",  // SOL_FALSE_POSITIVE | CLEAN_CONTROL_NOT_ACTUALLY_CLEAN | REVIEW_CONTEXT_OR_RENDERING_DEFECT | GENUINE_BOUNDARY_CASE
      reviewerRoleDisposition: "",  // QUALIFIED | UNQUALIFIED | INCONCLUSIVE
      evidence: "",
      rationale: "",
      confidence: "",
    },
  });
}

const out = {
  schema: "s16-sol-judge-source-register-divergence-packet-v1",
  generatedFrom: "run-3 preserved evidence (no model call, no implementation change)",
  corpusSha256: seal.corpusSha256,
  instrumentManifestSha256: seal.instrumentManifestSha256,
  thresholdsSha256: seal.thresholdsSha256,
  note: "A disputed case = gpt-5.6-sol raised a fabrication/misleading-source mustFix AND a gpt-5.5 judge did not. Passages are NOT pre-classified. Classification fields are BLANK for owner adjudication.",
  solPartialRun: "gpt-5.6-sol processed 20/28 items before its run was halted to surface the finding; disputed cases are drawn from those processed items.",
  disputedCaseCount: disputed.length,
  disputedCases: disputed,
};
writeFileSync(`${OI}/stage-q/SOL_JUDGE_SOURCE_REGISTER_DIVERGENCE_PACKET.json`, JSON.stringify(out, null, 2) + "\n");
console.log(`WROTE SOL_JUDGE_SOURCE_REGISTER_DIVERGENCE_PACKET.json — ${disputed.length} disputed cases`);
console.log("disputed caseIds:", disputed.map((d) => `${d.caseId} (sol fab on ${d.disputedPassages.map((p: any) => p.unit).join(",")})`).join("\n  "));
