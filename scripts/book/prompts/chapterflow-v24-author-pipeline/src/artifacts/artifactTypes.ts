import type { BreakdownOutput } from "../agents/writer-breakdown.js";
import type { CardsOutput } from "../agents/writer-cards.js";
import type { ExampleOutput } from "../agents/writer-example.js";
import type { HookOutput } from "../agents/writer-hook.js";
import type { ImplementationPlanOutput } from "../agents/writer-implementation-plan.js";
import type { MemorableLine } from "../agents/memorable-lines.js";
import type { QuizOutput } from "../agents/writer-quiz.js";
import type { ChapterDesignDoc, SourceAnchorForPrompt, SourceClaimType } from "../types.js";

export const V23_COMPILER_SCHEMA_VERSION = "chapterflow-v23-compiler" as const;
export const SOURCE_PACKET_SCHEMA_VERSION = "source-packet-v1" as const;
export const CHAPTER_BLUEPRINT_SCHEMA_VERSION = "chapter-blueprint-v1" as const;
export const CHAPTER_BRIEF_SCHEMA_VERSION = "chapterflow-brief-v1" as const;
export const BOOK_DESIGN_SCHEMA_VERSION = "book-design-v1" as const;
export const SECTION_ARTIFACT_SCHEMA_VERSION = "section-artifact-v1" as const;
export const EVIDENCE_MAP_SCHEMA_VERSION = "chapter-evidence-map-v1" as const;
export const RISK_SCORE_SCHEMA_VERSION = "chapter-risk-score-v1" as const;

export type CompilerStage =
  | "source-packets"
  | "blueprints"
  | "sections"
  | "assembly"
  | "evidence"
  | "risk";

export type CompilerRunRecord = {
  schemaVersion: typeof V23_COMPILER_SCHEMA_VERSION;
  bookId: string;
  runId: string;
  createdAt: string;
  architecture: "compiler";
  finalChapterSchema: "chapterflow-v21-authored";
};

export type SourcePacketFact = {
  id: string;
  claim: string;
  mechanism: string;
  commonError: string;
  whyWrong: string;
  allowedClaimTypes: SourceClaimType[];
  groundedNumbers: string[];
  groundedEntities: string[];
  groundedPlaces: string[];
  verificationRefs: string[];
  replicationStatus?: "robust" | "mixed" | "contested" | "failed";
  /** Set by the source-packet compiler's book-wide dedup pass when this fact's
   *  claim (chapter-title stripped) recurs across a majority of chapters — i.e. a
   *  boilerplate book-thesis fact the researcher stamped onto every chapter. Such
   *  facts stay in packet.facts (fact floor + citable for grounding via
   *  constraints.allowedFactIds) but the blueprint dealer excludes them from the
   *  TEACHING pool so no chapter is forced to build summary/example/action prose
   *  around the identical thesis (which saturates the section-gate SEC90 phrase
   *  budget book-wide). See chapterBlueprint.factIds(). */
  bookWideDuplicate?: boolean;
  /** 1-based pedagogical teaching rank (1 = best teaching fact) assigned by the
   *  packet compiler's deterministic rankTeachingFacts() pass (P13). Additive and
   *  optional: legacy packets written before P13 have no teachingPriority, in which
   *  case the blueprint dealer falls back to positional (packet-order) fact dealing
   *  so those packets compile byte-identically. Feature keys on field presence. */
  teachingPriority?: number;
};

export type SourcePacketCase = {
  id: string;
  label: string;
  summary: string;
  realWorld: boolean;
  naturalSetting?: string;
  hardSpecifics: string[];
  allowedUses: SourceClaimType[];
  forbiddenUses: string[];
  doNotRestamp: string[];
};

export type SourcePacketFramework = {
  id: string;
  name: string;
  members: string[];
  completenessRequired: boolean;
};

