/**
 * normalizeChapterProvenance — repair-safe provenance hygiene.
 *
 * WHY (found live on the willpower run, 2026-06-25): a surgical QC repair is run
 * by a codex session that rewrites the chapter JSON directly. A CORRUPTION-tier
 * deep edit rebuilds the pipeline-OWNED `authoring.sourceAnchors` block and can
 * stamp a NON-canonical schemaVersion — observed: "source-anchor-map-v1" instead
 * of the canonical "chapter-source-anchor-map-v1" the assembler emits
 * (assembler.ts). That variant string is produced NOWHERE in src; it is pure
 * agent transcription drift. The production-manifest gate
 * (productionManifest.ts → PPKG.authoring_provenance_missing) does an EXACT-string
 * compare, so a fully QC-clean book fail-closes at publish despite carrying a
 * real, structurally-valid source-anchor map.
 *
 * This re-stamps the canonical schemaVersion on a block that is STRUCTURALLY a
 * valid chapter-source-anchor map but carries a same-family variant label. It is
 * NORMALIZATION, not fabrication:
 *   - it never invents a missing/empty block (those still fail the gate, correctly);
 *   - it only corrects a RECOGNIZED same-family label (an alien schema is left for
 *     the gate to reject — that could be a genuine schema mismatch);
 *   - it never touches content: `authoring` is excluded from chapterContentHash
 *     (qcAttestation.ts), so a re-stamp cannot stale an attestation or trigger a
 *     re-review;
 *   - it swaps exactly one quoted token and verifies (parse before/after) that
 *     ONLY sourceAnchors.schemaVersion changed, preserving the file's bytes
 *     otherwise.
 *
 * Wired at two points: the autopilot repair loop (root-cause hygiene, so on-disk
 * artifacts stay canonical between repair and publish) and publish-after-qc
 * (the load-bearing self-heal, so a mislabel from ANY path can never fail-close
 * the publish — the conductor stays hands-off end-to-end).
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import { writeFileAtomic } from "../lib/atomicWrite.js";
import { CHAPTERS_DIR, chapterFileName } from "../lib/chapterPaths.js";
import type { ChapterV21 } from "../types.js";
import { loadBookChapters } from "./manualKeyJudge.js";

/** The canonical chapter-source-anchor map schemaVersion: assembler.ts emits it,
 *  productionManifest.ts gates on it. */
export const CANONICAL_SOURCE_ANCHOR_SCHEMA = "chapter-source-anchor-map-v1";

/** A schemaVersion in the SAME schema family, just mislabeled (e.g. a repair agent
 *  dropped the "chapter-" prefix when rewriting the block). Only these are
 *  re-stamped; an unrecognized label is left untouched for the gate to reject. */
const RECOGNIZED_VARIANT = /^(chapter-)?source-anchor-map-v\d+$/;

export type ProvenanceNormalization = { chapterNumber: number; chapterId: string; from: string };

/** Re-stamp the canonical source-anchor schemaVersion on any of `bookId`'s chapters
 *  whose `authoring.sourceAnchors` block is structurally valid but carries a
 *  same-family variant label. Returns the chapters it corrected (empty = no-op).
 *  Best-effort per chapter: a single unreadable/ambiguous file is skipped, never
 *  thrown — this runs on the hands-off publish path and must never wedge it. */
export function normalizeChapterProvenance(bookId: string): ProvenanceNormalization[] {
  const fixed: ProvenanceNormalization[] = [];
  let chapters: ChapterV21[];
  try {
    chapters = loadBookChapters(bookId);
  } catch {
    return fixed; // a corrupt/missing chapter is the loader's / gate's problem, not ours
  }
  for (const ch of chapters) {
    const sa = (ch as unknown as { authoring?: { sourceAnchors?: Record<string, unknown> } })?.authoring?.sourceAnchors;
    if (!sa || typeof sa !== "object") continue; // no provenance block — gate's job, never fabricate
    const version = sa.schemaVersion;
    if (version === CANONICAL_SOURCE_ANCHOR_SCHEMA) continue; // already canonical
    if (typeof version !== "string" || !RECOGNIZED_VARIANT.test(version)) continue; // alien label — let the gate decide

    // Must be a REAL source-anchor map, not an empty shell relabeled into "valid".
    const hasSource = typeof sa.sourceSidecarPath === "string" || typeof sa.sourceHash === "string";
    const hasObserved = Array.isArray(sa.observedAnchorIds) && sa.observedAnchorIds.length > 0;
    const hasEffective = !!sa.effectiveAnchors && typeof sa.effectiveAnchors === "object";
    if (!hasSource || !hasObserved || !hasEffective) continue;

    const chapterId = (ch as unknown as { chapterId?: string }).chapterId ?? `${bookId}-ch${String(ch.number).padStart(2, "0")}`;
    const path = resolve(CHAPTERS_DIR, chapterFileName(chapterId));
    if (!existsSync(path)) continue;
    try {
      const raw = readFileSync(path, "utf8");
      const badToken = `"${version}"`;
      // Exactly one occurrence guarantees we don't touch a different schemaVersion field
      // (e.g. authoring.schemaVersion). The quoted form can't match inside the canonical
      // "chapter-source-anchor-map-v1" (its preceding char is '-', not '"').
      if (raw.split(badToken).length - 1 !== 1) continue;
      const out = raw.replace(badToken, `"${CANONICAL_SOURCE_ANCHOR_SCHEMA}"`);
      const before = JSON.parse(raw) as Record<string, unknown>;
      const after = JSON.parse(out) as { authoring?: { sourceAnchors?: { schemaVersion?: string } } };
      if (after?.authoring?.sourceAnchors?.schemaVersion !== CANONICAL_SOURCE_ANCHOR_SCHEMA) continue;
      // Belt-and-suspenders: confirm ONLY sourceAnchors.schemaVersion moved.
      const neutral = (o: unknown): string => {
        const c = structuredClone(o) as { authoring?: { sourceAnchors?: { schemaVersion?: string } } };
        if (c?.authoring?.sourceAnchors) c.authoring.sourceAnchors.schemaVersion = "•";
        return JSON.stringify(c);
      };
      if (neutral(before) !== neutral(after)) continue;
      writeFileAtomic(path, out);
      fixed.push({ chapterNumber: ch.number, chapterId, from: version });
    } catch {
      /* best-effort: skip a file we can't rewrite */
    }
  }
  return fixed;
}
