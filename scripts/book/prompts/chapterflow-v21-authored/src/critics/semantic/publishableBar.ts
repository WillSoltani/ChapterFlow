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
  | "factual_accuracy"
  | "behavioral_naturalness";

/**
 * Weights sum to EXACTLY 100 (HARD INVARIANT — PUBLISHABLE_FLOOR=85 and
 * computeVerdict assume a 0–100 scale, so a drifted sum silently breaks the
 * floor). Tuned so the dominant historical defects dominate. behavioral_naturalness
 * (Plan A) is a modest, NON-corruption quality axis carved out of the other eight
 * by a proportional ~7% shrink (relative order preserved): 18→17, 16→15, 14→13×2,
 * 12→11×2, 8→7, 6 held → 93, +7 for the new axis = 100.
 */
export const AXIS_WEIGHTS: Record<AxisId, number> = {
  quiz_key_correctness: 17,
  example_coherence: 15,
  prose_coherence: 13,
  quiz_distractor_quality: 13,
  card_learning_value: 11,
  plan_actionability: 11,
  factual_accuracy: 7,
  behavioral_naturalness: 7,
  memorable_line_quality: 6,
};

/** Axes whose failure is CORRUPTION (a hard veto), vs draft-quality axes. */
export const CORRUPTION_AXES: ReadonlySet<AxisId> = new Set<AxisId>([
  "quiz_key_correctness",
  "example_coherence",
  "prose_coherence",
  "factual_accuracy",
]);

export type AxisHit = {
  unitId: string;
  quote: string;
  defect: string;
  /** OPTIONAL concrete remediation: the specific change that resolves THIS unit's defect
   *  (what to write instead), authored by the bar reviewer. Threaded into the repair
   *  finding's `expectedFix` so the repair writer gets an actionable target instead of a
   *  formulaic "repair the {axis} defect" stub. Absent on legacy submissions (back-compat). */
  fix?: string;
};
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
 * Self-consistency combine for 1..N independent bar reads of the SAME chapter
 * (the tiebreak path). Per axis: the **median score** (variance-smoothing —
 * median of 3 reads is unbiased and immune to one noisy sample, which is what
 * caused the the-daily-stoic ch3 0.6→0.58 false-REVISE flap on byte-identical
 * content); the **union of cited hits**; and a tier that PRESERVES a cited
 * CORRUPTION on any read so the RED veto can never be medianed away. Net: reduces
 * FALSE-REVISE (variance) without ever enabling a false-PASS. With 1 read it is the
 * identity. Reads need not all cover every axis (an axis present in any read is
 * combined over the reads that scored it). [[gpt-pipeline-run-daily-stoic-2026-06-16]]
 */