export type SourcePacketV1 = {
  schemaVersion: typeof SOURCE_PACKET_SCHEMA_VERSION;
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  chapterTitle: string;
  sourceSidecarPath: string | null;
  sourceHash: string | null;
  facts: SourcePacketFact[];
  namedCases: SourcePacketCase[];
  frameworks: SourcePacketFramework[];
  allowedAnchors: SourceAnchorForPrompt[];
  allowedNumbers: string[];
  allowedEntities: string[];
  allowedPlaces: string[];
  forbiddenClaims: string[];
  forbiddenLeakage: Array<{ from?: string; into: string; warning: string }>;
  sourceQuality: {
    status: "strong" | "adequate" | "thin" | "blocked";
    risks: string[];
  };
  /** Id of the top-ranked mechanism-bearing fact (the chapter's best idea) chosen by
   *  rankTeachingFacts() (P13). The blueprint's coreMove is built from this fact's
   *  mechanism/claim instead of packet.facts[0]. Additive/optional: absent on legacy
   *  packets, in which case coreMove falls back to facts[0] (byte-identical). */
  coreMoveFactId?: string;
};

/** The nine designable variety pools a book's blueprints draw from. These are the pools that
 *  carry GENRE flavor (scene frames, beats, venues, practice constraints/forms, action mechanisms,
 *  weekly forms). The genre-neutral SHAPE vocabularies (quiz/card/hook/counter/if-then shapes,
 *  scene modes) are NOT designable — they stay module constants in chapterBlueprint.ts. */
export type BookDesignPools = {
  sceneFramesDecision: string[];
  sceneFramesExperiential: string[];
  beatsDecision: string[];
  beatsExperiential: string[];
  venues: string[];
  practiceConstraints: string[];
  practiceForms: string[];
  actionMechanisms: string[];
  weeklyForms: string[];
};

/** Per-book design artifact (P14). A compiled, hash-pinned artifact (like source packets) so
 *  blueprints stay deterministic while their variety pools become per-book instead of a single
 *  global monoculture. Stored at state/book-design/<bookId>.design.json. Additive/optional at the
 *  consumption layer: a book WITHOUT this artifact compiles byte-identically to the pre-P14 world
 *  (chapterBlueprint.resolvePools falls back to genre pools, then the legacy in-code constants). */
export type BookDesignV1 = {
  schemaVersion: typeof BOOK_DESIGN_SCHEMA_VERSION;
  bookId: string;
  genre: string;
  pools: BookDesignPools;
  provenance: {
    source: "derived" | "genre-fallback";
    /** Source-case ids / sidecar material the derived pools were mined from. */
    derivedFrom?: string[];
  };
};

/**
 * v24 "author-first" chapter brief (B1). ONE PAGE of hard reservations + non-binding intent,
 * replacing the dealt structure grammars of the v23 blueprint for the v24 author architecture:
 * the writer owns structure; the brief reserves only what actually collides across chapters
 * (cases, cast, quiz keys) and SUGGESTS everything else. Purely ADDITIVE — the compiler/legacy
 * blueprint path never reads or writes briefs.
 */
export type ChapterBriefV1 = {
  schemaVersion: typeof CHAPTER_BRIEF_SCHEMA_VERSION;
  chapterId: string;
  chapterNumber: number;
  title: string;
  /** The chapter's one named move — the P13 core-move rule (coreMoveFactId's mechanism/claim,
   *  legacy fallback facts[0]), identical to what the blueprint compiler would state. */
  coreMove: string;
  /** One line: the highest-teachingPriority fact's claim (legacy fallback: first fact). */
  thesis: string;
  /** Deterministic guidance, not a contract: "After this chapter, a reader can <coreMove>". */
  readerPromise: string;
  /** HARD reservation: THIS chapter's named source cases. Scene these fully; they are its alone. */
  ownedCases: Array<{ id: string; label: string }>;
  /** HARD reservation: every OTHER chapter's case labels (deduped, alphabetical, capped) — never
   *  scene these; at most one passing mention. */
  notYours: string[];
  /** HARD reservation: chapter-disjoint invented first names (2-4), dealt by the blueprint's
   *  name dealer, avoiding real source-person names from ANY chapter's packet. */
  cast: string[];
  /** HARD reservation: the anti-gaming dealt quiz answer key (same values the compiler path
   *  would deal for this book/chapter). */
  answerIndexPattern: number[];
  /** Non-binding: sibling openers on disk (regen case) + sibling flavor picks, capped small. */
  avoid: string[];
  lengthBudget: { renderedChars: number; tolerance: number };
  /** Non-binding venue/frame suggestions from the book design pools (empty without a design
   *  artifact). Use, adapt, or ignore. */
  flavor: string[];
};

