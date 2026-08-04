/**
 * Model bake-off — shared-input freeze.
 *
 * Research and compilation happen ONCE (the existing research session + the
 * existing compile chain); this module records the exact bytes every candidate
 * will consume — chapter index, source-v2 sidecars, source packets, book
 * design, chapter briefs (json + rendered md), voice card, name bank — and the
 * per-chapter author task-card TEMPLATE hash (the card built from those inputs
 * with a fixed output-path placeholder, so it is byte-identical across
 * candidates by construction).
 *
 * verifySharedInputs() re-hashes the same list; ANY drift between freeze and
 * the end of candidate generation fails the run closed — a candidate must never
 * be compared against inputs another candidate did not see.
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

import { chapterBriefMdPath, chapterBriefPath, bookDesignPath, sourcePacketPath } from "../artifacts/artifactStore.js";
import { sourceSidecarPathFor } from "../qc/sourceV2Gate.js";
import { normSlug } from "../lib/chapterPaths.js";
import { voiceCard } from "../lib/voiceCard.js";
import {
  AUTHOR_WRITE_GATE_RETRIES,
  AUTHOR_WRITE_LEAD_DEGRADE_RETRIES,
  buildAuthorCard,
  resolveAuthorIo,
} from "../orchestrator/authorRun.js";
import type { FrozenFileV1, SharedInputsFreezeV1 } from "./types.js";
import { PIPELINE_DIR, combineHashes, pipelineRel, sha256Hex } from "./paths.js";

/** The output-path placeholder used ONLY for template hashing — never sent to a
 *  model. Proves candidate cards differ in nothing but orchestration data. */
export const CARD_OUTPUT_PLACEHOLDER = "<<BAKEOFF-OUTPUT-PATH>>";

export class SharedInputsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SharedInputsError";
  }
}

function frozenFile(absPath: string): FrozenFileV1 {
  const bytes = readFileSync(absPath);
  return { relPath: pipelineRel(absPath), sha256: sha256Hex(bytes), bytes: bytes.length };
}

/** Every shared-input file candidates consume, as absolute paths. Missing REQUIRED
 *  files throw (the compile chain has not produced them yet). */
export function collectSharedInputPaths(bookId: string, chapterNumbers: number[]): string[] {
  const slug = normSlug(bookId);
  const paths: string[] = [];
  const required = (p: string | null, what: string): void => {
    if (!p || !existsSync(p)) {
      throw new SharedInputsError(`shared input missing: ${what}${p ? ` (${p})` : ""} — run research/compile first`);
    }
    paths.push(p);
  };

  required(resolve(PIPELINE_DIR, "state", "indexes", `${slug}.json`), "chapter index");
  for (const n of chapterNumbers) {
    required(sourceSidecarPathFor(slug, n), `source-v2 sidecar ch${String(n).padStart(2, "0")}`);
    required(sourcePacketPath(slug, n), `source packet ch${String(n).padStart(2, "0")}`);
    required(chapterBriefPath(slug, n), `chapter brief ch${String(n).padStart(2, "0")}`);
    required(chapterBriefMdPath(slug, n), `rendered brief ch${String(n).padStart(2, "0")}`);
  }
  // Optional inputs — frozen when present (their absence is itself frozen state).
  for (const p of [bookDesignPath(slug), resolve(PIPELINE_DIR, "config", "name-bank.json")]) {
    if (existsSync(p)) paths.push(p);
  }
  return paths;
}

/**
 * Freeze the shared inputs + the per-chapter card template hashes.
 * `totalChapters` gates the content-device deal exactly as candidate writes will.
 */
export function freezeSharedInputs(bookId: string, chapterNumbers: number[]): SharedInputsFreezeV1 {
  if (chapterNumbers.length === 0) throw new SharedInputsError("no chapters in the index — research has not completed");
  const files = collectSharedInputPaths(bookId, chapterNumbers).map(frozenFile);

  const io = resolveAuthorIo();
  const voice = voiceCard(bookId);
  const taskCardTemplateSha256: Record<string, string> = {};
  for (const n of chapterNumbers) {
    const briefMd = io.readBriefMd(bookId, n);
    const packet = io.readPacket(bookId, n);
    if (!briefMd || !packet) {
      throw new SharedInputsError(`cannot build the ch${String(n).padStart(2, "0")} card template — brief md or packet unreadable`);
    }
    const card = buildAuthorCard({
      bookId,
      chapterNumber: n,
      totalChapters: chapterNumbers.length,
      briefMd,
      packet,
      voice,
      brief: io.readBrief(bookId, n),
      outputRelPath: CARD_OUTPUT_PLACEHOLDER,
    });
    taskCardTemplateSha256[`ch${String(n).padStart(2, "0")}`] = sha256Hex(card);
  }

  return {
    schemaVersion: "model-bakeoff-shared-inputs-v1",
    frozenAt: new Date().toISOString(),
    files,
    combinedSha256: combineHashes(files),
    taskCardTemplateSha256,
    retryBudget: { gateRetries: AUTHOR_WRITE_GATE_RETRIES, leadDegradeRetries: AUTHOR_WRITE_LEAD_DEGRADE_RETRIES },
    chapterNumbers: [...chapterNumbers],
  };
}

/** Re-hash the frozen list; returns the drift findings ([] = intact). */
export function verifySharedInputs(freeze: SharedInputsFreezeV1): string[] {
  const problems: string[] = [];
  for (const f of freeze.files) {
    const abs = resolve(PIPELINE_DIR, f.relPath);
    if (!existsSync(abs)) {
      problems.push(`frozen input missing: ${f.relPath}`);
      continue;
    }
    const now = sha256Hex(readFileSync(abs));
    if (now !== f.sha256) problems.push(`frozen input drifted: ${f.relPath} (${f.sha256.slice(0, 12)} → ${now.slice(0, 12)})`);
  }
  return problems;
}
