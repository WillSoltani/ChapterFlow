/**
 * candidateRepairBrief — the instruction the V4 candidate-repair prompt carries
 * beside the raw findings.
 *
 * NOT `src/qc/orchestrator/repairBrief.ts`. That one belongs to the legacy v23
 * QC-orchestrator lane: it writes a markdown brief to disk from the effective
 * ledger for a CLI/human repair loop over `state/chapters/`. This one is a pure
 * function that renders prompt bytes for `CandidateRepairApplicationPort` from
 * one candidate-scoped finding set — a failed QC round on the QC lane, a FAIL
 * canonical review on the review lane. Same word, different lane — do not merge
 * them.
 *
 * WHY THIS EXISTS
 * The repair port used to hand the model exactly one thing: the BLOCKING findings
 * scoped to the chapter. Everything else the round carried — every WARN advisory,
 * every escalation signal, every per-factor reader score — was discarded at the
 * port boundary. That is survivable when a blocker names a defect ("quiz key
 * wrong at ch03/q2"): the finding IS the task. It is not survivable when the
 * blockers are gate mechanics and the thing actually wrong with the chapter is
 * that readers found it mediocre — the writer then re-rolls blind and lands in
 * the same band, which is the shape that stalled the live canary.
 *
 * WHAT THE BRIEF DOES
 * It carries the full signal repair is entitled to, with the mandate boundary
 * stated in words rather than implied by ordering:
 *   - BLOCKERS are mandatory fixes and always lead;
 *   - when the ONLY blocker is the composite score floor, the brief says so
 *     explicitly — no named defect — and leads the diagnosis with the weakest
 *     factors and the advisories clustered on that chapter;
 *   - when the panel attached no blocking finding to the chapter at all (the
 *     QC lane's shape: a QC round can only bind to a PASSING canonical review, so
 *     no reader blocker can be present there), the factor medians are labelled as
 *     the only reader-quality signal the round carries;
 *   - advisories and factor scores are labelled diagnosis, never mandates, so a
 *     model cannot mistake a WARN for a gate it must satisfy.
 *
 * Every claim the brief makes about the chapter is decided from the findings
 * handed to it — counts, codes, locations, messages. It asserts nothing it was
 * not given.
 *
 * Nothing here decides an outcome. The brief is prompt text; the gates are
 * unchanged and still fail closed upstream.
 */

import { isSourceFidelityCode } from "../critics/semantic/sourceFidelityJudge.js";
import type { QcIssue } from "../qc/qcTypes.js";
import {
  READER_PANEL_BELOW_FLOOR_CODE,
  READER_PANEL_FACTOR_SCORES_CODE,
  isReaderBlockingCode,
  isReviewIssueCode,
} from "../review/readerPanelIssueCodes.js";

/**
 * Character budget for one chapter's brief. DELIBERATE NEW PIN — no prompt-size
 * pin existed anywhere on the repair path before this module (verified: no
 * `*_MAX_CHARS` / budget constant in `candidateRepairApplicationPort.ts`,
 * `contentRepairWorkflow.ts` or `runtime/promptRenderer.ts`), so this is not a
 * relaxation of an existing limit.
 *
 * Rationale for 8000: the repair prompt already carries the failed chapter, the
 * blueprint, the source packet, the source-use plan and every matching source
 * text — tens of thousands of characters of evidence. The brief is the
 * INSTRUCTION beside that evidence, and an instruction that grows to evidence
 * scale stops being read as one. This cap binds the advisory tail (the exact
 * number of omitted advisories is stated); blockers now carry their OWN
 * coverage-first budget below (REPAIR_BRIEF_BLOCKER_MAX_CHARS) — the earlier
 * "blockers are never dropped to fit" rule read as safety and was really an
 * unbounded mandate that killed two live repair runs.
 */
export const REPAIR_BRIEF_MAX_CHARS = 8000;

/** Per-finding message clamp. One pathological message must not consume the
 *  whole budget and starve every other finding of a line. */
export const REPAIR_BRIEF_ITEM_MAX_CHARS = 400;

