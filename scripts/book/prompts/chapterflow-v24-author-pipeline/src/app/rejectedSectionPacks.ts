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

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import type { SectionKind } from "../artifacts/artifactTypes.js";
import type { SectionAvoidEntry } from "../books/sectionAvoidStore.js";
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
   *  cache-identity digest only on pass 1 / attempt 1 of a round that carried no
   *  feedback in, where the card has no retry feedback and no assembly avoid-context. */
  readonly taskCardDigest: string;
  /** sha256 of the section's IDENTITY card — the feedback-free, avoid-free card the
   *  cache key is built from — regardless of what this attempt was actually sent.
   *
   *  It exists so cross-run carry-over can CHAIN. The identity check in
   *  readCarryOverRejectedDraft asks "was the previous round's draft written against
   *  these same inputs?", and reading that off `taskCardDigest` only answers for a
   *  round whose attempt 1 was sent the bare card. Once round 2 opens on round 1's
   *  draft, round 2's attempt-1 card carries a feedback block and its digest is no
   *  longer the identity digest — so round 3 would find a mismatch and start over
   *  from a blank page, which is the very failure this whole mechanism exists to
   *  stop (live: ch19 needed three rounds). Optional: a record written before this
   *  field existed falls back to `taskCardDigest`, which for those records IS the
   *  identity digest. */
  readonly identityTaskCardDigest?: string;
  /** `assemblyAvoidDigest` of the cross-chapter avoid-context THIS draft was written
   *  against — null when the section had none. It is what lets an assembly-eviction
   *  re-draft carry over: the ban set is part of the brief the draft answered, so
   *  the next round may open on the draft only while that set is unchanged.
   *
   *  Optional: a record written before this field existed cannot say what it was
   *  drafted under, and the reader treats that as unknown (carry-over stands down
   *  whenever avoid-context is in play). */
  readonly assemblyAvoidDigest?: string | null;
  /** The raw model output, exactly as it came back and was refused. */
  readonly draft: unknown;
}

/**
 * The cross-chapter avoid-context a draft was written against, as one digest.
 *
 * Carry-over across compiler runs is safe for an assembly-eviction re-draft exactly
 * when the ban set has not moved since the draft was written — see the R-285 block
 * in compilerApplicationPort. This is the comparison both sides use: the writer
 * stamps it on the record, the reader checks the record against the current one.
 *
 * Canonical by construction: entries in STORED ORDER (the store's own merge order,
 * which is what the card renders), each reduced to the five fields that reach the
 * card, an absent `rounds` normalized to null so a pre-`rounds` entry and an
 * explicit round 1 are not confused. `null` — never a digest — when the section has
 * no avoid-context at all, so "no bans" is a value the reader can compare too.
 */
