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
  /**
   * R-046 — the verbatim run of the book's own text this fact was drawn from,
   * copied straight from the sidecar. Present only on a source-text run; absent
   * on every model-memory packet, where there is nothing to quote.
   */
  sourceQuote?: string;
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
  /** R-046 — the verbatim source run this case's summary was drawn from. */
  sourceQuote?: string;
  /** R-056 — one sentence per hardSpecific stating the proposition it belongs
   *  to, so no downstream unit has to invent the relation between two tokens. */
  specificPropositions?: Array<{ specific: string; proposition: string }>;
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
  /**
   * R-055 — the chapter's own thesis, carried to the writers.
   *
   * The packet used to carry facts, cases, frameworks and permission lists and
   * nothing else, so no writer ever saw what the chapter was ABOUT. The measured
   * cost on the released Franklin book: ch04 keyClaim 7 said the dispute "ends in
   * a limited compromise on assessment method" (near the truth) while fact.08
   * said "without a decisive outcome for either side" (false) — the packet kept
   * the false fact and discarded the truer claim.
   *
   * READ-ONLY CONTEXT: it orients the writer, it is not a source of citable
   * specifics (those stay in facts/cases, which the gates check).
   */
  chapterContext?: {
    focus: string;
    coreClaim: string;
    hardEdge: string;
    keyClaims: string[];
  };
  /** R-046 — "source-text" when the sidecar this packet was compiled from was
   *  quoted from the book, "model-memory" when it was recalled. */
  sourceProvenance?: "source-text" | "model-memory";
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
  /** v5 (2026-07-05): the whole-SKELETON architecture family dealt to this chapter
   *  (single-deep-case / two-way-contrast / research-lead / failure-autopsy /
   *  everyday-first-person / misconception-reversal / historical-narrative /
   *  direct-conceptual). Dealt ABOVE the surface rotations and rendered as the
   *  FIRST structural writer instruction — the anti-monoculture lever. Optional so
   *  briefs compiled before v5 render without it. */
  architectureFamily?: string;
  /** HARD reservation (v24 W4): the hook/fastRead opening MODE dealt to this chapter, rotated
   *  across {question, scene, claim, statistic} so no one mode dominates the book (CHB6 backstop).
   *  Rendered as an explicit writer instruction. */
  openerType: BriefOpenerType;
  /** HARD reservation (v24 W4): a distinct 24-hour-challenge framing dealt no-repeat from a pool
   *  of ≥8 frames, so the "In the next 24 hours," stem cannot recur book-wide (CHB7 backstop). */
  challengeFrame: BriefChallengeFrame;
  /** HARD reservation (v24 W4): the tryThisNow STRUCTURE dealt to this chapter, so the "Pick one …"
   *  menu opener cannot dominate (CHB9 backstop). */
  practiceShape: BriefPracticeShape;
  /** HARD reservation (v24 S-tier P2; optional — briefs compiled before 2026-07-03 lack it):
   *  the three example DRAMATURGY lenses this chapter's 6 examples must cover, dealt under the
   *  two-thirds book cap so one scene class cannot own the book (CHB11 backstop). */
  exampleLenses?: BriefExampleLens[];
  /** HARD reservation (v24 S-tier P4; optional): the practice-item physical-action VERB register,
   *  dealt no-repeat so a "touch the …"-style tic cannot saturate book-wide. */
  practiceVerb?: BriefPracticeVerb;
  /** Dealt requirement (v24 S-tier P2 #14; optional): when true, this chapter's examples must
   *  include one failed/partial outcome. Dealt to ~2/3 of chapters — every 4-chapter acceptance
   *  sample sees at least one, without the every-chapter ritual. */
  requireFrictionExample?: boolean;
  /** Guidance (v24 S-tier P1; optional): the book's hot framework nouns computed from the source
   *  packets — the writer gets a per-chapter usage budget and overflow goes to case-concrete
   *  referents (CHB10 backstop). */
  frameworkNouns?: string[];
  /** STIER-2 (v3): the rotation-schema version this brief was DEALT under, stamped at compile.
   *  The regen-cap lineage prefers this stamp over the code constant, so a newer binary can
   *  never silently re-key (and reset) budgets for briefs still carrying an older deal. */
  rotationSchemaVersion?: string;
  /** STIER-2 P10 (v3): dealt example count ∈ {4,5,6}. */
  exampleCount?: number;
  /** STIER-2 P10 (v3): one dealt row per example slot — where the example ENTERS the framework
   *  loop, how it RESOLVES (failure|partial only on friction-dealt chapters), the rhetoric of its
   *  whatToDo/whyItMatters fields, and whether the slot carries ONE physical anchor. */
  exampleArcs?: Array<{
    entry: BriefExampleEntryPoint;
    outcome: BriefExampleOutcome;
    fieldStyle: BriefFieldStyle;
    prop: boolean;
  }>;
  /** STIER-2 P13 (v3): DISTINCT shapes for [tryThisNow, 24h-challenge, weekly-practice,
   *  if-then-contexts] — the four surfaces sharing ONE shape was the "read aloud ×4" chant. */
  practiceSlotShapes?: BriefPracticeShape[];
  /** STIER-2 P12 (v3): the four stem shapes this chapter's 9 questions draw from. */
  quizStemShapes?: BriefQuizStemShape[];
  /** STIER-2 P12 (v3): the four distractor failure modes dealt to this chapter. */
  quizFailureModes?: BriefQuizFailureMode[];
  /** STIER-2 P12 (v3): dealt fact→question order (permutation of 1..9) — questions must not
   *  march the packet's fact order. */
  questionFactOrder?: number[];
  /** STIER-2 P14 (v3): the three memorable-line shapes dealt to this chapter. */
  memorableShapes?: BriefMemorableShape[];
  /** STIER-2 P15 (v3): where the honest-limits paragraph lives in THIS chapter. */
  limitsPlacement?: BriefLimitsPlacement;
  /** STIER-2 P16 (v3): the chapter's primary first-mention grounding form. */
  groundingForm?: BriefGroundingForm;
  /** STIER-2 P11 (v3): the section-thread lead — either the chapter's invented cast[0] or its
   *  own ownedCases[0] real case (threading fastRead + ≥2 examples through the case's real
   *  actors; de-stamps the universal invented-proxy device). */
  /** The dealt lead thread. IMP-09 additive fields: `caseId` preserves the
   *  packet case's stable id (it existed at deal time and was discarded
   *  pre-IMP-09), and `aliases` is the COMPILER-DERIVED reviewable alias set
   *  (leadAliases.leadAliasSet over the label — full label, family name with
   *  particles, given name; never inferred). D7 checks alias presence; legacy
   *  briefs without these fields derive the same set at check time. */
  leadThread?: { kind: "invented" | "owned-case"; name: string; caseId?: string; aliases?: string[] };
  /** STIER-3 P17 (v4): the 2 idiom families this chapter verbalizes the shared framework
   *  through (the round-2 book panel churned on identical framework idiom book-wide). */
  idiomFamilies?: string[];
  /** STIER-3 P18 (v4): the chapter's whatToDo/whyItMatters opener register. */
  shellRegister?: string;
  /** CF-C (2026-07-08): the adjacent chapters' LEARNING JOBS — each neighbour's own
   *  `coreMove`, carried here so the single-brief writer card can render a
   *  NOT-THIS-CHAPTER line ("chapter N-1 owns Y; chapter N+1 owns Z — do not
   *  re-teach them") without re-reading siblings. The chapter's OWN job is its
   *  `coreMove` (no twin field). Compiled deterministically from the neighbours'
   *  packets, so a recompile is byte-derivable (F-1 sidecar invariant). Optional —
   *  omitted for a single-chapter book and absent on briefs compiled before CF-C. */
  adjacentJobs?: { prev?: string; next?: string };
};

