/**
 * criticD7Map — the committed map from every `src/critics/*` module to the D7
 * rubric-v2 signal it relates to, and the retain/retire verdict for the WP-205
 * floor consolidation.
 *
 * READ THIS WITH docs/v25/CRITIC_D7_MAP.md (the narrative version). This module is
 * the machine-readable source of truth the completeness + non-blocking tests assert
 * against (tests/critic-d7-map.test.ts).
 *
 * THE CENTRAL FINDING (why the consolidation retires zero blockers):
 *   - Every BLOCKING deterministic critic enforces a fail-closed STRUCTURAL /
 *     SAFETY invariant (artifact well-formedness, fabrication/provenance, apparatus
 *     leakage, mechanical corruption, quiz-key correctness) OR a CROSS-CHAPTER /
 *     CROSS-BOOK distinctness invariant. The D7 close-read ship gate (WP-401) is a
 *     SINGLE-CHAPTER GRADED judgment — it neither measures those deterministic
 *     invariants nor can it see siblings — so NONE of these blockers is subsumed by
 *     a D7-owned signal. They STAY in the fail-closed floor. Retiring any of them
 *     would drop a blocker (forbidden by the WP stop condition).
 *   - Every ADVISORY critic (minor, or shadow-major NOT in ENFORCED_MAJOR) is a
 *     deterministic proxy for a GRADED learning dimension the D7 rubric now owns
 *     (example craft, prose/voice, quiz depth, factual grading). D7 owns the
 *     judgment; the critic stays ADVISORY (non-blocking) and surfaces repair-
 *     routable QC debt. It was already non-blocking, so marking it "subsumed by
 *     D7" changes no pass/fail outcome.
 *
 * Net: the floor is verdict-equivalent to the pre-consolidation blocking stack.
 * The map documents the reasoning; the tests enforce it.
 */

import {
  RUBRIC_DOMAINS,
  RUBRIC_BASE_GATE_KEYS,
  RUBRIC_LAYER_INDEPENDENCE_GATE_KEY,
} from "../bakeoff/migration/rubricAuditInstrument.js";

/** The valid D7 target keys a map entry may cite: the 8 graded domains, the 6
 *  base gates, the layer-independence gate, and two floor-only sentinels for
 *  signals D7's single-chapter graded scope structurally cannot own. */
export const D7_GRADED_DOMAIN_KEYS = RUBRIC_DOMAINS.map((d) => d.key);
export const D7_BASE_GATE_KEYS = [...RUBRIC_BASE_GATE_KEYS];
export const D7_LAYER_INDEPENDENCE_KEY = RUBRIC_LAYER_INDEPENDENCE_GATE_KEY;

/** Floor-only sentinels — a signal NO D7 dimension owns because D7 is scoped to a
 *  single chapter's graded learning design. These are the "archive-not-delete,
 *  keep as floor" class the WP calls out (cross-book signature, intra-book
 *  similarity, round-state attestation, source-verification policy). */
export const D7_UNCOVERED_SENTINELS = [
  "floor-only:cross-chapter-distinctness",
  "floor-only:cross-book-distinctness",
  "floor-only:qc-round-state",
  "floor-only:source-verification-policy",
  "floor-only:infrastructure",
] as const;

export type D7Target =
  | (typeof D7_GRADED_DOMAIN_KEYS)[number]
  | (typeof D7_BASE_GATE_KEYS)[number]
  | typeof D7_LAYER_INDEPENDENCE_KEY
  | (typeof D7_UNCOVERED_SENTINELS)[number];

/**
 * Role of a critic module in the consolidated floor:
 *   - blocking-floor      : per-chapter module with ≥1 fail-closed id; STAYS blocking.
 *   - book-floor          : book-level module with ≥1 fail-closed id; STAYS blocking.
 *   - advisory-subsumed   : only advisory ids; subsumed by a D7 graded domain; NON-blocking.
 *   - cross-book-floor    : cross-book distinctness; D7-uncovered; retained (non-ship-blocking audit).
 *   - source-policy       : WS-4 source-reality / source diagnostics; policy gate outside D7 grading.
 *   - qc-state            : QC round-state gate (attestation / key-judge), orthogonal to D7 content grading.
 *   - composition         : a floor composition/aggregation module (not a leaf critic).
 *   - helper              : pure utility, emits no gate findings.
 *   - repair              : write-side repair generator, not a gate.
 *   - cli-reporting       : legacy per-unit reporting orchestrator, not a ship-path blocker.
 *   - d7-semantic         : the D7 / model-judgment layer itself (not a deterministic floor critic).
 */