/**
 * Character budget for the MANDATORY FIXES section.
 *
 * WHY IT EXISTS — the blocker list was the one part of this brief with no bound at
 * all. The advisory tail has been capped since this module was written; blockers
 * were "never dropped to fit", which reads as safety and is really an unbounded
 * mandate. The live Franklin run is the counter-example: QC round
 * qc-29d119c59544a5d991c71c7c9fec04bb returned 96 blockers, grouped per chapter as
 * ch01 13 / ch02 29 / ch03 35 / ch04 19, and ch03 — the largest set, ~5.5k
 * characters of blocker section on its own — is the chapter whose repair attempt
 * failed in BOTH `repair-r2` and `repair-r3`
 * (`gateway=FAILED … stdoutBytes=1979` and `8559`, against ~49k on the chapters
 * that succeeded), each failure killing the whole repair run with
 * `model output failed source-controlled schema validation`. ch01 and ch02 were
 * repaired successfully in the same runs. That correlation is what this bound is
 * drawn from; the model's raw output is not persisted, so the exact mechanism
 * inside the model is NOT established here and is not claimed.
 *
 * 4000 = half the brief budget, leaving the advisory tail its own room. The number
 * is a split of an existing budget rather than a fitted threshold: 29 blockers
 * (ch02, ~4.2k) succeeded live and 35 (ch03, ~5.6k) did not, which does not
 * identify a cliff, so no cap is claimed to sit on one.
 *
 * WHAT IT DOES NOT DO — it drops nothing silently and it changes no gate. Every
 * distinct blocker CODE always gets a line (see `boundedBlockers`), the omitted
 * remainder is counted and named by code, and the findings themselves are
 * unchanged: QC re-runs on the successor and re-raises anything still unfixed. A
 * repair that fixes fewer defects per round converges over rounds; a repair run
 * that dies converges never.
 */
export const REPAIR_BRIEF_BLOCKER_MAX_CHARS = 4000;

/**
 * Character budget for the SOURCE CONTRADICTIONS section, and the per-item clamp
 * inside it.
 *
 * WHY IT NEEDS ITS OWN. A source-fidelity blocker is the one finding class whose
 * message IS the fix: it carries the chapter's own words and, beside them, the
 * verbatim line of the book that settles the matter. The general
 * `REPAIR_BRIEF_ITEM_MAX_CHARS` clamp is 400 characters, which truncates a
 * chapter quote plus a source quote plus the claim - and a truncated source
 * quote is worse than none, because the writer cannot tell what the book
 * actually says and will guess. 1,000 characters holds both quotes at their
 * classifier clip (300 each) plus the claim and the judge's note.
 *
 * 2,000 for the section is one quarter of the whole brief. It is drawn from the
 * SAME 8,000-character budget as everything else (the advisory tail measures
 * what is already on the page), so this adds no room to the prompt - it moves
 * room from advisories, which are diagnosis, to the findings that name a false
 * fact and how to correct it.
 */
export const REPAIR_BRIEF_SOURCE_MAX_CHARS = 2000;
export const REPAIR_BRIEF_SOURCE_ITEM_MAX_CHARS = 1000;

/** Room reserved for the omission notice so the notice itself cannot push the
 *  brief past its budget. */
const OMISSION_NOTICE_RESERVE = 160;

/**
 * True when every blocker on the chapter is the composite score floor, so no
 * blocker names a defect to fix. One named blocker alongside the floor is NOT
 * floor-only — the named defect leads.
 *
 * EXPORTED so the brief's promise and the port's machine check are the same
 * decision. The brief tells a floor-only writer that returning the chapter
 * unchanged is a permitted outcome; the port has to honour that on the identical
 * predicate, or the prompt and the machine disagree about the same chapter.
 */
export function isFloorOnlyBlockerSet(blockers: readonly QcIssue[]): boolean {
  return blockers.length > 0
    && blockers.every((issue) => isReviewIssueCode(issue.code, READER_PANEL_BELOW_FLOOR_CODE));
}

export interface RepairBriefInput {
  readonly chapterNumber: number;
  /** Blocking findings scoped to this chapter — mandatory fixes, never dropped. */
  readonly blockers: readonly QcIssue[];
  /** WARN findings scoped to this chapter — diagnosis. May include the
   *  per-factor score line, which is lifted into its own section. */
  readonly advisories: readonly QcIssue[];
}