/** v24 W4 rotation vocabularies — mirrored from src/compiler/briefRotation.ts (kept here as string
 *  literal unions so artifactTypes has no runtime dependency on the compiler module). */
export type BriefOpenerType = "question" | "scene" | "claim" | "statistic" | "tension-thesis";
export type BriefExampleEntryPoint =
  | "at-the-demand"
  | "mid-behavior"
  | "at-the-return-moment"
  | "aftermath-looking-back"
  | "outsider-arrives"
  | "before-anyone-notices";
export type BriefExampleOutcome = "clean-win" | "failure" | "partial" | "averted-late" | "still-open";
export type BriefFieldStyle =
  | "direct-imperative"
  | "cost-first"
  | "mechanism-first"
  | "question-then-answer"
  | "shortest-possible";
export type BriefQuizStemShape =
  | "cold-diagnosis"
  | "choose-next-move"
  | "predict-consequence"
  | "spot-the-violation"
  | "best-explanation-why"
  | "ordering-priority"
  | "transfer-new-domain"
  | "failure-postmortem";
export type BriefQuizFailureMode =
  | "wrong-target"
  | "wrong-timing"
  | "wrong-proof"
  | "wrong-scope"
  | "half-measure"
  | "right-move-wrong-trigger"
  | "over-correction"
  | "borrowed-authority";
