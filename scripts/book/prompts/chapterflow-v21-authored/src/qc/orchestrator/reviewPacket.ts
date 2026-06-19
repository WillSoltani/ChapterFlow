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
import { roleHintHeader } from "../../roles.js";
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

// ── Submission SKELETON builders ───────────────────────────────────────────────
// One per role; the prefilled structural fields (schemaVersion/ids/contentHash/packHash/
// question count) are derived, the judgment fields are FILL_ME / null sentinels. Extracted
// from writeReviewPacket so the autopilot's read-only reviewer broker can inject the SAME
// prefilled skeleton into a self-contained prompt (no REVIEW-PACKET archaeology) — the
// packet renders `json(buildX(...))` at the same sites, so its bytes are unchanged.

export function buildSweepSkeleton(bookId: string, roundId: string) {
  return {
    schemaVersion: "qc-sweep-submission-v1",
    bookId,
    roundId,
    role: "sweep",
    reviewer: qcReviewerId(roundId, "sweep"),
    verdict: "FILL_ME",
    checkedFamilies: [...REQUIRED_SWEEP_FAMILIES],
    findings: [],
  };
}

export function buildKeySkeleton(bookId: string, roundId: string, role: "keyA" | "keyB", chapters: ChapterV21[]) {
  return {
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
  };
}

export function buildBarSkeleton(bookId: string, roundId: string, ch: ChapterV21) {
  return {
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
  };
}

export function buildConfirmSkeleton(bookId: string, roundId: string, ch: ChapterV21) {
  return {
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
  };
}