export type CriticRole =
  | "blocking-floor"
  | "book-floor"
  | "advisory-subsumed"
  | "cross-book-floor"
  | "source-policy"
  | "qc-state"
  | "composition"
  | "helper"
  | "repair"
  | "cli-reporting"
  | "d7-semantic";

export type CriticD7Entry = {
  /** Representative catalog ids (blocking ids first). Empty for helpers/composition. */
  ids: string[];
  role: CriticRole;
  /** The D7 signal this critic relates to (a graded domain it approximates, a base
   *  gate it deterministically floors, or a floor-only sentinel D7 cannot own). */
  d7: D7Target[];
  /** blocking ⇒ retained in the fail-closed floor; advisory ⇒ non-blocking (surfaces
   *  QC debt); none ⇒ not a gate. */
  blocking: "blocking" | "advisory" | "none";
  /** retain-floor | subsumed-advisory | infra | retire (retire is never used here —
   *  see the module header: no blocker is D7-subsumed, and advisory critics are kept
   *  as repair-routable debt rather than deleted, to avoid perturbing finding output). */
  verdict: "retain-floor" | "subsumed-advisory" | "infra";
  rationale: string;
};

/**
 * The map. Keyed by module basename (no extension) under `src/critics/`.
 * tests/critic-d7-map.test.ts asserts this covers every non-test top-level module.
 */