export function combineBarAxes(reads: AxisScore[][]): AxisScore[] {
  const byAxis = new Map<AxisId, AxisScore[]>();
  for (const read of reads) {
    for (const a of read) {
      if (!byAxis.has(a.axis)) byAxis.set(a.axis, []);
      byAxis.get(a.axis)!.push(a);
    }
  }
  const out: AxisScore[] = [];
  for (const [axis, scores] of byAxis) {
    const vals = scores.map((s) => s.score).sort((x, y) => x - y);
    // Lower-middle median: index 1 of an odd 3-read set (true median); the smaller of
    // two on an even set (conservative — never false-passes on a split).
    const score = vals.length === 0 ? 0 : vals[Math.floor((vals.length - 1) / 2)];
    const seen = new Set<string>();
    const hits: AxisHit[] = [];
    for (const s of scores) for (const h of s.hits) {
      const key = JSON.stringify([h.unitId, h.quote, h.defect]);
      if (!seen.has(key)) { seen.add(key); hits.push(h); }
    }
    const corruptionCited = CORRUPTION_AXES.has(axis) && scores.some((s) => s.tier === "CORRUPTION" && s.hits.length > 0);
    const tier: FailureTier = corruptionCited ? "CORRUPTION" : score < AXIS_FLOOR ? "GENERATED_DRAFT" : "PUBLISHABLE";
    out.push({ axis, score, tier, hits });
  }
  return out;
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
    "Evaluate chapter.reviewCards[] (the cards live under `reviewCards` — there is NO top-level `cards`/`flashcards` field; if reviewCards is present, NEVER score 'missing field', score the content). The front must be a question; the back must ANSWER it in the card's own words and test understanding, not source-recall. DRAFT if recall-only or front is a bare label. CORRUPTION if the back doesn't answer the front, is pasted verbatim from the breakdown, or is truncated mid-word.",
  example_coherence:
    "A concrete scene with a named human acting. CORRUPTION if a concept-label is the subject/object ('Cleo lifts a productive vulnerability folder'), a '<Name> studies <label>' skeleton, a fixed-timestamp concept-label HEADER repeated each chapter, or scaffold titles ('Source Moment N.1'). DRAFT if whatToDo is a proposition rather than an action, or if a source anchor appears as SET DRESSING rather than in the scene's logic — a case card pinned to a wall, a quote 'in the margin', a flyer about the source's anecdote ('On the plant wall, a case card reads Henry Ford, Model T'): anchor-as-prop reads as product placement and marks an ungrounded scene wearing a grounding costume. DRAFT (staging uniformity — read ACROSS the chapter/book, not one scene): if nearly every example stages a named person at a quirky OCCUPATIONAL location/prop in the same shape ('<Name> <tactile verb> at/beside/behind <job-site object>' — a fire-station gear rack, a post-office sorting case, a lab sample freezer) while the boundary topic is personal, the scenes are individually concrete but TEMPLATED — vary both the settings AND the opening structure, and drop staging that is incongruous with the lesson. FP-guard: a timestamp INSIDE a coherent scene is FINE — only the label-HEADER + identical-fixed-time-every-chapter is the defect; an anchor a character genuinely reasons about or reacts to is GOOD grounding; ordinary 'person in a place' openings are GOOD — the defect is the SAME occupational-prop skeleton repeated across most examples.",
  prose_coherence:
    "fastRead/deepRead/fullRead read as human prose that teaches. CORRUPTION if a clause repeats ~25× (templated loop), a '<Concept> means The <concept> is…' seam, ends mid-sentence, or fastRead just restates the thesis. DRAFT if a tier is wall-to-wall ABSTRACTION — chains of abstract nouns with no person, scene, or number for paragraphs ('scarcity culture shrinks courage by teaching lack first'); the plain-language bar (2026-06-11 direction): every abstract claim is followed within two sentences by something a reader can SEE, terms-of-art are explained in everyday words on first use, and a tier opens concrete, not with a thesis. DRAFT also if it reaches for a needlessly fancy word where a common one fits (utilize/leverage/facilitate/optimize where use/build-on/help/improve fits) or runs a sentence long enough that the reader loses the thread (~34+ words) — the target is an easy grade 7–9 reading level in EVERY reader-facing field (quiz, cards, examples, hook, keyTakeaway, plan), not just the breakdown. FP-guard: a consistent pedagogical opener across chapters ('The mechanism is:') is a convention when the content differs and reads as prose; precise technical terms explained plainly once are GOOD, not abstraction.",
  memorable_line_quality:
    "Each memorable line is a portable aphorism. DRAFT if it is a 16-23-word explanation or an enumeration rather than a compact, complete claim.",
  plan_actionability:
    "Evaluate chapter.implementationPlan.ifThenPlans[] (ifThenPlans is NESTED under `implementationPlan` — there is NO top-level `ifThenPlans`/`plan` field; if implementationPlan.ifThenPlans is present, NEVER score 'missing field', score the content). Each: context = a situational trigger; plan = an imperative If-X-then-Y using the chapter's one named reader tool. DRAFT if context is a source/proper-noun label, or plan is a pasted breakdown sentence or editor language ('use <source> as the source check', 'revisit the hard edge').",
  factual_accuracy:
    "Named-framework enumerations are complete and correctly named (BRAVING = 7 items incl. 'Vault', not 6 with 'Vault' renamed 'confidentiality'). CORRUPTION on a wrong/incomplete named enumeration or a fabricated fact. Needs the source as ground truth; when absent, mark 'could not verify' (never silently pass). When the pack supplies `chapter.groundedNumbers`, each listed number was web-VERIFIED against a cited real source — TRUST it; do NOT re-flag a number that matches the list as 'could not verify'. You MUST still flag (per severity) any number that is NOT on the list and not derivable from `sourceFacts`, and any number that CONTRADICTS its grounded counterpart (a drifted date/figure/quantity). An empty or absent list changes nothing — score exactly as above. EVIDENCE INTEGRITY (the deterministic gate EI1/EI2 covers the obvious cases; you cover the SEMANTIC ones it cannot): a load-bearing claim must resolve to a REAL named source with specifics (a person, company, study, place, or date — cited by surname/full name) OR a PLAIN illustration that uses no evidentiary verb. CORRUPTION on a TESTIMONIAL DRESSED AS RESEARCH — a first-name/initial-only subject (Brad, Candace P., 'the success report') whose personal report/account is given the grammar of a finding ('Brad's report names the hinge', 'Candace P.'s report proves'), AND on the PIPER MOVE — an INVENTED character inserted into a REAL researcher's documented setting to voice/act out the finding ('Piper, in Schultz's lab, says…'). The real researcher's documented result is the evidence; an invented witness narrating it is not. HARD RULE (overlaps quiz_key_correctness): a quiz answer KEYED to a testimonial is CORRUPTION — the correct answer must derive from a verifiable source fact, never from 'what Brad's report said'. FP-guard: a real source cited by surname + a documentary noun is GOOD ('Kosfeld's case shows', 'Enron's 2001 bankruptcy'); an invented illustration character who simply ACTS with no evidentiary verb is GOOD (the nurse who eyes the donut) — the defect is the first-name account WORN AS PROOF, or fiction smuggled into a real lab.",
  behavioral_naturalness:
    "Judge whether the chapter's prescribed micro-actions (tryThisNow, implementationPlan plans, the 24h challenge, and any 'do this now' moves in examples) are things a plausible person would actually DO — functional, not performative theater. NEVER a corruption axis: productivity-theater is a YELLOW-worthy style defect, never a RED veto. FLAG (push the score down): performative-not-functional actions ('write your TARGET on a visible surface', 'put a sticky note where you'll see it' as the whole action); contrived symbolic rituals ('move a pen across your desk', 'turn around', 'walk to a door and back', 'rehearse the sentence out loud three times'); prop-heavy staging that needs 3+ objects assembled before you can start; and shame/coercive phrasing ('you MUST complete this challenge', 'no excuses'). SCORING BANDS (explicit): a concrete, single-step, low-friction action a real person would plausibly do — even a very specific one ('text your manager one line before 9am', 'close the email tab for the next 25 minutes') — scores >= 0.85; SPECIFICITY IS NOT THE DEFECT, behavioral implausibility/theater is. Mild stylistic weakness (briefly prop-heavy but still functional, slightly formulaic ritual that a motivated reader would still do) scores 0.60–0.85. FP-guard (CRITICAL — do not false-floor clean books): NEVER score a clean, plausible, structural action below 0.6 — the 0.6 AXIS_FLOOR hard-caps the WHOLE book at YELLOW, so reserve sub-0.6 for actions that are dominated by theater/coercion across the chapter, not one mildly props-y step; ordinary 'do X at trigger Y' if-then plans, writing in a journal/notebook, a single timer, or one physical cue are GOOD and score >= 0.85. 'Low score looks like': 'write your TARGET on a visible surface'; 'move a pen, turn around, walk to a door'; 'you must complete this challenge'.",
};

