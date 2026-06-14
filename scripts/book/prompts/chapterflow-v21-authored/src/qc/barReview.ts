import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { ChapterV21 } from "../types.js";
import { CHAPTERS_DIR } from "../lib/chapterPaths.js";
import {
  attestationPath,
  chapterContentHash,
  isApprovedReviewer,
  isAttestationFresh,
  loadAttestation,
  writeAttestation,
  type QcAttestation,
  type QcVerdict,
} from "../critics/qcAttestation.js";
import {
  AXIS_RUBRIC,
  AXIS_WEIGHTS,
  computeVerdict,
  type AxisHit,
  type AxisId,
  type AxisScore,
  type FailureTier,
  type PublishableVerdict,
} from "../critics/semantic/publishableBar.js";
import { identifyQcRoundRole, loadQcRound, type QcRoundRole } from "./qcRound.js";
import { isNoApiCodexQcMode } from "./noApiMode.js";
import { keyPackDir, loadBookChapters } from "./manualKeyJudge.js";
import { checkSourceV2Gate, sourceFactsForPack, sourceHashFor, loadSourceV2Sidecar, type SourceFactForPack } from "./sourceV2Gate.js";
import { hasFreshConfirmReadArtifact, writeBarReadArtifact } from "./orchestrator/artifacts.js";

export type BarPackChapter = {
  chapterNumber: number;
  chapterId: string;
  chapterPath: string;
  contentHash: string;
  sourceHash: string | null;
  sourceFacts: SourceFactForPack[];
  chapter: unknown;
};

export type BarPack = {
  schemaVersion: "bar-pack-v1";
  bookId: string;
  roundId: string;
  createdAt: string;
  rubric: typeof AXIS_RUBRIC;
  weights: typeof AXIS_WEIGHTS;
  chapters: BarPackChapter[];
};

export type BarScoresTemplate = {
  schemaVersion: "bar-scores-v1";
  bookId: string;
  roundId: string;
  chapters: Array<{
    chapterNumber: number;
    chapterId: string;
    contentHash: string;
    sourceHash: string | null;
    notes: string;
    axes: Array<{
      axis: AxisId;
      score: number | null;
      tier: FailureTier;
      hits: AxisHit[];
      notes: string;
    }>;
  }>;
};

export type BarAttestChapterResult = {
  chapterNumber: number;
  chapterId: string;
  gate: PublishableVerdict["gate"];
  overall: number;
  verdict: QcVerdict;
  path?: string;
};

export type BarAttestResult = {
  wrote: number;
  dryRun: boolean;
  role?: QcRoundRole;
  results: BarAttestChapterResult[];
  errors: string[];
};

const AXES = Object.keys(AXIS_WEIGHTS) as AxisId[];
const TIERS: FailureTier[] = ["CORRUPTION", "GENERATED_DRAFT", "PUBLISHABLE"];

function chapterPath(bookId: string, chapterNumber: number): string {
  return resolve(CHAPTERS_DIR, `${bookId}-ch${String(chapterNumber).padStart(2, "0")}.v21-native.chapter.json`);
}

function stripReviewScaffolding(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripReviewScaffolding);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === "sourceAnchorId" || k === "planSpec") continue;
      out[k] = stripReviewScaffolding(v);
    }
    return out;
  }
  return value;
}

export function barPackPath(bookId: string, roundId: string): string {
  return resolve(keyPackDir(bookId, roundId), "bar-pack.json");
}

export function barScoresTemplatePath(bookId: string, roundId: string): string {
  return resolve(keyPackDir(bookId, roundId), "bar-scores.template.json");
}

export function buildBarScoresTemplate(pack: BarPack): BarScoresTemplate {
  return {
    schemaVersion: "bar-scores-v1",
    bookId: pack.bookId,
    roundId: pack.roundId,
    chapters: pack.chapters.map((ch) => ({
      chapterNumber: ch.chapterNumber,
      chapterId: ch.chapterId,
      contentHash: ch.contentHash,
      sourceHash: ch.sourceHash,
      notes: "",
      axes: AXES.map((axis) => ({
        axis,
        score: null,
        tier: "PUBLISHABLE",
        hits: [],
        notes: "",
      })),
    })),
  };
}

