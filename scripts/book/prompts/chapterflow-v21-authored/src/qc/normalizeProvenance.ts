/**
 * normalizeChapterProvenance — repair-safe provenance hygiene.
 *
 * WHY: a surgical QC repair is run by a codex session that rewrites the chapter
 * JSON directly. A CORRUPTION-tier deep edit touches the pipeline-OWNED
 * `authoring.sourceAnchors` block and can damage it in TWO ways the
 * production-manifest gate (productionManifest.ts → PPKG.authoring_provenance_missing,
 * an EXACT-string compare on schemaVersion) then fail-closes a QC-clean book on:
 *
 *   1. RELABEL (willpower ch5): the block is complete but carries a same-family
 *      WRONG label — "source-anchor-map-v1" instead of the canonical
 *      "chapter-source-anchor-map-v1" the assembler emits. The variant string is
 *      produced NOWHERE in src; it is pure agent transcription drift.
 *   2. GUT (tiny-habits ch3): the repair DROPS the wrapper fields (schemaVersion,
 *      observedAnchorIds, sourceSidecarPath) but the real provenance —
 *      `effectiveAnchors`, the unit→anchor map — SURVIVES.
 *
 * This corrects BOTH from the chapter's own RETAINED real data — it is
 * NORMALIZATION, not fabrication:
 *   - it never invents a block where none/only-an-empty-shell exists (no
 *     effectiveAnchors → skipped → the gate fires, correctly);
 *   - RELABEL: surgically swaps the one schemaVersion token (preserving bytes),
 *     only on a structurally-complete block with a RECOGNIZED same-family label;
 *   - GUT: re-derives the dropped fields — observedAnchorIds from the anchors
 *     effectiveAnchors references, schemaVersion = the canonical constant,
 *     sourceSidecarPath from a sibling chapter's path (verified to exist) — so
 *     every value comes from retained real data or a deterministic constant;
 *   - it never touches content: `authoring` is excluded from chapterContentHash
 *     (qcAttestation.ts), so neither path can stale an attestation or trigger a
 *     re-review.
 *
 * Wired at two points: the autopilot repair loop (root-cause hygiene) and
 * publish-after-qc (the load-bearing self-heal), so a damaged block from ANY path
 * can never fail-close the publish — the conductor stays hands-off end-to-end.
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
 *  re-stamped in the RELABEL path; an unrecognized label falls through to the GUT
 *  path (reconstruct) only if effectiveAnchors survived, else the gate rejects it. */
const RECOGNIZED_VARIANT = /^(chapter-)?source-anchor-map-v\d+$/;

export type ProvenanceNormalization = {
  chapterNumber: number;
  chapterId: string;
  from: string;
  /** "relabel" = swapped a same-family schemaVersion token; "reconstruct" = re-derived gutted wrapper fields. */
  kind: "relabel" | "reconstruct";
};

const pad = (n: number): string => String(n).padStart(2, "0");

/** Anchor ids the effectiveAnchors map references (retained real data). */
function anchorsFromEffective(eff: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  for (const v of Object.values(eff)) {
    if (Array.isArray(v)) for (const x of v) if (typeof x === "string") ids.add(x);
  }
  return [...ids].sort();
}

/** Re-stamp / re-derive canonical source-anchor provenance on any of `bookId`'s
 *  chapters whose `authoring.sourceAnchors` block was damaged by a repair but whose
 *  real provenance (effectiveAnchors) survived. Returns the chapters it corrected
 *  (empty = no-op). Best-effort per chapter: a single unreadable/ambiguous file is
 *  skipped, never thrown — this runs on the hands-off publish path. */