/**
 * Writer-facing rendering of the SAME publishable-bar rubric the QC bar reviewer
 * scores against (AXIS_RUBRIC / AXIS_WEIGHTS / thresholds). Surfaced via the
 * `publishable-rubric` CLI command so a writer self-scores its draft against the
 * reviewer's actual standard BEFORE submitting — closing the writer↔QC gap that
 * the deterministic gate cannot (gate-clean ≠ bar PUBLISHABLE). Single source of
 * truth: this reads the same constants the bar pack hands the reviewer, so the
 * two can never drift.
 */
export function formatWriterRubric(): string {
  const order = (Object.keys(AXIS_WEIGHTS) as AxisId[]).sort((a, b) => AXIS_WEIGHTS[b] - AXIS_WEIGHTS[a]);
  const lines: string[] = [];
  lines.push("PUBLISHABLE BAR — the exact rubric the QC bar reviewer scores your chapter against.");
  lines.push("Self-score your draft on every axis BEFORE submitting. This is the standard that decides");
  lines.push("PUBLISHABLE vs REVISE — not gate-chapter (a gate-clean chapter can still be REVISE'd).");
  lines.push("");
  lines.push(`PASS = overall weighted score ≥ ${PUBLISHABLE_FLOOR}/100 AND no axis below ${AXIS_FLOOR.toFixed(2)}.`);
  lines.push(`CORRUPTION axes (a single cited hit RED-fails the whole chapter): ${[...CORRUPTION_AXES].join(", ")}.`);
  lines.push("Fix any axis you would score below ~0.85, and ANY corruption-axis hit, before you submit.");
  lines.push("");
  for (const axis of order) {
    const corrupt = CORRUPTION_AXES.has(axis) ? "  [CORRUPTION axis]" : "";
    lines.push(`── ${axis} (weight ${AXIS_WEIGHTS[axis]})${corrupt}`);
    lines.push(`   ${AXIS_RUBRIC[axis]}`);
    lines.push("");
  }
  lines.push("SELF-SCORE TEMPLATE (fill in before submit; redo any axis < 0.85 or any corruption hit):");
  for (const axis of order) lines.push(`  ${axis}: _.__  — what would a skeptical reviewer cite?`);
  return lines.join("\n");
}

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