export function writeBarPack(bookId: string, roundId: string): { packPath?: string; templatePath?: string; errors: string[] } {
  if (!loadQcRound(bookId, roundId)) {
    return { errors: [`No QC round found for ${bookId} round ${roundId}. Run qc-open-round first.`] };
  }
  if (isNoApiCodexQcMode()) {
    const sourceGate = checkSourceV2Gate(bookId);
    if (!sourceGate.passed) {
      return { errors: sourceGate.findings.map((f) => `${f.checkId}${f.chapterNumber ? ` ch${f.chapterNumber}` : ""}: ${f.message}`) };
    }
  }
  const chapters = loadBookChapters(bookId);
  const pack: BarPack = {
    schemaVersion: "bar-pack-v1",
    bookId,
    roundId,
    createdAt: new Date().toISOString(),
    rubric: AXIS_RUBRIC,
    weights: AXIS_WEIGHTS,
    chapters: chapters.map((ch) => {
      const source = loadSourceV2Sidecar(bookId, ch.number);
      return {
        chapterNumber: ch.number,
        chapterId: ch.chapterId,
        chapterPath: chapterPath(bookId, ch.number),
        contentHash: chapterContentHash(ch),
        sourceHash: sourceHashFor(bookId, ch.number),
        sourceFacts: sourceFactsForPack(source),
        chapter: stripReviewScaffolding(ch),
      };
    }),
  };
  const p = barPackPath(bookId, roundId);
  const template = barScoresTemplatePath(bookId, roundId);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(pack, null, 2), "utf8");
  writeFileSync(template, JSON.stringify(buildBarScoresTemplate(pack), null, 2), "utf8");
  return { packPath: p, templatePath: template, errors: [] };
}