export function assemblyAvoidDigest(entries: readonly SectionAvoidEntry[] | undefined): string | null {
  if (entries === undefined || entries.length === 0) return null;
  const canonical = entries.map((entry) => ({
    checkId: entry.checkId,
    phrase: entry.phrase,
    keptByChapters: [...entry.keptByChapters],
    message: entry.message,
    rounds: entry.rounds ?? null,
  }));
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
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
    ...(record.identityTaskCardDigest === undefined ? {} : { identityTaskCardDigest: record.identityTaskCardDigest }),
    ...(record.assemblyAvoidDigest === undefined ? {} : { assemblyAvoidDigest: record.assemblyAvoidDigest }),
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

/**
 * ── READING THE RECORDS BACK: cross-run carry-over ─────────────────────────────
 *
 * The records above were written as pure diagnostics. They are also, it turns
 * out, the only surviving memory of a compile round — and the 2026-09-06 Franklin
 * canary showed exactly what discarding that memory costs. A section pack gets
 * MAX_SECTION_ATTEMPTS drafts per compiler run: attempt 1 from the fresh card,
 * attempts 2-3 EDITING the rejected draft against its blocker lines. When attempt
 * 3 is still refused the run fails, the operator mints the next compile retry run,
 * and that run restarts the section at attempt 1 with NO memory of the previous
 * round — the writer starts over from a blank page. Live: ch19's example pack was
 * refused 9 times across three rounds, each round's attempt 3 one or two blockers
 * from passing (SEC133/SEC39/SEC35); ch14's summary pack reached Flesch ease 66-69
 * against a floor of 70, and the next round opened at ease ~50. Twenty operator
 * slots were spent re-deriving progress that had already been made.
 *
 * The next round's attempt 1 now OPENS on the last round's best rejected draft and
 * its blocker lines — the same retry feedback attempts 2-3 already receive inside a
 * run, carried across the run boundary. Nothing else changes: the gate is the same
 * gate, the attempt budget is the same 3, and the card for a section with no
 * carry-over is byte-for-byte the card it is today.
 *
 * The safety of that hinges on TWO preconditions, checked here rather than assumed.
 * First, the prior round's attempt-1 record carries the section's IDENTITY card digest
 * (the feedback-free, avoid-free card the cache key is built from). If it still equals
 * the digest this round computes, the blueprint, the packet, the scars and the card
 * text are all unchanged and the old draft was written against these exact inputs.
 * Second, the carried record carries the AVOID digest — the cross-chapter ban set its
 * draft was written against — and it must equal this attempt's own. A ban is part of
 * the brief a draft answered, so a draft written under a different ban set (or a
 * record too old to say which set it answered, while bans are in play) would hand the
 * writer two briefs that contradict each other. If either check fails, the old draft
 * answers a question no longer being asked, and it is dropped. Every other failure — a
 * missing file, unparseable JSON, a truncated record, a draft of the wrong artifact
 * type — drops it too.
 *
 * BEST EFFORT, like the writer: this reads diagnostics files off a disk that a
 * previous process wrote, so it returns a reason instead of throwing, and a compile
 * with no usable carry-over proceeds exactly as it does today.
 */

/** What a usable carry-over record yields: the retry feedback attempt 1 will be
 *  sent, plus the ordinal it came from (for the log line). */
export interface CarryOverRejectedDraft {
  readonly attempt: number;
  readonly blockerLines: readonly string[];
  readonly draft: Record<string, unknown>;
}

export type CarryOverRejectedDraftLookup =
  | Readonly<{ ok: true; value: CarryOverRejectedDraft }>
  | Readonly<{ ok: false; reason: string }>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `chNN.<kind>.attemptK.json` for THIS chapter and kind, pass 1 only. A `.passN`
 *  segment means the record came from a livelock-breaker restart, whose card
 *  carries a re-draft brief and whose digest is therefore not the identity digest;
 *  those records are deliberately not matched. */
function pass1RecordPattern(chapterNumber: number, kind: SectionKind): RegExp {
  const chapter = `ch${String(chapterNumber).padStart(2, "0")}`;
  const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escape(chapter)}\\.${escape(kind)}\\.attempt(\\d+)\\.json$`);
}

/**
 * Select the carry-over draft for one section from the PRECEDING compiler run's
 * `rejected/` directory.
 *
 * `taskCardDigest` is this round's identity digest for the section; `maxBlockerLines`
 * is the same bound the in-run retry loop applies to the lines it feeds back, passed
 * in rather than duplicated so the two can never drift apart.
 */
export function readCarryOverRejectedDraft(input: Readonly<{
  priorRunDir: string;
  chapterNumber: number;
  kind: SectionKind;
  taskCardDigest: string;
  /** This attempt's avoid-context digest (`assemblyAvoidDigest`), null when the
   *  section has no cross-chapter avoid-context. The carried draft must have been
   *  written against the SAME value. */
  assemblyAvoidDigest: string | null;
  maxBlockerLines: number;
}>): CarryOverRejectedDraftLookup {
  try {
    const dir = resolve(input.priorRunDir, REJECTED_SECTION_PACKS_DIR);
    if (!existsSync(dir)) return { ok: false, reason: "no-records" };
    const pattern = pass1RecordPattern(input.chapterNumber, input.kind);
    const matched = readdirSync(dir)
      .map((name) => ({ name, attempt: Number(pattern.exec(name)?.[1] ?? Number.NaN) }))
      .filter((entry) => Number.isInteger(entry.attempt) && entry.attempt >= 1)
      .sort((left, right) => left.attempt - right.attempt);
    if (matched.length === 0) return { ok: false, reason: "no-records" };
    const first = matched[0];
    if (first.attempt !== 1) return { ok: false, reason: "attempt1-missing" };

    // The IDENTITY CHECK — the one thing that makes reusing another run's draft
    // safe. An inequality means these drafts were written for different inputs.
    const parse = (name: string): Record<string, unknown> | null => {
      try {
        const value = JSON.parse(readFileSync(resolve(dir, name), "utf8")) as unknown;
        return isPlainObject(value) ? value : null;
      } catch {
        return null;
      }
    };
    const attempt1 = parse(first.name);
    if (attempt1 === null) return { ok: false, reason: "unreadable" };
    // `identityTaskCardDigest` when the writer recorded one (it survives a round that
    // itself carried feedback in, which is what lets carry-over chain across three or
    // more rounds); `taskCardDigest` for a record written before that field existed,
    // where attempt 1's card WAS the identity card.
    const priorIdentity = typeof attempt1.identityTaskCardDigest === "string"
      ? attempt1.identityTaskCardDigest
      : attempt1.taskCardDigest;
    if (priorIdentity !== input.taskCardDigest) return { ok: false, reason: "card-digest-mismatch" };

    // The HIGHEST attempt is the one to carry: it is the round's most-edited draft,
    // the one that got closest to passing.
    const last = matched[matched.length - 1];
    const record = last.name === first.name ? attempt1 : parse(last.name);
    if (record === null) return { ok: false, reason: "unreadable" };
    // The AVOID CHECK. An assembly eviction happens at assembly, which ends a run, so
    // every draft of a round was written against that round's bans — carrying one
    // forward is safe while the ban set is unchanged, and only then. A record from
    // before the field existed cannot answer the question at all, so it is usable
    // only where there are no bans to answer for.
    const recordedAvoid = record.assemblyAvoidDigest;
    if (recordedAvoid === undefined) {
      if (input.assemblyAvoidDigest !== null) return { ok: false, reason: "assembly-avoid" };
    } else if ((typeof recordedAvoid === "string" ? recordedAvoid : null) !== input.assemblyAvoidDigest) {
      return { ok: false, reason: "assembly-avoid-changed" };
    }
    if (record.truncated === true) return { ok: false, reason: "truncated" };
    const draft = record.draft;
    if (!isPlainObject(draft)) return { ok: false, reason: "draft-shape" };
    if (draft.artifactType !== input.kind) return { ok: false, reason: "artifact-type" };
    const lines = Array.isArray(record.blockerLines)
      ? record.blockerLines.filter((line): line is string => typeof line === "string")
      : [];
    if (lines.length === 0) return { ok: false, reason: "no-blocker-lines" };
    return {
      ok: true,
      value: { attempt: last.attempt, blockerLines: lines.slice(0, input.maxBlockerLines), draft },
    };
  } catch (error) {
    return { ok: false, reason: `read-failed:${(error as Error).name}` };
  }
}