export type HookSlot = {
  shape: string;
  requiredFactIds: string[];
};

export type SummarySlot = {
  fastReadTargetChars: [number, number];
  deepReadTargetChars: [number, number];
  fullReadTargetChars: [number, number];
  requiredFactIds: string[];
};

export type ExampleSlotV1 = {
  slotId: string;
  purpose: "failure-mode" | "application" | "contrast" | "recovery" | "decision";
  sceneMode: string;
  sceneFrame: string;
  venue: string;
  allowedNames: string[];
  requiredFactIds: string[];
  requiredCaseIds: string[];
  forbiddenVenues: string[];
  requiredBeat: string;
};

export type QuizSlotV1 = {
  questionId: string;
  requiredFactIds: string[];
  caseCueIds: string[];
  correctIndex: number;
  depthLevel: "simple" | "standard" | "deep";
  promptShape: string;
  answerStyle: string;
  distractorTrap: string;
};

export type CardSlotV1 = {
  cardId: string;
  requiredFactIds: string[];
  caseCueIds: string[];
  difficulty: "easy" | "medium" | "hard";
  frontShape: string;
  retrievalTarget: string;
  backShape: string;
};

export type ActionSlotV1 = {
  actionMechanism: string;
  requiredFactIds: string[];
  weeklyPracticeForm: string;
  ifThenPlanShapes: string[];
  practiceForm: string;
  practiceConstraint: string;
};

export type ChapterBlueprintV1 = {
  schemaVersion: typeof CHAPTER_BLUEPRINT_SCHEMA_VERSION;
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  title: string;
  sourcePacketPath: string;
  sourcePacketHash: string;
  /** canonicalJsonSha256 of the per-book design artifact whose pools this blueprint was compiled
   *  from (P14). Additive/optional: present only when a design artifact drove the pools; ABSENT on
   *  the genre-fallback and legacy paths, so a book without a design artifact stays byte-identical
   *  to the pre-P14 blueprint. Pins the blueprint to the exact design bytes — editing the artifact
   *  changes this hash (and the dealt pools). */
  designHash?: string;
  plan: ChapterDesignDoc;
  coreMove: {
    statement: string;
    sourceFactIds: string[];
  };
  reservedVariety: {
    allowedNames: string[];
    forbiddenNames: string[];
    hookShape: string;
    counterShape: string;
    sceneMechanism: string;
    sceneMode: string;
    venuePalette: string[];
    answerIndexPattern: number[];
    actionMechanism: string;
    weeklyPracticeForm: string;
  };
  sections: {
    hook: HookSlot;
    summaries: SummarySlot;
    examples: ExampleSlotV1[];
    quiz: QuizSlotV1[];
    cards: CardSlotV1[];
    action: ActionSlotV1;
  };
  constraints: {
    allowedFactIds: string[];
    allowedCaseIds: string[];
    forbiddenClaims: string[];
    forbiddenLeakage: string[];
    bannedHouseTics: string[];
  };
};

export type SummaryPackV1 = {
  schemaVersion: typeof SECTION_ARTIFACT_SCHEMA_VERSION;
  artifactType: "summary-pack";
  chapterId: string;
  hook: HookOutput;
  breakdown: BreakdownOutput;
  keyTakeaway: string;
  keyTakeawaySourceAnchorIds: string[];
  tryThisNow?: string;
  tryThisNowSourceAnchorIds?: string[];
  sourceFactIds: string[];
};