function loadScoresFile(path: string): any {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function verdictForGate(gate: PublishableVerdict["gate"]): QcVerdict {
  if (gate === "GREEN") return "PUBLISHABLE";
  if (gate === "YELLOW") return "REVISE";
  return "CORRUPTION";
}

function normalizeHit(raw: any): AxisHit {
  return {
    unitId: String(raw?.unitId ?? raw?.unit ?? ""),
    quote: String(raw?.quote ?? ""),
    defect: String(raw?.defect ?? ""),
  };
}

function normalizeAxis(raw: any): AxisScore {
  const tier: FailureTier = TIERS.includes(raw?.tier) ? raw.tier : "PUBLISHABLE";
  return {
    axis: raw?.axis as AxisId,
    score: Number(raw?.score),
    tier,
    hits: Array.isArray(raw?.hits) ? raw.hits.map(normalizeHit) : [],
  };
}

function findingsFor(verdict: PublishableVerdict, notes: string): string[] {
  const out: string[] = [];
  if (notes.trim()) out.push(notes.trim());
  for (const axis of verdict.axes) {
    if (axis.score < 0.6) out.push(`${axis.axis}: score ${axis.score.toFixed(2)} below publishable axis floor`);
    for (const hit of axis.hits) out.push(`${axis.axis} ${hit.unitId}: ${hit.defect} — ${hit.quote}`.slice(0, 500));
  }
  return out;
}

export function validateAndWriteBarAttestations(
  bookId: string,
  roundId: string,
  token: string,
  reviewer: string,
  scoresFile: string,
  options: { dryRun?: boolean } = {},
): BarAttestResult {
  const errors: string[] = [];
  const role = identifyQcRoundRole(bookId, roundId, token, ["bar", "attest", "confirm"]);
  if (!role) errors.push(`Invalid bar-attest token for ${bookId} round ${roundId}; expected bar, attest, or confirm token.`);
  if (!isApprovedReviewer(reviewer)) errors.push(`Reviewer "${reviewer}" is not an approved QC reviewer role.`);
  let raw: any;
  try {
    raw = loadScoresFile(scoresFile);
  } catch (err) {
    errors.push(`Could not read scores file: ${(err as Error).message}`);
    return { wrote: 0, dryRun: !!options.dryRun, role: role ?? undefined, results: [], errors };
  }
  if (raw?.bookId !== bookId) errors.push(`scores file bookId mismatch: expected ${bookId}, got ${raw?.bookId}`);
  if (raw?.roundId !== roundId) errors.push(`scores file roundId mismatch: expected ${roundId}, got ${raw?.roundId}`);
  if (!Array.isArray(raw?.chapters)) errors.push("scores file must contain chapters[]");

  const chapters = loadBookChapters(bookId);
  const byNumber = new Map<number, any>();
  for (const entry of raw?.chapters ?? []) {
    const n = Number(entry?.chapterNumber);
    if (byNumber.has(n)) errors.push(`duplicate scores entry for chapter ${n}`);
    byNumber.set(n, entry);
  }
  const extra = [...byNumber.keys()].filter((n) => !chapters.some((ch) => ch.number === n));
  if (extra.length) errors.push(`scores file includes chapter(s) not in current book: ${extra.join(", ")}`);

  const results: BarAttestChapterResult[] = [];
  const pending: Array<{ chapter: ChapterV21; verdict: PublishableVerdict; reviewerNotes: string; qcVerdict: QcVerdict }> = [];
  for (const ch of chapters) {
    const entry = byNumber.get(ch.number);
    if (!entry) {
      errors.push(`ch${ch.number}: missing scores entry`);
      continue;
    }
    if (entry.chapterId !== ch.chapterId) errors.push(`ch${ch.number}: chapterId mismatch`);
    if (entry.contentHash !== chapterContentHash(ch)) errors.push(`ch${ch.number}: contentHash mismatch; regenerate bar-pack after edits`);
    const currentSourceHash = sourceHashFor(bookId, ch.number);
    if (entry.sourceHash && entry.sourceHash !== currentSourceHash) errors.push(`ch${ch.number}: sourceHash mismatch; regenerate bar-pack after source edits`);
    if (!Array.isArray(entry.axes)) {
      errors.push(`ch${ch.number}: axes[] missing`);
      continue;
    }
    const seen = new Set<string>();
    const axes: AxisScore[] = [];
    for (const rawAxis of entry.axes) {
      const axis = rawAxis?.axis;
      if (!AXES.includes(axis)) {
        errors.push(`ch${ch.number}: unknown axis ${axis}`);
        continue;
      }
      if (seen.has(axis)) errors.push(`ch${ch.number}: duplicate axis ${axis}`);
      seen.add(axis);
      if (typeof rawAxis.score !== "number" || !Number.isFinite(rawAxis.score) || rawAxis.score < 0 || rawAxis.score > 1) {
        errors.push(`ch${ch.number}: invalid score for ${axis}`);
      }
      if (!TIERS.includes(rawAxis.tier)) errors.push(`ch${ch.number}: invalid tier for ${axis}`);
      const normalized = normalizeAxis(rawAxis);
      for (const hit of normalized.hits) {
        if (!hit.unitId || !hit.quote || !hit.defect) errors.push(`ch${ch.number}: incomplete hit for ${axis}`);
      }
      if (normalized.tier === "CORRUPTION" && normalized.hits.length === 0) errors.push(`ch${ch.number}: CORRUPTION tier on ${axis} requires at least one cited hit`);
      axes.push(normalized);
    }
    for (const axis of AXES) if (!seen.has(axis)) errors.push(`ch${ch.number}: missing axis ${axis}`);
    const verdict = computeVerdict(ch.chapterId, axes, true);
    const reviewerNotes = String(entry.notes ?? "");
    const qcVerdict = verdictForGate(verdict.gate);
    if (qcVerdict !== "PUBLISHABLE" && findingsFor(verdict, reviewerNotes).length === 0) {
      errors.push(`ch${ch.number}: ${qcVerdict} requires notes or cited hits`);
    }
    const existing = loadAttestation(bookId, ch.number);
    if (
      existing &&
      existing.verdict !== "PUBLISHABLE" &&
      qcVerdict === "PUBLISHABLE" &&
      isAttestationFresh(existing, ch)
    ) {
      errors.push(`ch${ch.number}: unchanged ${existing.verdict} attestation cannot be batch-flipped to PUBLISHABLE; repair content or use qc-attest --supersede with a specific reason`);
    }
    if (isNoApiCodexQcMode() && qcVerdict === "PUBLISHABLE" && !hasFreshConfirmReadArtifact(bookId, roundId, ch)) {
      errors.push(`ch${ch.number}: no-api PUBLISHABLE attestation requires a fresh confirm-read artifact before bar-attest can certify`);
    }
    results.push({ chapterNumber: ch.number, chapterId: ch.chapterId, gate: verdict.gate, overall: verdict.overall, verdict: qcVerdict });
    pending.push({ chapter: ch, verdict, reviewerNotes, qcVerdict });
  }
  if (errors.length > 0 || options.dryRun) {
    return { wrote: 0, dryRun: !!options.dryRun, role: role ?? undefined, results, errors };
  }

  let wrote = 0;
  for (const item of pending) {
    writeBarReadArtifact({
      schemaVersion: "qc-bar-read-v1",
      bookId,
      roundId,
      role: "bar",
      reviewer,
      chapterNumber: item.chapter.number,
      chapterId: item.chapter.chapterId,
      contentHash: chapterContentHash(item.chapter),
      sourceHash: sourceHashFor(bookId, item.chapter.number),
      axes: item.verdict.axes,
      notes: item.reviewerNotes,
      verdict: item.verdict,
    });
    const existing = loadAttestation(bookId, item.chapter.number);
    const { history: _prevHistory, ...existingSansHistory } = existing ?? {};
    const att: QcAttestation = {
      schemaVersion: "qc-attest-v1",
      bookId,
      chapterNumber: item.chapter.number,
      chapterId: item.chapter.chapterId,
      verdict: item.qcVerdict,
      contentHash: chapterContentHash(item.chapter),
      hashVersion: "v2",
      reviewer,
      reviewedAt: new Date().toISOString(),
      roundId,
      roundRole: role ?? undefined,
      dimensions: Object.fromEntries(item.verdict.axes.map((axis) => [axis.axis, axis.score >= 0.6])),
      findings: findingsFor(item.verdict, item.reviewerNotes),
      notes: `batch bar review: ${item.verdict.gate} ${item.verdict.overall}/100${item.reviewerNotes.trim() ? ` — ${item.reviewerNotes.trim()}` : ""}`,
      history: existing ? [...(existing.history ?? []), existingSansHistory as any].slice(-10) : undefined,
    };
    writeAttestation(att);
    const result = results.find((r) => r.chapterNumber === item.chapter.number);
    if (result) result.path = attestationPath(bookId, item.chapter.number);
    wrote++;
  }
  return { wrote, dryRun: false, role: role ?? undefined, results, errors: [] };
}