export const CRITIC_D7_MAP: Record<string, CriticD7Entry> = {
  // ── Composition / aggregation ───────────────────────────────────────────────
  finalGate: { ids: [], role: "composition", d7: ["floor-only:infrastructure"], blocking: "none", verdict: "infra",
    rationale: "Per-chapter ship-gate composition (runShipGate) — invokes the leaf critics below; the floor's chapterFloorGate wraps it." },
  bookGate: { ids: ["F1", "F3"], role: "composition", d7: ["floor-only:cross-chapter-distinctness", "floor-only:infrastructure"], blocking: "none", verdict: "infra",
    rationale: "Book-level gate composition (runBookGate) — aggregates the book-floor critics; F1 within-book name duplication is cross-chapter, D7-uncovered." },
  chapterGateComposite: { ids: [], role: "composition", d7: ["floor-only:infrastructure"], blocking: "none", verdict: "infra",
    rationale: "CAS-commit composition (ship gate + intra-book + identity + advisories + circuit breaker) — now delegates to deterministicFloor." },
  deterministicFloor: { ids: [], role: "composition", d7: ["floor-only:infrastructure"], blocking: "none", verdict: "infra",
    rationale: "WP-205 canonical consolidated floor pass — the single composition point + content-addressed dedup ledger." },
  runAllCritics: { ids: [], role: "cli-reporting", d7: ["floor-only:infrastructure"], blocking: "none", verdict: "infra",
    rationale: "Legacy per-unit BookPackage critic orchestrator used only by the CLI `critics`/`check` reporting verbs — NOT a ship-path blocking gate." },
  majorPolicy: { ids: [], role: "composition", d7: ["floor-only:infrastructure"], blocking: "none", verdict: "infra",
    rationale: "Advisory-vs-blocking classifier for MAJOR findings (ADVISORY_MAJOR_PREFIXES). Decides which majors hard-gate; not a leaf critic." },

  // ── Per-chapter BLOCKING floor (deterministic safety / artifact integrity) ──
  schema: { ids: ["A1", "A2", "A3", "A5", "A4"], role: "blocking-floor", d7: ["chapter_artifact_completeness"], blocking: "blocking", verdict: "retain-floor",
    rationale: "Quiz enum/choice-count/correct-index/answer-position schema validity. Deterministic well-formedness — D7 grades design, never re-derives the schema. Floor." },
  integrity: { ids: ["A12", "A13", "A17"], role: "blocking-floor", d7: ["chapter_artifact_completeness"], blocking: "blocking", verdict: "retain-floor",
    rationale: "A12 capitalization (blocker) + A13 sentence sanity / A17 tryThisNow complexity (advisory majors). A12 is mechanical artifact integrity. Floor." },
  register: { ids: ["B1", "B2", "B5", "B4"], role: "blocking-floor", d7: ["chapter_artifact_completeness", "audience_fit"], blocking: "blocking", verdict: "retain-floor",
    rationale: "Meta-reference / chapter-number literal / em-dash (blockers) + banned phrases (B4 major). Register-safety tells; deterministic, not graded. Floor." },
  narrative: { ids: ["C1", "C7", "C8", "C9", "C10", "C22", "C2", "C3", "C23", "C24", "C25", "C27"], role: "blocking-floor", d7: ["chapter_artifact_completeness", "mental_model_coherence", "engagement_momentum"], blocking: "blocking", verdict: "retain-floor",
    rationale: "Blockers C1/C7(banned name)/C8(template)/C9(alphabet cycling)/C10(verb shell)/C22(location stamping) are shape-based fabrication/template tells → floor. C2/C3/C23/C24/C25/C27 example-craft advisories → D7 mental_model/engagement own the grade (stay shadow, non-blocking)." },
  supportSectionAudit: { ids: ["C11", "C12", "C13", "C14", "C15"], role: "blocking-floor", d7: ["chapter_artifact_completeness"], blocking: "blocking", verdict: "retain-floor",
    rationale: "Identical review-card backs, quiz template prefixes, title-keyword injection, trailing fragments (blockers). Deterministic support-section corruption. Floor." },
  scaffoldLeak: { ids: ["SL1.format_tag_leak", "SL6.source_numbering_leak", "SL2.domain_label_leak", "SL3.spectator_prop", "SL4.citation_prop", "SL5.publication_detail"], role: "blocking-floor", d7: ["chapter_artifact_completeness", "epistemic_instructional_safety"], blocking: "blocking", verdict: "retain-floor",
    rationale: "Authoring scaffolding surfacing as reader prose. SL1/SL6 are zero-FP scaffold tells (blockers). Apparatus integrity — D7 does not deterministically detect leaked scaffolding. Floor." },
  antiSalting: { ids: ["AS1.identifier_token_injection", "AS2.jammed_proper_nouns", "AS3.doubled_period", "AS4.quiz_prompt_template_substitution", "AS13.within_chapter_quiz_template"], role: "blocking-floor", d7: ["chapter_artifact_completeness"], blocking: "blocking", verdict: "retain-floor",
    rationale: "Anti-critic-evasion salting tells (identifier tokens, jammed nouns, doubled periods) — all blockers. Mechanical corruption the graded reader would not systematically catch. Floor." },
  mechanicalSeam: { ids: ["SEAM1.adjacent_duplicate_word", "SEAM2.verbatim_repetition"], role: "blocking-floor", d7: ["chapter_artifact_completeness"], blocking: "blocking", verdict: "retain-floor",
    rationale: "Stuttered word / verbatim triple-repeat — ENFORCED_MAJOR (blocks the ship gate). Mechanical corruption seams; zero-FP shape tells. Floor." },
  evidenceIntegrity: { ids: ["EI1.testimonial_as_evidence", "EI2.quiz_key_testimonial"], role: "blocking-floor", d7: ["epistemic_instructional_safety", "external_accuracy"], blocking: "blocking", verdict: "retain-floor",
    rationale: "A testimonial dressed as research, or a quiz key grounded in one (blockers). Deterministic fabrication-grammar floor beneath D7's graded factual accuracy. Floor." },
  evidenceWitness: { ids: ["EW1.invented_witness"], role: "blocking-floor", d7: ["epistemic_instructional_safety", "external_accuracy"], blocking: "blocking", verdict: "retain-floor",
    rationale: "Invented character cast as a research subject (the 'Piper move') — ENFORCED_MAJOR (blocks). Zero-FP fabrication tell; D7 grades but this is the deterministic block. Floor." },
  formatV25: { ids: ["F25.quiz_feedback", "F25.duplicate_example", "F25.loop_closure"], role: "blocking-floor", d7: ["chapter_artifact_completeness", "learning_architecture"], blocking: "blocking", verdict: "retain-floor",
    rationale: "Chapter Format v25 (D8) — the schema-crisp quiz-feedback block blocks (opt-in); F25.loop_closure/duplicate_example are advisory (semantic proxies stay shadow). Floor." },
  experiencePlan: { ids: ["EXP1.structure", "RDRP1.structure", "EXP3.normalizing_cliche", "EXP2.length", "RDRP2.label_length", "RDRP3.label_hygiene"], role: "blocking-floor", d7: ["chapter_artifact_completeness", "transfer_action_judgment"], blocking: "blocking", verdict: "retain-floor",
    rationale: "Behavior-change layer structural validity (EXP1/RDRP1 blockers, present-only). Deterministic cardinality/index validity. Floor." },
  quizQuality: { ids: ["BP16.quiz_answer_length_blocker", "BP19.quiz_banned_tail_phrase", "BP20.quiz_ngram_template_repeat", "BP21.quiz_cross_chapter_duplicate", "BP27.quiz_answer_label_leak", "schema.quiz_duplicate_choice", "schema.quiz_unexpected_field", "BP15", "BP17", "BP25", "BP28", "BP29", "BP30", "BP31", "BP32", "BP33"], role: "blocking-floor", d7: ["chapter_artifact_completeness", "retention_retrieval"], blocking: "blocking", verdict: "retain-floor",
    rationale: "Quiz-shape tells. Blockers (answer-length/banned-tail/ngram-template/cross-chapter-dup/label-leak/duplicate-choice/unexpected-field) are structural quiz integrity → floor. BP25/28-33 advisory tells are subsumed by D7 retention_retrieval grade (stay shadow)." },
  intraBookFieldSimilarity: { ids: ["BP24.cross_tier_breakdown_verbatim", "B15.cross_tier_paraphrase"], role: "blocking-floor", d7: ["chapter_artifact_completeness", "audience_fit"], blocking: "blocking", verdict: "retain-floor",
    rationale: "BP24 large-block cross-tier verbatim copy-paste (blocker) — deterministic breakdown corruption; B15 paraphrase-restate advisory (subsumed by D7 audience_fit/prose grade). Floor." },
  sourceGrounding: { ids: ["SC11.1.missing_provenance", "SC11.2.anchor_specific_not_present", "SC11.3.placeholder_anchor", "SC11.4.wrong_chapter_anchor", "SC11.5.unknown_anchor", "SC11.6.unsupported_anchor", "SC9.example_not_source_grounded", "SC11.0.no_source_run"], role: "blocking-floor", d7: ["epistemic_instructional_safety", "external_accuracy"], blocking: "blocking", verdict: "retain-floor",
    rationale: "Declared-provenance anchor validity (SC11.1-.6 blockers, v2-gated) — deterministic provenance integrity. SC9/SC11.0 advisory (FP-prone; D7 grades grounding). Floor." },

  // ── Per-chapter ADVISORY floor (subsumed by a D7 graded domain) ─────────────
  sceneConcreteness: { ids: ["C26.scene_abstraction"], role: "advisory-subsumed", d7: ["mental_model_coherence", "engagement_momentum"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "Example staged on an abstract system surface with no human grounding. D7 grades example vividness (engagement_momentum.narrative_example_vividness). Advisory." },
  outcomeVariety: { ids: ["C28.uniform_success"], role: "advisory-subsumed", d7: ["transfer_action_judgment", "engagement_momentum"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "Every example resolves in clean instant success (survivorship gloss). D7 grades outcome realism / boundaries_adaptation_tradeoffs. Advisory." },
  exampleCraft: { ids: ["C29.example_thinness"], role: "advisory-subsumed", d7: ["mental_model_coherence", "learning_architecture"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "Slot-filler example with no anchor and no cause→effect. D7 grades worked_examples_contrasts. Advisory." },
  exampleRegister: { ids: ["C31.example_evaluator_register"], role: "advisory-subsumed", d7: ["audience_fit", "engagement_momentum"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "Analyst-card evaluator-question register instead of a narrated scene. D7 grades voice/vividness. Advisory." },
  intraChapterExampleLesson: { ids: ["C30.example_lesson_repetition"], role: "advisory-subsumed", d7: ["learning_architecture", "mental_model_coherence"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "≥2 examples restate one lesson at high overlap. D7 grades worked_examples_contrasts (each example a different facet). Advisory." },
  metaCaseProtagonist: { ids: ["C32.meta_case_protagonist"], role: "advisory-subsumed", d7: ["engagement_momentum", "audience_fit"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "A pipeline artifact narrated as the acting subject (offstage machinery). D7 grades example vividness / signal-noise. Advisory." },
  beatVocabularyEcho: { ids: ["C33.beat_vocabulary_echo"], role: "advisory-subsumed", d7: ["audience_fit", "engagement_momentum"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "briefRotation beat labels ('return point', 'early signal') surfacing as house-voice prose. D7 grades voice / signal_noise_framework_load. Advisory." },
  citationDateDoorway: { ids: ["C34.citation_date_doorway"], role: "advisory-subsumed", d7: ["engagement_momentum"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "fastRead opening on a date/citation with no person acting (provenance-as-opening). D7 grades curiosity_momentum / opening vividness. Advisory." },
  lineageKeyQuiz: { ids: ["C35.lineage_key_quiz"], role: "advisory-subsumed", d7: ["retention_retrieval", "learning_architecture"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "A quiz key rewarding naming the source lineage over applying the idea. D7 grades quiz_retrieval_depth. Advisory." },
  apparatusLeakage: { ids: ["C36.apparatus_page_citation", "C36.apparatus_guide_structure", "C36.apparatus_machinery_term", "C36.apparatus_spec_narration"], role: "advisory-subsumed", d7: ["audience_fit", "epistemic_instructional_safety"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "Source-guide apparatus (page citations, guide-structure narration, spec sentences) reaching the reader. Advisory (registerAdvisories repair routing); D7 grades signal_noise. Kept as floor debt because leaked apparatus is safety-adjacent." },
  groundedNumbers: { ids: ["GN1.ungrounded_number"], role: "advisory-subsumed", d7: ["epistemic_integrity", "external_accuracy"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "An ungrounded statistical figure absent from the source sidecar. SHADOW major (high-FP: writers legitimately derive/round). D7 grades claim_support_fit. Advisory." },
  namedEnumeration: { ids: ["NE1.named_enumeration_mismatch"], role: "advisory-subsumed", d7: ["epistemic_integrity"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "A named fixed-size set enumerated with the wrong count. SHADOW major (one TP so far). D7 grades internal_consistency_qa. Advisory." },
  readingLevel: { ids: ["E1"], role: "advisory-subsumed", d7: ["audience_fit"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "Tier reading-level target. Advisory major (fires on every reference book — the SC9-reversal trap). D7 grades language_clarity. Advisory." },
  plainLanguage: { ids: ["E7.long_sentence", "E7.dense_headline", "E7.complex_word"], role: "advisory-subsumed", d7: ["audience_fit"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "Plain-language across every reader field (run-ons, dense headlines, jargon). Advisory. D7 grades language_clarity. Advisory." },
  prose: { ids: ["B7", "B8", "E3", "E4", "E8.monotone_cadence"], role: "advisory-subsumed", d7: ["audience_fit", "engagement_momentum"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "Prose variety/cadence/opener concreteness/closing landings. All advisory (style-frequency refuted as gates). D7 grades clarity/momentum. Advisory." },
  pedagogy: { ids: ["D1", "D2", "D3.takeaway_distillable", "D4.recycled_scenario", "D6.key_references_chapter_entity"], role: "advisory-subsumed", d7: ["learning_architecture", "retention_retrieval"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "Card-tests-retrieval / quiz-tests-application / takeaway distillability / quiz transfer-novelty. D1 is a major but advisory-classified; the rest minor/shadow. D7 grades active_processing / quiz_retrieval_depth. Advisory." },
  bookRepetition: { ids: ["BP34.aphorism_repetition", "BP34.tail_clone"], role: "advisory-subsumed", d7: ["engagement_momentum", "audience_fit"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "Within-book aphorism / distinctive-tail repetition across ≥3 chapters. Advisory. D7 (single-chapter) partially; the cross-chapter half is house-voice texture. Advisory." },
  contentMachinery: { ids: ["machinery"], role: "advisory-subsumed", d7: ["audience_fit", "epistemic_instructional_safety"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "Machinery-vocabulary detection feeding book-gate advisories. D7 grades signal_noise; leaked machinery is safety-adjacent debt. Advisory." },

  // ── Book-level BLOCKING / structural floor ──────────────────────────────────
  quizCorrectness: { ids: ["quiz_key_correctness"], role: "book-floor", d7: ["chapter_artifact_completeness", "retention_retrieval"], blocking: "blocking", verdict: "retain-floor",
    rationale: "Book-level quiz-key correctness (deterministic answer-key validity). D7 grades quiz depth, never re-derives the key. Floor." },
  architectureMonoculture: { ids: ["ARCH0", "F-06"], role: "book-floor", d7: ["floor-only:cross-chapter-distinctness"], blocking: "blocking", verdict: "retain-floor",
    rationale: "Severe cross-chapter architecture monoculture becomes a blocker under enforce mode (new-authoring). Cross-chapter — D7 single-chapter cannot see it. Floor." },
  structuralSamenessMode: { ids: ["structural_sameness"], role: "book-floor", d7: ["floor-only:cross-chapter-distinctness"], blocking: "blocking", verdict: "retain-floor",
    rationale: "Structural-sameness enforcement mode resolver for the ARCH0 aggregate. Cross-chapter distinctness. Floor." },
  bookPatternAudit: { ids: ["book_pattern"], role: "book-floor", d7: ["floor-only:cross-chapter-distinctness"], blocking: "advisory", verdict: "retain-floor",
    rationale: "Cross-chapter repeated-pattern audit feeding book-gate. Cross-chapter — D7-uncovered. Retained as floor (advisory findings)." },
  intraBook: { ids: ["AS5.chapter_quiz_prompt_matches_prior", "AS6.chapter_quiz_distractor_matches_prior", "AS7.chapter_card_matches_prior", "AS8.chapter_plan_matches_prior", "AS9.chapter_example_matches_prior", "AS10.chapter_field_ngram_matches_prior", "AS11.chapter_breakdown_paragraph_verbatim_prior", "AS12.chapter_quiz_position_matches_prior"], role: "blocking-floor", d7: ["floor-only:cross-chapter-distinctness"], blocking: "blocking", verdict: "retain-floor",
    rationale: "AS5-AS12 cross-chapter similarity against prior siblings (all blockers). D7 is single-chapter and STRUCTURALLY cannot see siblings — this is the canonical D7-uncovered blocker the WP says to keep. Floor." },
  intraBookQuizSimilarity: { ids: ["AS5.chapter_quiz_prompt_matches_prior", "AS6.chapter_quiz_distractor_matches_prior", "AS12.chapter_quiz_position_matches_prior"], role: "blocking-floor", d7: ["floor-only:cross-chapter-distinctness"], blocking: "blocking", verdict: "retain-floor",
    rationale: "The cross-chapter quiz-similarity sub-detector that realizes intraBook's AS5/AS6/AS12 quiz blockers. Cross-chapter — D7-uncovered. Floor." },

  // ── Cross-book distinctness (D7-uncovered; retained, non-ship-blocking audit) ─
  catalogAudit: { ids: ["catalog_signature"], role: "cross-book-floor", d7: ["floor-only:cross-book-distinctness"], blocking: "none", verdict: "retain-floor",
    rationale: "Cross-book name/signature reuse across the catalog. Entirely outside D7's single-chapter scope. Retained as a catalog audit (not a per-book ship blocker)." },
  crossBookSignatureAudit: { ids: ["cross_book_signature"], role: "cross-book-floor", d7: ["floor-only:cross-book-distinctness"], blocking: "none", verdict: "retain-floor",
    rationale: "Cross-book house-voice signature audit. D7-uncovered (cross-book). Retained as an authoring-guardrail audit." },
  cloneDetection: { ids: ["clone"], role: "cross-book-floor", d7: ["floor-only:cross-book-distinctness"], blocking: "none", verdict: "retain-floor",
    rationale: "Cross-book clone detection. D7-uncovered. Retained." },

  // ── Source-policy / round-state gates (outside D7 content grading) ───────────
  sourceRealness: { ids: ["source_reality"], role: "source-policy", d7: ["floor-only:source-verification-policy", "external_accuracy"], blocking: "blocking", verdict: "retain-floor",
    rationale: "WS-4 source-REALITY policy (a PRESENT-but-bad VERIFIED record always blocks). Verification-provenance policy, not graded content. Floor." },
  sourceCoherence: { ids: ["source_coherence"], role: "source-policy", d7: ["epistemic_integrity"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "Source-coherence diagnostic (research-side). D7 grades claim_support_fit. Advisory." },
  sourceRegister: { ids: ["source_register"], role: "source-policy", d7: ["epistemic_integrity", "audience_fit"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "Source-register diagnostic feeding registerAdvisories / integrity review. Advisory. D7 grades the reader-facing result. Advisory." },
  sourceVerify: { ids: ["source_verify"], role: "source-policy", d7: ["floor-only:source-verification-policy"], blocking: "none", verdict: "infra",
    rationale: "Source-verification workbench primitives used by the WS-4 manifest/verify tooling. Policy infrastructure, not a content critic." },
  authoringContract: { ids: ["AC"], role: "qc-state", d7: ["chapter_artifact_completeness", "learning_architecture"], blocking: "advisory", verdict: "retain-floor",
    rationale: "author-check contract findings (advisory/shadow, surfaced at CAS-commit + QC deterministic battery). Deterministic write-contract compliance; QC uses it as an author-check gate. Retained (advisory)." },
  qcAttestation: { ids: ["qc_attestation"], role: "qc-state", d7: ["floor-only:qc-round-state"], blocking: "blocking", verdict: "retain-floor",
    rationale: "The no-API semantic reviewer's PUBLISHABLE attestation freshness gate. Round-state (was the chapter reviewed at these bytes) — orthogonal to D7's own content grade. Floor (publish blocker)." },
  quizKeyGate: { ids: ["key_judge"], role: "qc-state", d7: ["retention_retrieval", "external_accuracy"], blocking: "advisory", verdict: "retain-floor",
    rationale: "Quiz answer-key judge (advisory at gate; blocks at promote/publish in REQUIRE mode). Deterministic + semantic key adjudication; kept as its own promote/publish lane. Retained." },
  quizKeyEvidence: { ids: ["key_evidence"], role: "qc-state", d7: ["external_accuracy"], blocking: "advisory", verdict: "retain-floor",
    rationale: "Quiz-key evidence anchoring ledger (promote-side). Deterministic provenance for the key. Retained." },
  misattribution: { ids: ["misattribution"], role: "advisory-subsumed", d7: ["epistemic_integrity", "external_accuracy"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "Misattribution detection (quote/claim attributed to the wrong source). Diagnostic; no ship-path importer. D7 grades claim_support_fit / external_accuracy. Advisory." },
  readerBudgets: { ids: ["reader_budget"], role: "advisory-subsumed", d7: ["audience_fit", "learning_architecture"], blocking: "advisory", verdict: "subsumed-advisory",
    rationale: "Reader time/word-budget structural checks (author-review side). D7 grades signal_noise_framework_load / sequencing. Advisory." },

  // ── Helpers / write-side (emit no gate findings) ────────────────────────────
  shared: { ids: [], role: "helper", d7: ["floor-only:infrastructure"], blocking: "none", verdict: "infra", rationale: "Shared critic primitives (finding(), iterateUnits, tones)." },
  textUtils: { ids: [], role: "helper", d7: ["floor-only:infrastructure"], blocking: "none", verdict: "infra", rationale: "Text normalization/tokenization utilities." },
  machineryPhrases: { ids: [], role: "helper", d7: ["floor-only:infrastructure"], blocking: "none", verdict: "infra", rationale: "Machinery-phrase lexicon shared by beatVocabularyEcho/contentMachinery." },
  leadAliases: { ids: [], role: "helper", d7: ["floor-only:infrastructure"], blocking: "none", verdict: "infra", rationale: "Protagonist-alias resolution shared by identity/name checks." },
  registerAdvisories: { ids: [], role: "helper", d7: ["floor-only:infrastructure"], blocking: "none", verdict: "infra", rationale: "Advisory repair-routing layer for the C31–C36 register advisories." },
  structuralSamenessSnapshot: { ids: [], role: "helper", d7: ["floor-only:infrastructure"], blocking: "none", verdict: "infra", rationale: "Snapshot serialization helper for the structural-sameness aggregate." },
  validatorShadow: { ids: [], role: "helper", d7: ["floor-only:infrastructure"], blocking: "none", verdict: "infra", rationale: "Shadow validator diagnostic (compares alias resolutions); no ship gate." },
  bookSamenessRepair: { ids: [], role: "repair", d7: ["floor-only:infrastructure"], blocking: "none", verdict: "infra", rationale: "Write-side book-sameness repair generator (not a gate)." },
  contentDeviceRepair: { ids: [], role: "repair", d7: ["floor-only:infrastructure"], blocking: "none", verdict: "infra", rationale: "Write-side content-device repair generator (not a gate)." },

  // ── The D7 / semantic layer itself (not a deterministic floor critic) ───────
  d7ShipGate: { ids: ["d7-ship-gate"], role: "d7-semantic", d7: ["floor-only:infrastructure"], blocking: "none", verdict: "infra",
    rationale: "The D7 rubric-audit ship gate (WP-401) — the GRADED learning judgment that runs AFTER the floor. Owns the 8 domains + base gates; not a deterministic floor critic." },
};