function clamp(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length <= REPAIR_BRIEF_ITEM_MAX_CHARS
    ? collapsed
    : `${collapsed.slice(0, REPAIR_BRIEF_ITEM_MAX_CHARS)}…[truncated]`;
}

function bullet(issue: QcIssue): string {
  return `- [${issue.code}]${issue.location === undefined ? "" : ` (${issue.location})`} ${clamp(issue.message)}`;
}

/** The wider clamp the source-fidelity section uses, so a source quote survives. */
function sourceClamp(value: string): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length <= REPAIR_BRIEF_SOURCE_ITEM_MAX_CHARS
    ? collapsed
    : `${collapsed.slice(0, REPAIR_BRIEF_SOURCE_ITEM_MAX_CHARS)}…[truncated]`;
}

/** The blockers the brief lists, and the ones it names only by class. Both keep
 *  the caller's provenance order. */
export interface BoundedBlockers {
  readonly listed: readonly QcIssue[];
  readonly omitted: readonly QcIssue[];
}

/**
 * Bound one chapter's blocker list without hiding what it left out.
 *
 * EXPORTED because the same bound must apply to the prompt's machine-readable
 * `qc_findings` record. Bounding the brief while shipping the unbounded set
 * beside it bounds nothing: the repair port renders the SAME `listed` set, and
 * the brief's counted per-code notice below is what tells the writer the rest
 * exists.
 *
 * ORDER OF PRIORITY, and why:
 *   1. COVERAGE FIRST — one blocker per distinct code, in first-appearance order.
 *      A 96-finding round is not 96 different defects: the live Franklin round was
 *      68 B5 (em dash) + 21 SC11.2 + 4 BP15 + 2 A14 + 1 BP24, five classes. A plain
 *      top-N would have spent the whole budget on B5 repeats and never shown the
 *      writer that BP24 existed at all. Coverage wins even if the coverage pass
 *      alone exceeds the budget — losing a defect CLASS outright is worse than an
 *      over-long section, and the code catalog is small and finite.
 *   2. Then the remaining blockers in the caller's provenance order until the
 *      budget is spent.
 *   3. Then a notice that COUNTS the omitted remainder and NAMES it by code with
 *      per-code counts, so the writer knows more of each class exists and can fix
 *      the class rather than the listed instance.
 *
 * `severity` deliberately does not order anything: every issue reaching here is
 * already a BLOCKER, so severity carries no signal inside this set.
 */
export function boundedRepairBlockers(blockers: readonly QcIssue[]): BoundedBlockers {
  return coverageFirstSelection(blockers, REPAIR_BRIEF_BLOCKER_MAX_CHARS, { coverageMayOverflow: true });
}

/**
 * The coverage-first bound, shared by the MANDATE and the ADVISORY sections.
 *
 * `coverageMayOverflow` is the one difference between the two callers, and it is
 * a deliberate asymmetry: losing a BLOCKER class outright is worse than an
 * over-long mandate, so the blocker coverage pass admits one line per code even
 * past its budget. The advisory tail shares the brief's single hard character
 * budget with everything above it, so its coverage pass stops at the budget —
 * and the omission notice then names the classes it could not reach, which is
 * the property that was missing entirely (R-153).
 */
function coverageFirstSelection(
  issues: readonly QcIssue[],
  budget: number,
  options: Readonly<{ coverageMayOverflow: boolean }>,
): BoundedBlockers {
  const taken = new Set<QcIssue>();
  const seenCodes = new Set<string>();
  let used = 0;
  for (const issue of issues) {
    if (seenCodes.has(issue.code)) continue;
    seenCodes.add(issue.code);
    const line = bullet(issue).length + 1;
    if (!options.coverageMayOverflow && used + line > budget) continue;
    taken.add(issue);
    used += line;
  }
  for (const issue of issues) {
    if (taken.has(issue)) continue;
    const line = bullet(issue).length + 1;
    if (used + line > budget) continue;
    taken.add(issue);
    used += line;
  }
  // Re-emit in the caller's provenance order: the coverage pass reorders, and the
  // caller owns provenance order (this module owns framing, not sequence).
  const listed = issues.filter((issue) => taken.has(issue));
  const omitted = issues.filter((issue) => !taken.has(issue));
  return { listed, omitted };
}

