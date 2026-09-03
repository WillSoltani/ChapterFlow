/**
 * Voice bible — the per-book voice contract, compiled for authoring prompts.
 *
 * The editor-in-chief brief (state/briefs/<bookId>.brief.json) already
 * carries a voiceCharter, specimens, and forbiddenMoves, but until Phase 5
 * nothing surfaced them to the parallel Codex authors — every agent invented
 * its own register, and book-gate caught the drift after the fact. This
 * compiles the charter into a compact block fanout pastes into every
 * chapter prompt, so voice is set BEFORE authoring (same prevention pattern
 * as the name plan and the scene-shape plan).
 *
 * Returns null when no brief exists or the charter is a stub — fanout omits
 * the block rather than pasting empty scaffolding.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import type { BookBrief } from "../types.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src/lib
const BRIEFS_DIR = resolve(__dirname, "../../state/briefs");

export function loadBrief(bookId: string): BookBrief | null {
  // Two brief shapes exist on disk: <bookId>.brief.json (the generate-book
  // flow — only ~6 books) and <bookId>.manual-brief.json (the documented
  // no-API operator flow — the other ~113, all carrying full charters).
  // Reading only the former made the voice bible inert for the production
  // catalog (verified 2026-06-10).
  for (const name of [`${bookId}.brief.json`, `${bookId}.manual-brief.json`]) {
    const p = resolve(BRIEFS_DIR, name);
    if (!existsSync(p)) continue;
    try {
      return JSON.parse(readFileSync(p, "utf8")) as BookBrief;
    } catch {
      continue;
    }
  }
  return null;
}

// ── Voice-move sanitizer (P1 / Finding F-01) ────────────────────────────────
//
// A brief's `voiceCharter.signatureMoves` are supposed to teach HOW a book sounds
// (register, cadence, person, diction) — never WHAT machinery to build. But the
// bibliography agent harvests "signature moves" from the source, and for a book
// like start-with-why those moves literally MANDATE the exact body devices the
// content-device deal (contentDeviceDeal.ts) bans in every chapter: "opens with
// recognizable … cases", "turns a case into a … three-part distinction such as
// WHY, HOW, and WHAT", "returns to Apple, the Wright brothers … as recurring
// reference points". Because the derived manual brief is re-written from the frozen
// TOC on every `derive-artifacts` (auto-run by book-gate + the QC entry), those
// mandates flow — via the `do:` line below and the voice card — into EVERY writer/
// repair prompt, in the same card that bans them. A one-off hand-edit of the brief
// gets reverted by the next re-derivation.
//
// This sanitizer is the durable fix: it classifies each signature move by SHAPE
// (never by book vocabulary) and strips the content-DEVICE mandates while keeping
// genuine register/style guidance. It runs at the choke point (formatVoiceBible),
// so no matter how many times the brief is re-derived, a device mandate never
// reaches a prompt. Style moves — register, cadence, second-person tests,
// diction, contrast-of-tone — pass through untouched. `avoidMoves` are NEVER fed
// through here (an avoid-rule is always kept verbatim).

type VoiceMoveShape = {
  /** Stable id for the device family this shape represents (mirrors ContentDeviceId
   *  where they overlap), used in the `stripped`-diff explanations. */
  id: string;
  /** Matches the MANDATE SHAPE, not any specific book's nouns. */
  rx: RegExp;
};

/** Shape table — a signature move matching ANY row is a content-device mandate and
 *  is stripped. Each row is deliberately narrow: it keys on the imperative SHAPE
 *  ("opens on a recognizable case", "turn a case into a three-part split") and
 *  requires a device signal, so generic style guidance ("open with a concrete
 *  scene", "make each abstract claim concrete") never matches. See the red-team
 *  fixtures in tests/voice-moves-sanitizer.test.ts. */