export type ExamplePackV1 = {
  schemaVersion: typeof SECTION_ARTIFACT_SCHEMA_VERSION;
  artifactType: "example-pack";
  chapterId: string;
  examples: Array<ExampleOutput & {
    slotId?: string;
    sourceFactIds?: string[];
    namedCaseIds?: string[];
    introducedEntities?: string[];
    numbersUsed?: string[];
  }>;
};

export type LearningPackV1 = {
  schemaVersion: typeof SECTION_ARTIFACT_SCHEMA_VERSION;
  artifactType: "learning-pack";
  chapterId: string;
  quiz: QuizOutput;
  cards: CardsOutput;
};

export type ActionPackV1 = {
  schemaVersion: typeof SECTION_ARTIFACT_SCHEMA_VERSION;
  artifactType: "action-pack";
  chapterId: string;
  tryThisNow: string;
  tryThisNowSourceAnchorIds: string[];
  implementationPlan: ImplementationPlanOutput;
};

export type SectionPackV1 = SummaryPackV1 | ExamplePackV1 | LearningPackV1 | ActionPackV1;
export type SectionKind = SectionPackV1["artifactType"];

export const SECTION_KINDS: readonly SectionKind[] = [
  "summary-pack",
  "example-pack",
  "learning-pack",
  "action-pack",
] as const;

export type ChapterEvidenceMapV1 = {
  schemaVersion: typeof EVIDENCE_MAP_SCHEMA_VERSION;
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  sourcePacketHash: string;
  paths: Record<string, {
    sourceFactIds: string[];
    sourceAnchorIds: string[];
    namedCaseIds: string[];
    numbersUsed: string[];
    entitiesUsed: string[];
    unsupportedNumbers: string[];
    unsupportedEntities: string[];
    unsupportedAnchorIds: string[];
  }>;
  summary: {
    unsupportedNumbers: string[];
    unsupportedEntities: string[];
    unsupportedAnchorIds: string[];
    factCoverage: number;
  };
};

export type ChapterRiskScoreV1 = {
  schemaVersion: typeof RISK_SCORE_SCHEMA_VERSION;
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  score: number;
  lane: "low" | "medium" | "high";
  reasons: string[];
  recommendedAction: "formal-qc" | "qc-shadow" | "regenerate-section";
};

export type BookRiskScoreV1 = {
  schemaVersion: typeof RISK_SCORE_SCHEMA_VERSION;
  bookId: string;
  generatedAt: string;
  lane: "low" | "medium" | "high";
  chapters: ChapterRiskScoreV1[];
  bookWideRisks: string[];
};

export type VoicePatchV1 = {
  schemaVersion: typeof SECTION_ARTIFACT_SCHEMA_VERSION;
  artifactType: "voice-patch";
  chapterId: string;
  patches: JsonPatchOperation[];
};

export type JsonPatchOperation =
  | { op: "replace" | "add"; path: string; value: unknown }
  | { op: "remove"; path: string };

export type MemorableLinesDeterministic = {
  memorableLines: MemorableLine[];
  generatedBy: "deterministic" | "model";
};

// ── v24 reader-review instrument (ADDITIVE — component A1) ──────────────────
//
// A blinded, independent reader scores ONE rendered chapter document
// (src/review/renderReaderDoc.ts) on the 10 rubric factors, derives the quiz
// keys from the prose, and cites verbatim quotes that are byte-verified
// against the document. adjudicateReview (src/review/readerReview.ts) turns
// the reader's parsed output into this durable artifact, written to
// state/reviews/<bookId>/ch<NN>.review.json.

export const CHAPTER_REVIEW_SCHEMA_VERSION = "chapterflow-review-v1" as const;

/** The 10 review factors, in REVIEW_WEIGHTS order (weights live in
 *  src/review/readerReview.ts and must cover exactly this set). */
export const REVIEW_FACTORS = [
  "retention",
  "quizzes",
  "transfer",
  "practical",
  "summaries",
  "tone",
  "limits",
  "insight",
  "density",
  "beginner",
] as const;