export type BriefMemorableShape = "reversal" | "redefinition" | "cost-statement" | "pointed-question" | "imperative";
export type BriefLimitsPlacement = "early-aside" | "inside-a-failing-example" | "closing-paragraph";
export type BriefGroundingForm = "appositive" | "prior-sentence-setup" | "parenthetical-era-role";
export type BriefExampleLens =
  | "prop-tableau"
  | "dialogue-beat"
  | "before-after-ledger"
  | "postmortem"
  | "walkthrough"
  | "counterfactual"
  | "outsider-witness"
  | "numbers-detective";
export type BriefPracticeVerb =
  | "write"
  | "say"
  | "mark"
  | "count"
  | "ask"
  | "circle"
  | "schedule"
  | "read-aloud"
  | "cross-out"
  | "move";
export type BriefChallengeFrame =
  | "before-your-next-X"
  | "replace-one-Y"
  | "script-one-sentence"
  | "timebox-N-minutes"
  | "audit-one-artifact"
  | "teach-it-to-someone"
  | "pre-write-the-exact-line"
  | "attach-to-existing-routine";
export type BriefPracticeShape =
  | "single-imperative"
  | "if-then-trigger"
  | "two-step-sequence"
  | "observe-then-note"
  | "say-aloud-script"
  | "measure-one-number";

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
   *  hashed at the write site. v2 = the legacy key-bearing renderChapterReaderDoc;
   *  v3 (IMP-08) = the key-free renderChapterReaderDocPhase1 bytes. A doc-render
   *  drift (even one that leaves contentHash equal) invalidates the carry. */
  docHash?: string;
  /** Which docHash algorithm produced docHash. "v2" = sha256 over the trailing-
   *  newline-terminated LEGACY rendered doc; "v3" = over the phase-1 (key-free)
   *  doc (IMP-08). A mismatch (or absence) blocks reuse — bumping the live
   *  constant is the explicit carry-invalidation switch. */
  hashVersion?: "v2" | "v3";
  /** ISO timestamp the review was adjudicated. Audit only (never gates reuse). */
  reviewedAt?: string;
  // ── IMP-08 instrument-binding evidence (ADDITIVE, all OPTIONAL) ────────────
  /** Phase-1 renderer version the scored document was produced by. */
  phase1DocVersion?: string;
  /** Reader-rubric (task card) version the review was produced under. */
  rubricVersion?: string;
  /** The reviewer AgentRole's frozen execution-profile hash, resolved by the
   *  CONDUCTOR (plan instruction 10) — recorded evidence; the hash never
   *  appears in any reviewer-visible artifact. */
  executionProfileHash?: string;
  /** hashCanonical({role, files}) of the reviewer workspace the reader ran in
   *  — binds the review to the exact file set the reviewer could see. */
  workspaceManifestSha256?: string;
  /** IMP-08 phase-2 quiz-key adjudication evidence (ADVISORY in v1 — feeds no
   *  pass predicate; the blocking key channel stays keyCheck.matches===of).
   *  status "unavailable" records an explicit bounded-attempt failure — the
   *  review itself remains decided by the phase-1 instrument;
   *  "skipped-extra-read" marks a non-persisting tiebreak/second-opinion read
   *  (the adjudication for those chapter bytes rides the persisted primary). */
  quizAdjudication?: {
    status: "adjudicated" | "unavailable" | "skipped-no-quiz" | "skipped-extra-read";
    derivationSha256?: string;
    phase2DocSha256?: string;
    reviewerSessionId?: string;
    /** Per-question verdicts, verified against the conductor's own committed
     *  derivation + real key (validateQuizAdjudication). */
    items?: Array<{
      itemId: string;
      keyedAnswerIndex: number;
      derivedAnswerIndex: number;
      agreement: boolean;
      keyCorrect: "correct" | "ambiguous" | "wrong";
      rationale: string;
    }>;
    ambiguousCount?: number;
    keyWrongCount?: number;
    reason?: string;
  };
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