const DEVICE_MANDATE_SHAPES: VoiceMoveShape[] = [
  // opens-on-a-RECOGNIZABLE-case (not generic "open with a concrete scene/question/
  // the reader's own moment" — those are the anti-template alternatives we WANT).
  {
    id: "named-anchor-lead",
    rx: /\bopen(?:s|ing)?\b[^.]*?\b(?:with|on|each chapter|every chapter)\b[^.]*?\b(?:recogniz\w+|familiar|famous|well[- ]known|iconic|marquee|household|notable|big[- ]name|brand[- ]name|the same\b|named (?:compan|brand|case|figure|founder)|compan(?:y|ies)|corporation|founder|brand|business,?\s*aviation)\b/i,
  },
  // turn-a-case-into-an-N-part-framework reflex (WHY/HOW/WHAT-style triads, golden
  // circle, "reduce it to a three-part split").
  {
    id: "three-part-split",
    rx: /\bthree[- ]part\b|\btwo[- ]part\b|\bfour[- ]part\b|\b\w+[- ]part (?:split|distinction|frame|framework|structure|model|breakdown)\b|\btriad\b|\bgolden circle\b|\bwhy[,/ ]+how[,/ ]+(?:and )?what\b|\b(?:turn|split|break|reduce|divide|distill)(?:s|ing)?\b[^.]*?\binto\b[^.]*?\b(?:distinction|framework|split|parts|pillars|model|steps|stages|buckets)\b/i,
  },
  // recurring-named-anchor mandate ("returns to X, Y, Z as recurring reference
  // points"; "keeps coming back to … as touchstones throughout").
  {
    id: "recurring-anchor",
    rx: /\b(?:returns?|revisit(?:s|ing)?|recur(?:s|ring)?|reuse(?:s|d|ing)?|comes? back to|keeps? (?:returning|coming back))\b[^.]*?\b(?:recurring|reference point|touchstone|running example|throughout|again and again|anchor point)\b|\bas (?:a |the )?(?:recurring|running|repeated) (?:reference|anchor|touchstone|example|motif|character)s?\b|\brecurring (?:reference point|touchstone|anchor|example|character)s?\b/i,
  },
  // invented proxy-cast mandate ("follows an invented character", "a composite
  // persona carries the lesson").
  {
    id: "proxy-cast",
    rx: /\b(?:invent(?:s|ed|ing)?|fictional|made[- ]up|composite|stand[- ]in|proxy)\b[^.]*?\b(?:character|cast|protagonist|figure|persona|proxy|people|person|name)s?\b|\b(?:recurring|named) (?:proxy|stand[- ]in|persona)\b/i,
  },
  // return-proof / receipt-close mandate ("closes on a proof that comes back / a
  // receipt / a return-point / a reversal that pays off the opening").
  {
    id: "return-proof",
    rx: /\breturn[- ]?proof\b|\breturn[- ]?point\b|\breceipt\b|\bproof (?:that )?(?:returns|comes back|must come back|travels back|is owed|is due)\b|\b(?:close|end|finish|land|wrap)(?:s|es|ing)? (?:each chapter |every chapter )?on (?:a )?(?:proof|receipt|return[- ]point|reversal)\b/i,
  },
  // second-setting "it travels" mandate ("always add a second case that proves it
  // travels", "a third edge case bounds it").
  {
    id: "second-setting",
    rx: /\b(?:second|another|a further|a third)\b[^.]*?\b(?:setting|case|example|story|company|scene|city|team)\b[^.]*?\b(?:travel|prove|show|generaliz|bound|edge)|\bit travels\b|\bproves? it travels\b|\bshows? it (?:travels|generalizes)\b/i,
  },
];

/** The device family a signature move mandates, or null if it is style guidance.
 *  Pure; SHAPE-based (no book vocabulary). Exported for the red-team fixtures. */
export function classifyVoiceMove(move: string): string | null {
  if (typeof move !== "string") return null;
  for (const shape of DEVICE_MANDATE_SHAPES) {
    if (shape.rx.test(move)) return shape.id;
  }
  return null;
}

/** Partition a book's signatureMoves into style guidance to KEEP and content-device
 *  mandates to STRIP. `stripped` is the explainability surface (P1 requirement 2):
 *  callers can render it into a gate-time diff. NEVER call this on `avoidMoves`. */
export function sanitizeVoiceMoves(moves: string[]): { kept: string[]; stripped: string[] } {
  const kept: string[] = [];
  const stripped: string[] = [];
  for (const move of moves ?? []) {
    if (typeof move !== "string" || !move.trim()) continue;
    if (classifyVoiceMove(move)) stripped.push(move);
    else kept.push(move);
  }
  return { kept, stripped };
}

/** Catalog-wide plainness floor (2026-06-11 product direction): applies to EVERY
 *  register — clinical stays precise, warm stays warm, but all of them explain in
 *  plain words. Exported so the voice card can reserve its words against the card's
 *  word budget instead of dropping it as overflow (R-006). */
export const VOICE_PLAINNESS_FLOOR_LINE =
  "always: plain language beats abstraction — follow every abstract claim with something the reader can SEE (a person, a scene, a number) within two sentences; say it like you'd say it to a smart friend; define terms-of-art in everyday words on first use (STEP-2 R2.7)";

/** Compact, paste-able voice block for an authoring prompt, or null when the
 *  brief is absent/stub (no charter register → nothing worth pinning). */
export function formatVoiceBible(bookId: string): string | null {
  const brief = loadBrief(bookId);
  const charter = brief?.voiceCharter;
  if (!charter?.register) return null;
  const lines: string[] = [];
  lines.push(
    `voice: ${charter.register}, ${charter.person ?? "second"}-person, ${charter.cadence ?? "medium"} cadence`,
  );
  // P1 (F-01): strip content-device mandates BEFORE the 3-move budget so a mandate
  // never consumes a slot a real style move could use, and never reaches the prompt.
  const moves = sanitizeVoiceMoves(charter.signatureMoves ?? []).kept.slice(0, 3);
  if (moves.length > 0) lines.push(`do: ${moves.join("; ")}`);
  const avoid = [...(charter.avoidMoves ?? []), ...(brief?.forbiddenMoves ?? [])].slice(0, 5);
  if (avoid.length > 0) lines.push(`never: ${avoid.join("; ")}`);
  const specimen = (brief?.voiceSpecimens ?? [])[0];
  if (specimen) lines.push(`sounds like: "${String(specimen).slice(0, 140)}"`);
  // Catalog-wide plainness floor: appended here so every fanout prompt carries it
  // regardless of which charter is in play. The voice card RESERVES its words up
  // front (voiceCard.ts withGuard) so the budget can never drop it.
  lines.push(VOICE_PLAINNESS_FLOOR_LINE);
  return lines.join("\n    ");
}