export type ReviewFactor = (typeof REVIEW_FACTORS)[number];

export type ChapterReviewQuote = {
  quote: string;
  why: string;
  /** True iff `quote` is an exact byte substring of the rendered reader doc. */
  verified: boolean;
};

export type ChapterReviewComplaint = {
  /** Where the defect lives (e.g. "quiz Q2", "deep read", "example 3"). */
  unit: string;
  problem: string;
  mustFix: boolean;
};

export type ChapterReviewKeyCheck = {
  /** The reader's own prose-derived answers, normalized to "a"|"b"|"c" (or the
   *  raw token when it does not normalize). Positional with quiz.questions. */
  derived: string[];
  matches: number;
  of: number;
  disagreements: string[];
};

export type ChapterReviewV1 = {
  schemaVersion: typeof CHAPTER_REVIEW_SCHEMA_VERSION;
  chapterId: string;
  chapterNumber: number;
  /** chapterContentHash (v2) of the reviewed chapter — same helper autopilot uses. */
  contentHash: string;
  reviewerSessionId: string;
  // ── E2 review-carry binding fields (ADDITIVE, all OPTIONAL) ────────────────
  // These bind a persisted review to the EXACT bytes+conditions it was produced
  // under, so doAuthorReview can REUSE it (spawn nothing) only when every one of
  // them still matches at reuse time. Optional so legacy records (written before
  // E2) stay PARSEABLE — but a record MISSING any of them is NEVER reusable (the
  // carry predicate requires all present + matching → fail-closed on absence).
  /** The ship bar (opts.bar) this review was adjudicated against. A carry hits
   *  only when the current phase bar equals this. */
  bar?: number;
  /** sha256 (full hex) of the EXACT rendered reader doc the reader scored —
   *  ensureTrailingNewline(renderChapterReaderDoc(chapter)) — hashed at the
   *  write site. A doc-render drift (even one that leaves contentHash equal)
   *  invalidates the carry. */
  docHash?: string;
  /** Which docHash algorithm produced docHash. "v2" = sha256 over the trailing-
   *  newline-terminated rendered doc. A mismatch (or absence) blocks reuse. */
  hashVersion?: "v2";
  /** ISO timestamp the review was adjudicated. Audit only (never gates reuse). */
  reviewedAt?: string;
  scores: Record<ReviewFactor, number>;
  /** Weighted composite = sum(weight * score) / 100, rounded to 1 decimal. */
  composite: number;
  /** The reader's own ship/no-ship gate call against the bar. */
  ship84: boolean;
  /** composite >= bar AND ship84 AND keyCheck.matches === keyCheck.of AND valid. */
  pass: boolean;
  /** False when any cited quote fails byte-verification (or no quote was cited). */
  valid: boolean;
  keyCheck: ChapterReviewKeyCheck;
  quotes: ChapterReviewQuote[];
  /** Quiz-guessability tells the reader spotted (from quizDerivation.tells). */
  tells: string[];
  /** The reader's explicit defect list, passed through verbatim (default []). */
  complaints: ChapterReviewComplaint[];
  oneParagraphVerdict: string;
  /** Q3 structural key-coverage screen record: on a no-ship reader, each named
   *  "key omits Q<k>" claim recounted against the doc bytes (disproven ⇒ vote
   *  invalidated + respawned). Optional so legacy artifacts remain valid. */
  structuralScreen?: ChapterReviewStructuralScreen;
};

/** One screened structural key-coverage claim on a chapter review. */
export type ChapterReviewStructuralClaimDecision = {
  claim: string;
  q: number;
  verdict: "disproven" | "confirmed";
  keyRowLine?: number;
};

export type ChapterReviewStructuralScreen = {
  claimsScanned: number;
  decisions: ChapterReviewStructuralClaimDecision[];
  /** The disproof line that flipped this review valid→false, when it did. */
  invalidatedBy?: string;
};