export function normalizeChapterProvenance(bookId: string): ProvenanceNormalization[] {
  const fixed: ProvenanceNormalization[] = [];
  let chapters: ChapterV21[];
  try {
    chapters = loadBookChapters(bookId);
  } catch {
    return fixed; // a corrupt/missing chapter is the loader's / gate's problem, not ours
  }

  // For the GUT case: a sibling chapter that still carries a valid sidecar path gives
  // the path template to re-derive a gutted chapter's sourceSidecarPath.
  let sidecarTemplate: string | null = null;
  for (const c of chapters) {
    const sp = (c as unknown as { authoring?: { sourceAnchors?: { sourceSidecarPath?: unknown } } })?.authoring?.sourceAnchors?.sourceSidecarPath;
    if (typeof sp === "string" && /ch0*\d+\.source\.json$/i.test(sp)) {
      sidecarTemplate = sp;
      break;
    }
  }

  for (const ch of chapters) {
    const sa = (ch as unknown as { authoring?: { sourceAnchors?: Record<string, unknown> } })?.authoring?.sourceAnchors;
    if (!sa || typeof sa !== "object") continue; // no block at all — never fabricate; the gate's job
    const version = sa.schemaVersion;
    const hasObserved = Array.isArray(sa.observedAnchorIds) && sa.observedAnchorIds.length > 0;
    if (version === CANONICAL_SOURCE_ANCHOR_SCHEMA && hasObserved) continue; // already fully valid

    // BOTH paths require REAL retained provenance — the surviving effectiveAnchors map.
    const eff = sa.effectiveAnchors;
    const effObj = eff && typeof eff === "object" && !Array.isArray(eff) ? (eff as Record<string, unknown>) : null;
    if (!effObj || !Object.keys(effObj).length) continue; // nothing real to anchor to → never fabricate; gate fires

    const chapterId = (ch as unknown as { chapterId?: string }).chapterId ?? `${bookId}-ch${pad(ch.number)}`;
    const path = resolve(CHAPTERS_DIR, chapterFileName(chapterId));
    if (!existsSync(path)) continue;

    const hasSource = typeof sa.sourceSidecarPath === "string" || typeof sa.sourceHash === "string";

    // CASE A — RELABEL: a complete block carrying a same-family wrong label. Surgical token swap (preserve bytes).
    if (hasObserved && hasSource && typeof version === "string" && RECOGNIZED_VARIANT.test(version) && version !== CANONICAL_SOURCE_ANCHOR_SCHEMA) {
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
        const neutral = (o: unknown): string => {
          const c = structuredClone(o) as { authoring?: { sourceAnchors?: { schemaVersion?: string } } };
          if (c?.authoring?.sourceAnchors) c.authoring.sourceAnchors.schemaVersion = "•";
          return JSON.stringify(c);
        };
        if (neutral(before) !== neutral(after)) continue;
        writeFileAtomic(path, out);
        fixed.push({ chapterNumber: ch.number, chapterId, from: version, kind: "relabel" });
      } catch {
        /* best-effort: skip a file we can't rewrite */
      }
      continue;
    }

    // A COMPLETE block carrying an ALIEN (unrecognized, non-variant) schemaVersion is left untouched — it
    // may be a genuine future schema, not repair damage. Only GUTTED blocks (missing schemaVersion or
    // observedAnchorIds) — or a recognized variant CASE A couldn't surgically swap — reach the reconstruct.
    if (typeof version === "string" && hasObserved && !RECOGNIZED_VARIANT.test(version)) continue;

    // CASE B — GUT: a repair dropped the wrapper fields but effectiveAnchors survived. Re-derive them from
    // retained real data (re-read the file so we rewrite the authoritative current bytes).
    try {
      const obj = JSON.parse(readFileSync(path, "utf8")) as { authoring?: { sourceAnchors?: Record<string, unknown> } };
      const block = obj?.authoring?.sourceAnchors;
      const liveEff = block?.effectiveAnchors;
      const liveEffObj = liveEff && typeof liveEff === "object" && !Array.isArray(liveEff) ? (liveEff as Record<string, unknown>) : null;
      if (!block || !liveEffObj || !Object.keys(liveEffObj).length) continue;
      const observed = Array.isArray(block.observedAnchorIds) && block.observedAnchorIds.length > 0
        ? (block.observedAnchorIds as string[])
        : anchorsFromEffective(liveEffObj);
      if (!observed.length) continue; // effectiveAnchors referenced no anchors → nothing real to record
      let sidecar = typeof block.sourceSidecarPath === "string" && block.sourceSidecarPath ? block.sourceSidecarPath : undefined;
      if (!sidecar && sidecarTemplate) {
        const derived = sidecarTemplate.replace(/ch0*\d+\.source\.json$/i, `ch${pad(ch.number)}.source.json`);
        if (existsSync(derived)) sidecar = derived;
      }
      obj.authoring!.sourceAnchors = {
        schemaVersion: CANONICAL_SOURCE_ANCHOR_SCHEMA,
        ...(sidecar ? { sourceSidecarPath: sidecar } : {}),
        ...(typeof block.sourceHash === "string" ? { sourceHash: block.sourceHash } : {}),
        observedAnchorIds: observed,
        effectiveAnchors: liveEffObj,
      };
      writeFileAtomic(path, JSON.stringify(obj, null, 2) + "\n");
      fixed.push({ chapterNumber: ch.number, chapterId, from: typeof version === "string" ? version : "(missing)", kind: "reconstruct" });
    } catch {
      /* best-effort: skip a file we can't rewrite */
    }
  }
  return fixed;
}
