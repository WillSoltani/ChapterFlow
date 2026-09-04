/**
 * COMPILE-stage observability: the rejected section-pack draft, written down.
 *
 * The research stage already persists every REJECTED chapter-research draft under
 * `research-runs/<bookId>/<runId>/rejected/chNN.attemptK.json` (#547). The compile
 * stage had no equivalent, and the 2026-09-04 live Franklin canary showed exactly
 * what that costs: ch01's summary pack was refused 3 of 3 by
 * SEC14.chapter_case_grounding + SEC136.dealt_case_untaught — "carries only 1/2 of
 * ch01.case.josiahEmigration's hardSpecifics (about 1682, seventeen, thirteen)" —
 * on a card that NAMED those specifics in its MUST TEACH list, and nobody could
 * read what the writer had actually written. The blocker lines survived in the
 * round log; the draft they were about was discarded, and `attempts.jsonl` under
 * the compiler run carries gateway metadata with no model output in it.
 *
 * Every rejected draft is now written beside the run that rejected it, through the
 * same atomic writer the run record and the attempt journal use.
 *
 * Three properties hold by construction, and the tests pin all three:
 *   - DIAGNOSTICS ONLY. Nothing reads these files back. A write that fails is
 *     logged and dropped — a filesystem problem must never stand in front of the
 *     content verdict the operator is owed, and must never fail a compile that
 *     would otherwise pass.
 *   - OUTSIDE IDENTITY. The file lives in the run-state run directory, which the
 *     run store reads by exact filename (`run.json`, `attempts.jsonl`, `stages/`).
 *     Run identity is the RunDefinition and candidate identity is the staged file
 *     list, so a record here can never change either one. It is NOT written under
 *     the attempt root — that is the model gateway's own space.
 *   - BOUNDED. One record is capped; over the cap the DRAFT is truncated and the
 *     record says so. The metadata read first — chapter, kind, attempt, the full
 *     blocker and advisory lines, the retry feedback that was sent — is never what
 *     gets cut.
 */

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import type { SectionKind } from "../artifacts/artifactTypes.js";
import { writeFileAtomic } from "../lib/atomicWrite.js";

/** Where rejected section packs are written, relative to the COMPILER RUN dir
 *  (`run-state/books/<bookId>/runs/compiler-run-<id>/rejected/`). Same name the
 *  research stage uses under its own run dir, on purpose: one thing to look for. */
export const REJECTED_SECTION_PACKS_DIR = "rejected";

/** Byte ceiling for one record. A section pack runs a few tens of KB, so 256 KB
 *  holds a draft with its blocker lines and its retry feedback with room to spare,
 *  while a pathological model output cannot fill the run directory. Same ceiling
 *  the research stage uses. */
export const MAX_REJECTED_SECTION_PACK_BYTES = 256 * 1024;

/** The retry feedback that was SENT INTO the attempt being recorded, as persisted.
 *  The prior draft the card echoed is deliberately reduced to a boolean: it is the
 *  PREVIOUS attempt's own record, already on disk beside this one, so repeating it
 *  here would double every record for nothing. */
export interface RejectedSectionPackFeedback {
  readonly blockerLines: readonly string[];
  readonly priorDraftEchoed: boolean;
  readonly gatewaySchemaRejection?: boolean;
  readonly transientProcessFailure?: boolean;
}

/** One rejected section-pack draft, as the compiler hands it to the sink. */
export interface RejectedSectionPackDraft {
  readonly chapterNumber: number;
  readonly kind: SectionKind;
  /** Draft ordinal WITHIN the section pass: 1..MAX_SECTION_ATTEMPTS. */
  readonly attempt: number;
  /** The chapter's section pass. 1 normally; the intra-chapter livelock breaker
   *  restarts a chapter's sections against a re-drafted summary, and pass 2's
   *  drafts must not overwrite pass 1's. */
  readonly pass: number;
  /** The run-state attempt id this draft was produced under, so a record can be
   *  joined to its row in `attempts.jsonl`. */
  readonly attemptId: string;
  readonly operationId: string;
  /** EVERY blocker line the gate produced, not the bounded set fed back into the
   *  next card. The truncated set is what the model was shown; the full set is what
   *  the post-mortem needs. */
  readonly blockerLines: readonly string[];
  /** The advisory findings from the same gate run. They block nothing, and they are
   *  routinely the reason a blocker exists. */
  readonly advisoryLines: readonly string[];
  /** Absent on the first draft of a pass: nothing had been sent yet. */
  readonly feedback?: RejectedSectionPackFeedback;
  /** sha256 of the EXACT task card this attempt was sent. Equal to the section's
   *  cache-identity digest only on pass 1 / attempt 1, where the card carries no
   *  retry feedback and no assembly avoid-context. */
  readonly taskCardDigest: string;
  /** The raw model output, exactly as it came back and was refused. */
  readonly draft: unknown;
}

