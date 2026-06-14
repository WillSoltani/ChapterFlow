/**
 * THE PUBLISHABLE BAR — the shared rubric for "is this a finished, publishable
 * chapter?", the question the deterministic gates structurally cannot answer.
 *
 * One spec, two readers:
 *   - TODAY (no API): a Claude QC session scores a chapter against AXIS_RUBRIC
 *     by reading (see agent-prompts/QC-SESSION-PROMPT.md), and feeds the per-axis
 *     scores to `computeVerdict` here.
 *   - LATER (funded key): the automated judges (quizKeyJudge + siblings) produce
 *     the same AxisScore[] and call the same `computeVerdict`.
 * Because both paths reduce through this one function, the verdict is identical
 * and the two HARD RULES below can never be bypassed by either reader.
 *
 * The two-tier failure model is the core insight from the multi-book QC pass:
 *   CORRUPTION       — wrong key / word-salad / false fact / incoherent scene.
 *                      A GREEN gate AND a naive read both miss it. RED, always.
 *   GENERATED_DRAFT  — key-correct, prose accurate, but templated distractors /
 *                      recall cards / planning-note examples. Passes the gate AND
 *                      a naive read, scored ~61/100, still not publishable. YELLOW.
 *   PUBLISHABLE      — the 88-92 bar. GREEN.
 *
 * The bar is "a finished publishable chapter", NOT "not corrupt".
 */

export type FailureTier = "CORRUPTION" | "GENERATED_DRAFT" | "PUBLISHABLE";

export type AxisId =
  | "quiz_key_correctness"
  | "quiz_distractor_quality"
  | "card_learning_value"
  | "example_coherence"
  | "prose_coherence"
  | "memorable_line_quality"
  | "plan_actionability"
  | "factual_accuracy";

/** Weights sum to 100. Tuned so the dominant historical defects dominate. */
export const AXIS_WEIGHTS: Record<AxisId, number> = {
  quiz_key_correctness: 18,
  example_coherence: 16,
  prose_coherence: 14,
  quiz_distractor_quality: 14,
  card_learning_value: 12,
  plan_actionability: 12,
  factual_accuracy: 8,
  memorable_line_quality: 6,
};

/** Axes whose failure is CORRUPTION (a hard veto), vs draft-quality axes. */
export const CORRUPTION_AXES: ReadonlySet<AxisId> = new Set<AxisId>([
  "quiz_key_correctness",
  "example_coherence",
  "prose_coherence",
  "factual_accuracy",
]);

export type AxisHit = { unitId: string; quote: string; defect: string };
export type AxisScore = {
  axis: AxisId;
  /** 0..1 quality on this axis. */
  score: number;
  /** the worst tier this axis evidences (CORRUPTION only on a CORRUPTION_AXES axis with a hit). */
  tier: FailureTier;
  /** verbatim citations — REQUIRED to evidence a CORRUPTION hit (cite-or-it-didn't-happen). */
  hits: AxisHit[];
};

export type PublishableVerdict = {
  chapterId: string;
  overall: number; // 0..100, weighted
  tier: FailureTier; // min over axes (CORRUPTION < GENERATED_DRAFT < PUBLISHABLE)
  gate: "RED" | "YELLOW" | "GREEN";
  axes: AxisScore[];
  ran: boolean; // false => DID NOT RUN — never a pass
  note?: string;
};

export const PUBLISHABLE_FLOOR = 85; // overall ≥ this AND no axis < AXIS_FLOOR for GREEN
export const AXIS_FLOOR = 0.6; // any axis below this caps the book at YELLOW

function weightedOverall(axes: AxisScore[]): number {
  let num = 0, den = 0;
  for (const a of axes) {
    const w = AXIS_WEIGHTS[a.axis] ?? 0;
    num += w * Math.max(0, Math.min(1, a.score));
    den += w;
  }
  return den === 0 ? 0 : Math.round((num / den) * 100);
}

/**
 * Reduce per-axis scores to a verdict. Enforces the two HARD RULES:
 *  1. CORRUPTION is a veto — one cited corruption hit RED-gates the chapter even
 *     if the weighted overall is 90. The average can NEVER launder corruption.
 *  2. PUBLISHABLE ≠ not-corrupt — overall < 85 (or any axis < 0.6) is YELLOW
 *     even with zero corruption.
 */
export function computeVerdict(chapterId: string, axes: AxisScore[], ran = true): PublishableVerdict {
  if (!ran) {
    return { chapterId, overall: 0, tier: "CORRUPTION", gate: "RED", axes, ran: false, note: "DID NOT RUN — not a pass" };
  }
  const corruption = axes.some((a) => CORRUPTION_AXES.has(a.axis) && a.tier === "CORRUPTION" && a.hits.length > 0);
  const overall = weightedOverall(axes);
  if (corruption) {
    return { chapterId, overall, tier: "CORRUPTION", gate: "RED", axes, ran };
  }
  if (overall < PUBLISHABLE_FLOOR || axes.some((a) => a.score < AXIS_FLOOR)) {
    return { chapterId, overall, tier: "GENERATED_DRAFT", gate: "YELLOW", axes, ran };
  }
  return { chapterId, overall, tier: "PUBLISHABLE", gate: "GREEN", axes, ran };
}