export function buildMajorSkeleton(bookId: string, roundId: string) {
  return {
    schemaVersion: "qc-major-triage-v1",
    bookId,
    roundId,
    role: "major",
    reviewer: qcReviewerId(roundId, "major"),
    findings: [],
    dispositions: [],
  };
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
  L.push("(codex-qc:<round>:<role>:ch<NN>). Do NOT change it — but be clear what it does and does NOT");
  L.push("mean: the id LABELS the role; it does NOT by itself make the confirm read independent (bar and");
  L.push("confirm ids always differ by their role suffix). Real independence comes ONLY from dispatching");
  L.push("a genuinely SEPARATE fresh agent for the confirm read — and even then it is the SAME model");
  L.push("family as the bar, so they share blind spots. The adversarial confirm stance below is the");
  L.push("mitigation, not a guarantee. If a human/other-family agent reviews, keep the role prefix (codex-qc).");
  L.push("Submit each filled skeleton to its own file, then run its qc-submit command.");
  L.push("");
  L.push("HOW TO DISPATCH (orchestrator): each numbered section below is a COMPLETE, ready-to-paste");
  L.push("subagent prompt. Spawn ONE fresh subagent per unit and paste its section VERBATIM as that");
  L.push("subagent's entire instruction — do not wrap, summarize, or add your own framing. Every");
  L.push("subagent reviews exactly ONE unit, reads the real content, fills ONLY its own skeleton, runs");
  L.push("ONLY its own qc-submit, and NEVER runs collect/finalize/qc-attest/promote or edits a chapter.");
  L.push("Dispatch each chapter's confirm read as a SEPARATE, FRESH subagent from its bar read. Their");
  L.push("different reviewer ids only LABEL the roles — they do NOT certify independence; a genuinely");
  L.push("separate agent plus the adversarial stance (below) is what gives the second read its value.");
  L.push("");
  L.push("STRUCTURED OUTPUT (recommended): each role has a JSON Schema — `npx tsx src/cli.ts qc-schema <role>`");
  L.push("(sweep|keyA|keyB|bar|confirm|major). Bind it as the subagent's GPT `response_format` so the");
  L.push("submission is shape-valid by construction (no FILL_ME round-trips). The CLI still re-checks the");
  L.push("cross-field rules at qc-submit (e.g. REVISE needs a finding; an axis <0.6 needs a cited hit).");
  L.push("");
  L.push("RECOMMENDED REASONING per role (set each subagent's GPT session to match — see `npx tsx src/cli.ts roles`):");
  for (const role of ["sweep", "keyA", "keyB", "bar", "confirm", "major"]) L.push(`  ${roleHintHeader(role)}`);
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
  L.push(json(buildSweepSkeleton(bookId, roundId)));
  L.push("");

  // ── keyA / keyB (blind independent quiz-key derivations) ───────────────────
  for (const role of ["keyA", "keyB"] as const) {
    L.push(`## 2. ${role} — blind independent quiz-key derivation`);
    L.push(`Derive each answer YOURSELF from the prompt + choices + source facts BEFORE looking at any key.`);
    L.push(`choiceIndex = your derived answer; reason ≥40 chars; sourceFactIds ≥1. keyA and keyB MUST be independent derivations.`);
    L.push(submitCmd(bookId, roundId, role, tokens[role], `<${role}.json>`));
    L.push(json(buildKeySkeleton(bookId, roundId, role, chapters)));
    L.push("");
  }

  // ── Bar read (per chapter) ─────────────────────────────────────────────────
  L.push("## 3. Bar read — one per chapter (the publishable-bar score)");
  L.push("Replace every `score: null` with your honest 0..1. Any axis you score <0.6 REQUIRES a cited hit.");
  L.push("(quiz_key_correctness is injected from the key judge — do not include it.)");
  for (const ch of chapters) {
    L.push(`### bar ${ch2(ch.number)} — ${ch.chapterId}`);
    L.push(submitCmd(bookId, roundId, "bar", tokens.bar, `<bar-${ch2(ch.number)}.json>`));
    L.push(json(buildBarSkeleton(bookId, roundId, ch)));
    L.push("");
  }

  // ── Confirm read (per chapter; second independent reviewer) ────────────────
  L.push("## 4. Confirm read — one per chapter (a SECOND, ADVERSARIAL reviewer)");
  L.push("Only for chapters listed in confirm-candidates.json after finalize. The confirm reviewer");
  L.push("MUST differ from the bar reviewer. decision = PUBLISHABLE / REVISE / CORRUPTION (replace FILL_ME);");
  L.push("reason ≥40 chars; PUBLISHABLE must have empty findings, REVISE/CORRUPTION need ≥1 quote-backed finding.");
  L.push("");
  L.push("> ADVERSARIAL STANCE — you are NOT here to rubber-stamp the bar's PASS. This pipeline runs one model");
  L.push("> family, so bar and confirm share blind spots and over-rate output that merely READS fluent (the");
  L.push("> documented LLM self-preference / low-perplexity bias). So ASSUME a defect exists and try to REFUTE");
  L.push("> PUBLISHABLE: hunt the single weakest axis — a quiz key that doesn't follow from the cited source");
  L.push("> fact, an example that STATES a concept instead of staging a person's decision, a card back that");
  L.push("> doesn't answer its front, a memorable line that's just a teaching sentence, a plan step that's a");
  L.push("> proposition not an action. Read DEEPER than the bar (high reasoning effort), not a quick second");
  L.push("> look. Return PUBLISHABLE only when a genuine refutation attempt FAILS — and never because it scans well.");
  for (const ch of chapters) {
    L.push(`### confirm ${ch2(ch.number)} — ${ch.chapterId}`);
    L.push(submitCmd(bookId, roundId, "confirm", tokens.confirm, `<confirm-${ch2(ch.number)}.json>`));
    L.push(json(buildConfirmSkeleton(bookId, roundId, ch)));
    L.push("");
  }

  // ── Major triage (book-level) ──────────────────────────────────────────────
  // Without this section the autopilot's read-only submission broker has no plaintext
  // `major` token to record the triage with (it parses tokens from THIS packet), so the
  // major reviewer's output was silently dropped. A brokered major triage is SAFE: it
  // only records findings — a WAIVER (status waived_*) never takes effect from a
  // submission; it requires the separate, authorized `major-disposition` command.
  L.push("## 5. Major triage — book-level (triage the current major findings)");
  L.push("Triage every CURRENT major finding. status = open | waived_false_positive | waived_accepted_debt");
  L.push("(reason ≥20 chars). Recording a triage NEVER waives a major — a waiver only takes effect via the");
  L.push("authorized `major-disposition` command, never from this submission. Empty findings + dispositions");
  L.push("arrays mean 'no current majors'.");
  L.push(submitCmd(bookId, roundId, "major", tokens.major, "<major.json>"));
  L.push(json(buildMajorSkeleton(bookId, roundId)));
  L.push("");

  const path = reviewPacketPath(bookId, roundId);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, L.join("\n") + "\n", "utf8");
  return path;
}