/** Diagnostics sink. Never returns a value, never gates anything. */
export type RejectedSectionPackSink = (record: RejectedSectionPackDraft) => void;

/** `chNN.<kind>.attemptK.json`, plus a `passN` segment on a livelock-breaker
 *  restart so a second pass cannot silently overwrite the first pass's record. */
export function rejectedSectionPackFileName(record: RejectedSectionPackDraft): string {
  const chapter = `ch${String(record.chapterNumber).padStart(2, "0")}`;
  const pass = record.pass > 1 ? `.pass${record.pass}` : "";
  return `${chapter}.${record.kind}${pass}.attempt${record.attempt}.json`;
}

function safeJsonText(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Serialize one rejected section pack, bounded to `maxBytes`.
 *
 * Under the cap the record is written whole. Over it, the draft is replaced by
 * TRUNCATED JSON TEXT and the record says so — `truncated: true` plus a note
 * naming the original byte size. Everything an operator reads before the draft
 * (chapter, kind, attempt, pass, ids, timestamp, every blocker and advisory line,
 * the feedback that was sent, the card digest) survives truncation intact.
 */
export function serializeRejectedSectionPack(
  record: RejectedSectionPackDraft,
  maxBytes: number = MAX_REJECTED_SECTION_PACK_BYTES,
  recordedAt: string = new Date().toISOString(),
): string {
  const head = {
    schemaVersion: "1" as const,
    chapterNumber: record.chapterNumber,
    kind: record.kind,
    attempt: record.attempt,
    pass: record.pass,
    attemptId: record.attemptId,
    operationId: record.operationId,
    recordedAt,
    blockerLines: [...record.blockerLines],
    advisoryLines: [...record.advisoryLines],
    ...(record.feedback === undefined ? {} : { feedback: record.feedback }),
    taskCardDigest: record.taskCardDigest,
  };
  const render = (body: Record<string, unknown>): string => `${JSON.stringify({ ...head, ...body }, null, 2)}\n`;
  const whole = render({ draft: record.draft });
  if (Buffer.byteLength(whole, "utf8") <= maxBytes) return whole;

  const draftJson = safeJsonText(record.draft);
  const originalBytes = Buffer.byteLength(draftJson, "utf8");
  const build = (chars: number): string => render({
    truncated: true,
    note: `draft truncated to ${chars} characters; ${originalBytes} bytes of JSON were produced`,
    draftJsonTruncated: draftJson.slice(0, chars),
  });
  // Halve until it fits. Bounded (a JSON string escapes to at most ~6 bytes per
  // character, so this converges in a handful of steps) and deterministic.
  let chars = Math.max(0, maxBytes);
  for (let step = 0; step < 32 && chars > 0; step += 1) {
    const text = build(chars);
    if (Buffer.byteLength(text, "utf8") <= maxBytes) return text;
    chars = Math.floor(chars / 2);
  }
  return build(0);
}

/**
 * The production sink: write one record into `<runDir>/rejected/`, through the
 * SAME atomic writer the run record and the attempt journal use.
 *
 * Best effort by construction. A diagnostics record that cannot be written is
 * logged and dropped, never thrown: the compile has already judged this draft, and
 * the operator needs the gate's verdict rather than a filesystem error standing in
 * front of it.
 */
export function createRejectedSectionPackWriter(
  runDir: string,
  log: (message: string) => void = (message) => console.error(message),
  now: () => Date = () => new Date(),
): RejectedSectionPackSink {
  return (record) => {
    const name = rejectedSectionPackFileName(record);
    try {
      mkdirSync(resolve(runDir, REJECTED_SECTION_PACKS_DIR), { recursive: true });
      writeFileAtomic(
        resolve(runDir, REJECTED_SECTION_PACKS_DIR, name),
        serializeRejectedSectionPack(record, MAX_REJECTED_SECTION_PACK_BYTES, now().toISOString()),
      );
      log(
        `[book-run] compiler chapter=${record.chapterNumber} kind=${record.kind} action=PERSIST_REJECTED_SECTION_PACK`
        + ` file=${REJECTED_SECTION_PACKS_DIR}/${name} blockers=${record.blockerLines.length} advisories=${record.advisoryLines.length}`,
      );
    } catch (error) {
      log(
        `[book-run] compiler chapter=${record.chapterNumber} kind=${record.kind} action=PERSIST_REJECTED_SECTION_PACK_FAILED`
        + ` file=${REJECTED_SECTION_PACKS_DIR}/${name} detail=${(error as Error).message}`,
      );
    }
  };
}