/**
 * The per-axis detection prose. The SAME strings the Claude QC session reads
 * against and a future model judge is prompted with — so both score identically.
 * Each carries its false-positive guard (the allowances a clean book relies on).
 */
export const AXIS_RUBRIC: Record<AxisId, string> = {
  quiz_key_correctness:
    "Cover correctIndex. From the prompt + choices + source, derive the correct answer yourself, THEN reveal the key. If you confidently land on a different index, or the explanation argues for a choice other than the keyed one → CORRUPTION (wrong key). FP-guard: a misconception keyed correct IS correct when the stem asks for it ('What is the simplistic reading to avoid?').",
  quiz_distractor_quality:
    "Distractors must be realistic wrong answers a thoughtful reader could pick. DRAFT if a distractor is the correct sentence wearing a junk prefix ('Reverse/Flatten/Prefer X over'), a generated source-summary ('would be managed through'), the only 'clean' choice is the key (format-identifiable), or the answer is decided by a trailing container-noun. FP-guard: genuinely tempting near-misses are GOOD, not defects.",
  card_learning_value:
    "The front must be a question; the back must ANSWER it in the card's own words and test understanding, not source-recall. DRAFT if recall-only or front is a bare label. CORRUPTION if the back doesn't answer the front, is pasted verbatim from the breakdown, or is truncated mid-word.",
  example_coherence:
    "A concrete scene with a named human acting. CORRUPTION if a concept-label is the subject/object ('Cleo lifts a productive vulnerability folder'), a '<Name> studies <label>' skeleton, a fixed-timestamp concept-label HEADER repeated each chapter, or scaffold titles ('Source Moment N.1'). DRAFT if whatToDo is a proposition rather than an action, or if a source anchor appears as SET DRESSING rather than in the scene's logic — a case card pinned to a wall, a quote 'in the margin', a flyer about the source's anecdote ('On the plant wall, a case card reads Henry Ford, Model T'): anchor-as-prop reads as product placement and marks an ungrounded scene wearing a grounding costume. FP-guard: a timestamp INSIDE a coherent scene is FINE — only the label-HEADER + identical-fixed-time-every-chapter is the defect; an anchor a character genuinely reasons about or reacts to is GOOD grounding.",
  prose_coherence:
    "fastRead/deepRead/fullRead read as human prose that teaches. CORRUPTION if a clause repeats ~25× (templated loop), a '<Concept> means The <concept> is…' seam, ends mid-sentence, or fastRead just restates the thesis. DRAFT if a tier is wall-to-wall ABSTRACTION — chains of abstract nouns with no person, scene, or number for paragraphs ('scarcity culture shrinks courage by teaching lack first'); the plain-language bar (2026-06-11 direction): every abstract claim is followed within two sentences by something a reader can SEE, terms-of-art are explained in everyday words on first use, and a tier opens concrete, not with a thesis. FP-guard: a consistent pedagogical opener across chapters ('The mechanism is:') is a convention when the content differs and reads as prose; precise technical terms explained plainly once are GOOD, not abstraction.",
  memorable_line_quality:
    "Each memorable line is a portable aphorism. DRAFT if it is a 16-23-word explanation or an enumeration rather than a compact, complete claim.",
  plan_actionability:
    "ifThenPlans context = a situational trigger; plan = an imperative If-X-then-Y using the chapter's one named reader tool. DRAFT if context is a source/proper-noun label, or plan is a pasted breakdown sentence or editor language ('use <source> as the source check', 'revisit the hard edge').",
  factual_accuracy:
    "Named-framework enumerations are complete and correctly named (BRAVING = 7 items incl. 'Vault', not 6 with 'Vault' renamed 'confidentiality'). CORRUPTION on a wrong/incomplete named enumeration or a fabricated fact. Needs the source as ground truth; when absent, mark 'could not verify' (never silently pass).",
};

/** Pretty-print a verdict for the QC session / reports. */
export function formatVerdict(v: PublishableVerdict): string {
  const lines: string[] = [];
  const dims = v.axes.map((a) => `${a.axis.split("_").map((w) => w[0]).join("").toUpperCase()}=${a.score.toFixed(2)}`).join(" ");
  lines.push(`Publishable bar: ${v.gate} (${v.tier}) — ${v.overall}/100  [${dims}]`);
  if (!v.ran) lines.push("  ⚠️ DID NOT RUN — this is NOT a pass.");
  for (const a of v.axes) {
    for (const h of a.hits) lines.push(`  [${a.axis}] ${h.unitId}: ${h.defect} — "${h.quote.slice(0, 80)}"`);
  }
  if (v.gate === "YELLOW") lines.push("  → GENERATED_DRAFT: not corrupt, but not publishable. List the sub-0.6 axes and fix before promote.");
  if (v.gate === "RED") lines.push("  → CORRUPTION: do not ship. Redo the cited units.");
  return lines.join("\n");
}