/** "12 B5, 3 SC11.2.anchor_specific_not_present" — the omitted remainder named by
 *  class, most-numerous first, ties broken by first appearance so the line is
 *  deterministic. */
function omissionByCode(omitted: readonly QcIssue[]): string {
  const counts = new Map<string, number>();
  for (const issue of omitted) counts.set(issue.code, (counts.get(issue.code) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => (b[1] === a[1] ? 0 : b[1] - a[1]))
    .map(([code, count]) => `${count} ${code}`)
    .join(", ");
}

/**
 * Build one chapter's repair brief.
 *
 * Pure and deterministic: same findings in, same bytes out. Ordering of the
 * supplied findings is preserved — the caller owns provenance order, this module
 * owns framing.
 */
export function buildRepairBrief(input: RepairBriefInput): string {
  const chapterLabel = String(input.chapterNumber).padStart(2, "0");
  const factorLines = input.advisories.filter((issue) => isReviewIssueCode(issue.code, READER_PANEL_FACTOR_SCORES_CODE));
  const advisories = input.advisories.filter((issue) => !isReviewIssueCode(issue.code, READER_PANEL_FACTOR_SCORES_CODE));
  const floorOnly = isFloorOnlyBlockerSet(input.blockers);
  // Did the reader panel name an on-page defect on this chapter? Decided on the
  // codes actually handed in, never assumed.
  const panelNamedDefect = input.blockers.some((issue) => isReaderBlockingCode(issue.code))
    || advisories.some((issue) => isReaderBlockingCode(issue.code));

  const lines: string[] = [`# REPAIR BRIEF — chapter ${chapterLabel}`, ""];

  // SOURCE CONTRADICTIONS LEAD. A blocker that says the chapter contradicts the
  // book is not the same kind of task as a style or structure blocker: the
  // writer has to change what the chapter ASSERTS, and the line of the book that
  // settles it is right there in the finding. It is printed first, in full, and
  // then again (clamped) among the mandatory fixes, because the mandate list's
  // promise — that every distinct blocker CODE is represented in it — has to
  // stay true.
  const sourceBlockers = input.blockers.filter((issue) => isSourceFidelityCode(issue.code));
  if (sourceBlockers.length > 0) {
    const rendered: string[] = [];
    let used = 0;
    for (const issue of sourceBlockers) {
      const line = `- [${issue.code}]${issue.location === undefined ? "" : ` (${issue.location})`} ${sourceClamp(issue.message)}`;
      if (used + line.length + 1 > REPAIR_BRIEF_SOURCE_MAX_CHARS && rendered.length > 0) break;
      rendered.push(line);
      used += line.length + 1;
    }
    lines.push(
      `## SOURCE CONTRADICTIONS — ${sourceBlockers.length} finding(s): FIX THE FACT`,
      "Each line below quotes this chapter's own words and, beside them, the line of the book that settles the",
      "matter. Change what the chapter ASSERTS so it agrees with the source quote. Do not paraphrase the defect",
      "away and do not delete the passage to make the finding disappear if the source supports a corrected version",
      "of it — say what the book says.",
      ...rendered,
      ...(rendered.length === sourceBlockers.length
        ? []
        : [`- …${sourceBlockers.length - rendered.length} further source finding(s) are listed in the mandatory fixes below.`]),
      "",
    );
  }

  if (floorOnly) {
    lines.push(
      "## WHY THIS CHAPTER FAILED — SCORE FLOOR ONLY, NO NAMED DEFECT",
      "This chapter carries NO blocking defect. The only thing holding it back is a composite score under the bar:",
      ...input.blockers.map(bullet),
      "",
      "A score names nothing to fix. Do not chase the number, and do not rewrite material that is already working —",
      "the factors and advisories below are the ENTIRE diagnosis available for this chapter. Lift the lowest-scoring",
      "factors first, then clear the advisories. Anything you change beyond that is an unforced risk.",
      // The machine used to contradict this paragraph: an unchanged chapter was
      // hard-failed REPAIR_OUTPUT_NO_CHANGE, so the only way to satisfy the run
      // was to change something the brief had just told the writer not to touch.
      // The port now records a floor-only no-op as its own adjudicated outcome
      // (REPAIR_NO_CHANGE_JUSTIFIED), which is what makes this sentence true.
      "If, after reading the chapter against the blueprint and the source-use plan, you judge that nothing here",
      "should change, return it unchanged. That is a permitted outcome and it is recorded as one. Do not invent a",
      "change to satisfy the machine.",
      "",
    );
  } else if (input.blockers.length === 0) {
    lines.push(
      "## MANDATORY FIXES — BLOCKERS (0)",
      "No blocking finding is attached to this chapter. Everything below is diagnosis.",
      "",
    );
  } else {
    const bounded = boundedRepairBlockers(input.blockers);
    const boundedLines = bounded.listed.map(bullet);
    lines.push(
      `## MANDATORY FIXES — BLOCKERS (${input.blockers.length})`,
      bounded.omitted.length === 0
        ? "Every blocker below MUST be fixed. These are the only mandatory changes; everything after them is context."
        : `${input.blockers.length} blockers are attached to this chapter — more than one brief can carry. The ${boundedLines.length} below MUST be fixed, and every distinct blocker CODE in the round is represented among them, so treat each one as an EXAMPLE OF ITS CLASS and clear the class across the whole chapter, not just the listed location. These are the only mandatory changes; everything after them is context.`,
      ...boundedLines,
      ...(bounded.omitted.length === 0
        ? []
        : [`- …${bounded.omitted.length} further blocker(s) of the classes above are not listed individually: ${omissionByCode(bounded.omitted)}. They are real and still block. Fixing the class is how you clear them.`]),
      "",
    );
  }

  if (factorLines.length > 0) {
    if (floorOnly) {
      lines.push("## WEAKEST FACTORS (lowest first — start here)");
    } else if (panelNamedDefect) {
      lines.push(
        "## READER-PANEL FACTOR SCORES (context, not a mandate)",
        "The panel's per-factor medians for this chapter, weakest first.",
      );
    } else {
      lines.push(
        // The branch condition is "no BLOCKING finding", which is not the same as
        // "no defect": the panel routinely raises advisories on a chapter it did
        // not block, and those advisories are printed further down THIS brief.
        // Saying otherwise put a false statement in a model-facing prompt.
        "## READER-PANEL DIAGNOSIS — NO BLOCKING FINDING ON THIS CHAPTER",
        "The panel raised no blocking finding here, so this chapter failed on the composite floor alone.",
        "The per-factor medians below, together with any advisories listed later in this brief, are the whole",
        "of the reader-quality signal for it. Context, not a mandate: lift the lowest-scoring factors and",
        "address the advisories. Do not rewrite material that is already working.",
      );
    }
    lines.push(...factorLines.map(bullet), "");
  }

  if (advisories.length === 0) {
    lines.push(
      "## ADVISORIES CLUSTERED ON THIS CHAPTER (0)",
      floorOnly
        ? "- none recorded. The reader panel scored this chapter under the bar without naming anything."
          + " Do not invent a defect to justify a rewrite: re-read the chapter against the blueprint and the"
          + " source-use plan and strengthen only what the source already supports."
        : "- none recorded for this chapter.",
      "",
    );
    return `${lines.join("\n")}\n`;
  }

  lines.push(`## ADVISORIES CLUSTERED ON THIS CHAPTER (${advisories.length}) — diagnosis, not mandates`);
  // COVERAGE FIRST, exactly as the mandate above (R-153). The old tail was a
  // plain top-N in provenance order, so on the live rounds (11.4k-14.5k
  // characters of advisory against an 8000-character brief) roughly half of each
  // chapter's advisories were dropped, and the writer was told only HOW MANY —
  // never which classes existed beyond the printed ones. One line per distinct
  // code goes in first, the remainder fills the budget, and the notice names the
  // omitted classes by code with counts.
  const remaining = REPAIR_BRIEF_MAX_CHARS - lines.join("\n").length - OMISSION_NOTICE_RESERVE;
  const bounded = coverageFirstSelection(advisories, remaining, { coverageMayOverflow: false });
  lines.push(...bounded.listed.map(bullet));
  if (bounded.omitted.length > 0) {
    lines.push(
      `- …${bounded.omitted.length} further advisories omitted to keep this brief inside its`
      + ` ${REPAIR_BRIEF_MAX_CHARS}-character budget: ${omissionByCode(bounded.omitted)}.`,
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}
