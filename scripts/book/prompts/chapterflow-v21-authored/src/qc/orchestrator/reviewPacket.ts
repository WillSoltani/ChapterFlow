/**
 * Review packet — the single self-contained artifact a FRESH QC session reads to
 * review a whole book without any schema/hash/token archaeology.
 *
 * For each QC role (sweep, keyA, keyB, bar per chapter, confirm per chapter) it
 * emits the exact `qc-submit` command (with the live round token) and a JSON
 * SKELETON whose structural fields (schemaVersion/bookId/roundId/role/chapterId/
 * contentHash/packHash/question count) are pre-filled, but whose JUDGMENT fields
 * are deliberate sentinels (`null` scores, empty reasons, `FILL_ME` verdicts) that
 * FAIL submission validation until the reviewer fills them honestly. That removes
 * the busy-work that made the one-prompt flow brittle, without handing the
 * reviewer a pre-passed template to rubber-stamp.
 *
 * Tokens exist only at round creation (qcRound persists only salted hashes), so
 * this is written from createQcOrchestrationRound and never regenerable later.
 */

import { mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { chapterContentHash } from "../../critics/qcAttestation.js";
import { AXIS_WEIGHTS, type AxisId } from "../../critics/semantic/publishableBar.js";
import type { ChapterV21 } from "../../types.js";
import { loadKeyPack } from "../manualKeyJudge.js";
import type { QcRoundRole } from "../qcRound.js";
import { qcReviewerId } from "../reviewerId.js";
import { sourceHashFor } from "../sourceV2Gate.js";
import { REQUIRED_SWEEP_FAMILIES } from "../sweep.js";
import { barPackPath } from "../barReview.js";
import { orchestratorRoundDir } from "./artifacts.js";

const NON_KEY_AXES = (Object.keys(AXIS_WEIGHTS) as AxisId[]).filter((a) => a !== "quiz_key_correctness");

export function reviewPacketPath(bookId: string, roundId: string): string {
  return resolve(orchestratorRoundDir(bookId, roundId), "REVIEW-PACKET.md");
}

function submitCmd(bookId: string, roundId: string, role: QcRoundRole, token: string, file: string): string {
  return `CHAPTERFLOW_NO_API_CODEX_QC=1 npx tsx src/cli.ts qc-submit ${bookId} --round ${roundId} --role ${role} --token ${token} --file ${file}`;
}

function json(value: unknown): string {
  return "```json\n" + JSON.stringify(value, null, 2) + "\n```";
}

function ch2(n: number): string {
  return `ch${String(n).padStart(2, "0")}`;
}

export function writeReviewPacket(
  bookId: string,
  roundId: string,
  chapters: ChapterV21[],
  tokens: Record<QcRoundRole, string>,
): string {
  const L: string[] = [];
  L.push(`# QC review packet — ${bookId} / ${roundId}`);
  L.push("");
  L.push("You are a FRESH, INDEPENDENT QC reviewer. You did NOT author this book.");
  L.push("Read each chapter and grade it against the publishable bar. Do not trust the");
  L.push("structure; read the actual content. Every score/verdict/finding below is a");
  L.push("placeholder that FAILS validation until you replace it with your honest result.");
  L.push("");
  L.push("Content to review + the full rubric + per-unit source facts are in the bar pack:");
  L.push(`  ${barPackPath(bookId, roundId)}`);
  L.push("Blind quiz key packs (questions + choices, NO stored key) are in:");
  L.push(`  state/qc-packs/${bookId}/${roundId}/${ch2(0).replace("ch00", "chNN")}.key-pack.json`);
  L.push("");
  L.push("Publishable bar (the bar read scores these 0..1; GREEN needs weighted overall ≥85");
  L.push("AND every axis ≥0.6; one cited CORRUPTION hit on a corruption axis is RED):");
  for (const axis of Object.keys(AXIS_WEIGHTS) as AxisId[]) L.push(`  - ${axis} (weight ${AXIS_WEIGHTS[axis]})`);
  L.push("");
  L.push("Reviewer label: each skeleton below is PRE-FILLED with its own derived reviewer id");
  L.push("(codex-qc:<round>:<role>:ch<NN>). Do NOT change it — the bar and confirm ids for a");
  L.push("chapter are deliberately different so the confirm read counts as an independent second");
  L.push("reviewer. If a human/other agent reviews instead, keep the same role prefix (codex-qc).");
  L.push("Submit each filled skeleton to its own file, then run its qc-submit command.");
  L.push("");

  // ── Sweep (book-wide cross-chapter templating) ─────────────────────────────
  L.push("## 1. Sweep — book-wide cross-chapter templating");
  L.push(`Families to check: ${REQUIRED_SWEEP_FAMILIES.join(", ")}. PASS only if none fire.`);
  L.push("What each family means (a SHELL reused across chapters with only the content swapped):");
  L.push("  - scene_skeleton: example scenes (or the fullRead boundary close) sharing one frame across chapters — same opening shape / same 'there is a limit' hinge, different nouns.");
  L.push("  - persona_drift: one name = two different people or roles across the book; or a real source-figure's name reused for a fictional actor.");
  L.push("  - repeated_unit: near-identical review cards, implementation plans, weeklyPractice shells ('for seven days, keep one X log'), quiz stems, hooks, or tactics across chapters.");
  L.push("  - location_stamping: the same venue/place, clock stamp, or action container (timer/calendar) reused as the setting/anchor across chapters.");
  L.push("FP-GUARDS (do NOT flag these — they are alignment, not templating):");
  L.push("  - Shared CONCEPT vocabulary: the book's central terms recurring across chapters is the SUBJECT, not a templated shell. Only flag a reused STRUCTURE with the content swapped.");
  L.push("  - A consistent pedagogical opener ('The mechanism is:') across chapters is a CONVENTION when the content differs and the prose reads as human teaching.");
  L.push("  - Two chapters that happen to share a venue or a card frame are fine; the defect is a SHELL spanning many chapters. Rule of thumb: REVISE the whole book only when ≥3 families each span ≥1/3 of the chapters, or any single shell saturates the book.");
  L.push(`Set verdict to PASS / REVISE / CORRUPTION (replace FILL_ME). REVISE/CORRUPTION need ≥1 quote-backed finding citing the SPECIFIC chapters and the shared shell.`);
  L.push(submitCmd(bookId, roundId, "sweep", tokens.sweep, "<sweep.json>"));
  L.push(json({
    schemaVersion: "qc-sweep-submission-v1",
    bookId,
    roundId,
    role: "sweep",
    reviewer: qcReviewerId(roundId, "sweep"),
    verdict: "FILL_ME",
    checkedFamilies: [...REQUIRED_SWEEP_FAMILIES],
    findings: [],
  }));
  L.push("");

  // ── keyA / keyB (blind independent quiz-key derivations) ───────────────────
  for (const role of ["keyA", "keyB"] as const) {
    L.push(`## 2. ${role} — blind independent quiz-key derivation`);
    L.push(`Derive each answer YOURSELF from the prompt + choices + source facts BEFORE looking at any key.`);
    L.push(`choiceIndex = your derived answer; reason ≥40 chars; sourceFactIds ≥1. keyA and keyB MUST be independent derivations.`);
    L.push(submitCmd(bookId, roundId, role, tokens[role], `<${role}.json>`));
    L.push(json({
      schemaVersion: "qc-key-derive-v2",
      bookId,
      roundId,
      role,
      reviewer: qcReviewerId(roundId, role),
      chapters: chapters.map((ch) => {
        const pack = loadKeyPack(bookId, roundId, ch.number);
        const qCount = pack?.questions.length ?? ch.quiz?.questions?.length ?? 0;
        return {
          chapterNumber: ch.number,
          chapterId: ch.chapterId,
          packHash: pack?.packHash ?? "<copy from key-pack>",
          answers: Array.from({ length: qCount }, (_, i) => ({
            questionIndex: i,
            choiceIndex: null,
            confidence: "FILL_ME",
            reason: "",
            sourceFactIds: [],
          })),
        };
      }),
    }));
    L.push("");
  }

  // ── Bar read (per chapter) ─────────────────────────────────────────────────
  L.push("## 3. Bar read — one per chapter (the publishable-bar score)");
  L.push("Replace every `score: null` with your honest 0..1. Any axis you score <0.6 REQUIRES a cited hit.");
  L.push("(quiz_key_correctness is injected from the key judge — do not include it.)");
  for (const ch of chapters) {
    L.push(`### bar ${ch2(ch.number)} — ${ch.chapterId}`);
    L.push(submitCmd(bookId, roundId, "bar", tokens.bar, `<bar-${ch2(ch.number)}.json>`));
    L.push(json({
      schemaVersion: "qc-bar-read-v2",
      bookId,
      roundId,
      role: "bar",
      reviewer: qcReviewerId(roundId, "bar", ch.number),
      chapterNumber: ch.number,
      chapterId: ch.chapterId,
      contentHash: chapterContentHash(ch),
      sourceHash: sourceHashFor(bookId, ch.number) ?? null,
      notes: "",
      axes: NON_KEY_AXES.map((axis) => ({ axis, score: null, tier: "PUBLISHABLE", hits: [] })),
    }));
    L.push("");
  }

  // ── Confirm read (per chapter; second independent reviewer) ────────────────
  L.push("## 4. Confirm read — one per chapter (a SECOND, different reviewer)");
  L.push("Only for chapters listed in confirm-candidates.json after finalize. The confirm reviewer");
  L.push("MUST differ from the bar reviewer. decision = PUBLISHABLE / REVISE / CORRUPTION (replace FILL_ME);");
  L.push("reason ≥40 chars; PUBLISHABLE must have empty findings, REVISE/CORRUPTION need ≥1 quote-backed finding.");
  for (const ch of chapters) {
    L.push(`### confirm ${ch2(ch.number)} — ${ch.chapterId}`);
    L.push(submitCmd(bookId, roundId, "confirm", tokens.confirm, `<confirm-${ch2(ch.number)}.json>`));
    L.push(json({
      schemaVersion: "qc-confirm-read-v1",
      bookId,
      roundId,
      role: "confirm",
      reviewer: qcReviewerId(roundId, "confirm", ch.number),
      chapterNumber: ch.number,
      chapterId: ch.chapterId,
      contentHash: chapterContentHash(ch),
      decision: "FILL_ME",
      reason: "",
      findings: [],
    }));
    L.push("");
  }

  const path = reviewPacketPath(bookId, roundId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, L.join("\n") + "\n", "utf8");
  return path;
}
