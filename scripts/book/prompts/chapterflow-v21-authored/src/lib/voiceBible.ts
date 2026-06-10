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
  const moves = (charter.signatureMoves ?? []).slice(0, 3);
  if (moves.length > 0) lines.push(`do: ${moves.join("; ")}`);
  const avoid = [...(charter.avoidMoves ?? []), ...(brief?.forbiddenMoves ?? [])].slice(0, 5);
  if (avoid.length > 0) lines.push(`never: ${avoid.join("; ")}`);
  const specimen = (brief?.voiceSpecimens ?? [])[0];
  if (specimen) lines.push(`sounds like: "${String(specimen).slice(0, 140)}"`);
  return lines.join("\n    ");
}
