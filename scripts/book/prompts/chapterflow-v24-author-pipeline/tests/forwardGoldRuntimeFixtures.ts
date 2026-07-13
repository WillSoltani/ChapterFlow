/** Complete schema-valid Rubric v2 records for staged production-broker tests. */

import { FORWARD_GOLD_RUBRIC_CONFIG, type ForwardGoldExpectedChapterIdentityV1 } from "../src/orchestrator/forwardGoldEvaluatorInstrument.js";

function evidence(chapter: ForwardGoldExpectedChapterIdentityV1) {
  return {
    package_path: chapter.packagePath,
    chapter: chapter.chapterId,
    section: "fullRead",
    item_id: null,
    paraphrase: `Specific evidence from ${chapter.chapterId}.`,
  };
}

function gate(status: string, chapter: ForwardGoldExpectedChapterIdentityV1) {
  return {
    status,
    rationale: `Gate is ${status} based on the complete retained book.`,
    evidence: status === "pass" ? [evidence(chapter)] : [],
  };
}

function domainRecord(
  config: typeof FORWARD_GOLD_RUBRIC_CONFIG.domains[number],
  rating: number,
  chapters: ForwardGoldExpectedChapterIdentityV1[],
) {
  return {
    weight: config.weight,
    subcriteria: Object.fromEntries(config.subcriteria.map((name) => [name, {
      rating,
      rationale: `${name} is grounded in specific full-book evidence.`,
      strength_evidence: [evidence(chapters[0])],
      limitation_evidence: [evidence(chapters[1])],
    }])),
    whole_book_pattern: `${config.id} recurs as a specific whole-book pattern.`,
    domain_score: rating,
    weighted_points: (rating / 4) * config.weight,
  };
}

export function makeForwardGoldEvaluatorOutput(args: {
  role: "primary" | "verification" | "adjudicated";
  expectedChapters: ForwardGoldExpectedChapterIdentityV1[];
  sourceHash: string;
  dispatchReceiptSha256?: string;
  rating?: number;
}) {
  const rating = args.rating ?? 3;
  const chapters = args.expectedChapters;
  const domains = Object.fromEntries(FORWARD_GOLD_RUBRIC_CONFIG.domains.map((config) => [
    config.id,
    domainRecord(config, rating, chapters),
  ]));
  const overall = FORWARD_GOLD_RUBRIC_CONFIG.domains.reduce(
    (sum, config) => sum + ((rating / 4) * config.weight),
    0,
  );
  return {
    schema_version: "2.0.0",
    run_id: "imp22-gold-run",
    job_id: `imp22-gold-${args.role}-job`,
    rater_role: args.role,
    source_hash: args.sourceHash,
    ...(args.role === "adjudicated" ? {} : { worker_dispatch_receipt_sha256: args.dispatchReceiptSha256 }),
    book: {
      book_id: "gold-book",
      slug: "gold-book",
      title: "Gold Book",
      subtitle: null,
      package_path: "book/gold-book.json",
      package_format: "ChapterV21",
      nonfiction_type: "general nonfiction",
      declared_or_inferred_audience: "interested non-expert adult",
      assumed_prior_knowledge: "none",
      declared_or_inferred_purpose: "build trustworthy understanding",
      intended_outcomes: ["understanding"],
      contexts_and_exclusions: ["no measured outcomes claimed"],
      chapter_count_expected: chapters.length,
      chapter_count_read_full: chapters.length,
      chapter_count_partial: 0,
      chapter_count_inaccessible: 0,
      all_accessible_chapters_read: true,
      word_count_estimate: 10_000,
      component_inventory: {
        examples: chapters.length,
        quiz_questions: chapters.length,
        review_cards: chapters.length,
        implementation_items: chapters.length,
        exercises: chapters.length,
        memorable_lines: chapters.length,
        other: {},
      },
    },
    technical_findings: [],
    gates: {
      technical_completeness: gate("pass", chapters[0]),
      epistemic_instructional_safety: gate("pass", chapters[0]),
      ethics_reader_autonomy: gate("pass", chapters[0]),
      purpose_audience_declaration: gate("pass", chapters[0]),
      external_accuracy: gate("not_assessed", chapters[0]),
    },
    chapter_evidence: chapters.map((chapter) => ({
      chapter_index: chapter.chapterIndex,
      chapter_id: chapter.chapterId,
      title: chapter.title,
      read_status: "full",
      central_ideas: [`Central idea ${chapter.chapterIndex}`],
      mental_model_contribution: "Builds the cumulative model.",
      engagement_and_pacing: "Maintains aligned momentum.",
      learning_support: "Supports active processing.",
      retention_support: "Uses meaningful retrieval.",
      transfer_support: "Supports contextual application.",
      trust_qa_safety_issues: [],
      evidence: [evidence(chapter)],
    })),
    domains,
    overall_score: overall,
    classification: "Valuable but materially uneven; targeted redesign needed",
    certification_status: "pass",
    analysis: {
      overall_reader_experience: "A coherent full-book learning experience.",
      strongest_qualities: ["Clear cumulative model"],
      weakest_qualities: ["Some examples could vary more"],
      engagement_curve: [{ chapter_range: `1-${chapters.length}`, direction: "steady", explanation: "Momentum remains stable." }],
      comprehension_and_retention_support: "Retrieval and explanation support comprehension.",
      practical_use_and_judgment: "Applications include boundaries and adaptation.",
      best_fit_reader: "Interested non-expert adults.",
      readers_who_may_struggle: "Readers seeking specialist depth.",
      highest_impact_improvements: ["Vary examples", "Deepen contrasts", "Add cumulative retrieval"],
      final_verdict: args.role === "verification"
        ? "The independent verification read reaches the same score with separately worded judgment."
        : "The book provides a useful but improvable learning design.",
    },
    qa: {
      all_36_subcriteria_present: true,
      evidence_minimums_pass: true,
      calculation_check_pass: true,
      semantic_quiz_issues: [],
      formulaic_pattern_notes: [],
      unsupported_outcome_claims_found: false,
      self_validation_notes: ["Arithmetic and evidence checked."],
    },
    ...(args.role === "adjudicated" ? {
      rater_agreement: {
        mean_absolute_subcriterion_difference: 0,
        maximum_subcriterion_difference: 0,
        overall_score_difference: 0,
        gate_conflicts: [],
        disagreements: [],
      },
      confidence: {
        level: "high",
        rationale: "Complete inventory and reconciled evidence.",
        chapter_completeness_ratio: 1,
        package_ambiguity: "none",
        unresolved_issues: [],
      },
      calibration_changes: [],
    } : {}),
  };
}
