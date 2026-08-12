/**
 * candidateRepairBrief — the instruction the V4 candidate-repair prompt carries
 * beside the raw findings.
 *
 * NOT `src/qc/orchestrator/repairBrief.ts`. That one belongs to the legacy v23
 * QC-orchestrator lane: it writes a markdown brief to disk from the effective
 * ledger for a CLI/human repair loop over `state/chapters/`. This one is a pure
 * function that renders prompt bytes for `CandidateRepairApplicationPort` from
 * one candidate-scoped QC round. Same word, different lane — do not merge them.
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
 *     live shape: a QC round can only bind to a PASSING canonical review, so no
 *     reader blocker can be present), the factor medians are labelled as the only
 *     reader-quality signal the round carries;
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
 * scale stops being read as one. The cap binds the ADVISORY tail only: a
 * mandatory blocker and the factor line are never dropped to fit, because
 * silently losing a required fix would be a worse defect than an over-long
 * prompt, and the brief states the exact number of advisories it omitted.
 */
export const REPAIR_BRIEF_MAX_CHARS = 8000;

/** Per-finding message clamp. One pathological message must not consume the
 *  whole budget and starve every other finding of a line. */
export const REPAIR_BRIEF_ITEM_MAX_CHARS = 400;

/** Room reserved for the omission notice so the notice itself cannot push the
 *  brief past its budget. */
const OMISSION_NOTICE_RESERVE = 160;

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
  // "Floor-only" is decided on the BLOCKER set alone: every blocker is the score
  // floor, so no blocker names a defect. One named blocker alongside the floor is
  // NOT floor-only — the named defect leads.
  const floorOnly = input.blockers.length > 0
    && input.blockers.every((issue) => isReviewIssueCode(issue.code, READER_PANEL_BELOW_FLOOR_CODE));
  // Did the reader panel name an on-page defect on this chapter? Decided on the
  // codes actually handed in, never assumed.
  const panelNamedDefect = input.blockers.some((issue) => isReaderBlockingCode(issue.code))
    || advisories.some((issue) => isReaderBlockingCode(issue.code));

  const lines: string[] = [`# REPAIR BRIEF — chapter ${chapterLabel}`, ""];

  if (floorOnly) {
    lines.push(
      "## WHY THIS CHAPTER FAILED — SCORE FLOOR ONLY, NO NAMED DEFECT",
      "This chapter carries NO blocking defect. The only thing holding it back is a composite score under the bar:",
      ...input.blockers.map(bullet),
      "",
      "A score names nothing to fix. Do not chase the number, and do not rewrite material that is already working —",
      "the factors and advisories below are the ENTIRE diagnosis available for this chapter. Lift the lowest-scoring",
      "factors first, then clear the advisories. Anything you change beyond that is an unforced risk.",
      "",
    );
  } else if (input.blockers.length === 0) {
    lines.push(
      "## MANDATORY FIXES — BLOCKERS (0)",
      "No blocking finding is attached to this chapter. Everything below is diagnosis.",
      "",
    );
  } else {
    lines.push(
      `## MANDATORY FIXES — BLOCKERS (${input.blockers.length})`,
      "Every blocker below MUST be fixed. These are the only mandatory changes; everything after them is context.",
      ...input.blockers.map(bullet),
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
  let used = lines.join("\n").length;
  let shown = 0;
  for (const issue of advisories) {
    const text = bullet(issue);
    if (used + text.length + 1 + OMISSION_NOTICE_RESERVE > REPAIR_BRIEF_MAX_CHARS) break;
    lines.push(text);
    used += text.length + 1;
    shown += 1;
  }
  if (shown < advisories.length) {
    lines.push(
      `- …${advisories.length - shown} further advisories omitted to keep this brief inside its`
      + ` ${REPAIR_BRIEF_MAX_CHARS}-character budget.`,
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}
