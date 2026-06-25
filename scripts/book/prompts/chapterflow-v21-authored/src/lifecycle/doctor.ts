/**
 * doctor — one preflight that catches the workspace traps this pipeline has hit
 * before, so they fail a check instead of a generation run:
 *   - the dual state/chapters shadow dir (canonical vs repo-root divergence)
 *   - dual brief shapes for one book (.brief.json AND .manual-brief.json)
 *   - chapter-number drift (dupes/gaps that make AS5–AS12 silently skip)
 *   - untracked src/*.ts imported by tracked code (the TS2307-on-origin trap)
 * Read-only. Exit 0 = healthy, 1 = warnings, 2 = a blocking trap.
 */

import { spawnSync } from "child_process";
import { existsSync, readFileSync, readdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { assertNoShadowStateDir } from "../lib/chapterPaths.js";
import { compareChapterSetToCanonical, formatChapterSetBlockers, readCanonicalChapterIndex } from "../lib/chapterSet.js";
import { findRunArtifact } from "../lib/runDirs.js";
import { formatTocIssues, parseTocFile } from "../lib/tocContract.js";
import { loadBookChapters } from "../qc/manualKeyJudge.js";
import { loadSweepHistory } from "../qc/sweep.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PIPELINE_DIR = resolve(__dirname, "../..");
const REPO_ROOT = resolve(PIPELINE_DIR, "../../../..");
const STATE_DIR = resolve(PIPELINE_DIR, "state");
const SRC_DIR = resolve(PIPELINE_DIR, "src");
const RUNS_DIR = resolve(REPO_ROOT, ".chapterflow/runs");

export type DoctorFinding = { level: "ok" | "warn" | "fatal"; check: string; message: string };

function checkShadowStateDir(): DoctorFinding {
  try {
    assertNoShadowStateDir();
    return { level: "ok", check: "shadow-state-dir", message: "no repo-root state/chapters shadow" };
  } catch (e) {
    return { level: "fatal", check: "shadow-state-dir", message: (e as Error).message.split("\n")[0] };
  }
}

function checkDualBrief(bookId: string): DoctorFinding {
  const manual = existsSync(resolve(STATE_DIR, "briefs", `${bookId}.manual-brief.json`));
  const generated = existsSync(resolve(STATE_DIR, "briefs", `${bookId}.brief.json`));
  if (manual && generated) {
    return { level: "warn", check: "dual-brief", message: `${bookId} has BOTH .brief.json and .manual-brief.json — loadBrief reads .brief.json first; remove the stale one to avoid title/voice drift` };
  }
  return { level: "ok", check: "dual-brief", message: `${bookId} brief shape unambiguous` };
}

function checkChapterNumbers(bookId: string): DoctorFinding {
  let chapters;
  try {
    chapters = loadBookChapters(bookId);
  } catch (e) {
    return { level: "fatal", check: "chapter-parse", message: (e as Error).message };
  }
  if (chapters.length === 0) return { level: "ok", check: "chapter-numbers", message: `${bookId} has no chapters yet` };
  const seen = new Map<number, string>();
  const problems: string[] = [];
  for (const ch of chapters) {
    if (typeof ch.number !== "number" || !Number.isFinite(ch.number)) {
      problems.push(`${ch.chapterId}: number is ${JSON.stringify(ch.number)}`);
      continue;
    }
    const prior = seen.get(ch.number);
    if (prior) problems.push(`duplicate number ${ch.number} in ${prior} and ${ch.chapterId}`);
    else seen.set(ch.number, ch.chapterId);
  }
  if (problems.length > 0) {
    return { level: "fatal", check: "chapter-numbers", message: `${bookId}: ${problems.join("; ")} (intra-book checks would silently skip — run fix-chapter-ids)` };
  }
  return { level: "ok", check: "chapter-numbers", message: `${bookId}: ${chapters.length} chapters, numbers unique` };
}

function checkCanonicalChapterSet(bookId: string): DoctorFinding {
  const canonical = readCanonicalChapterIndex(bookId);
  if (!canonical.ok) {
    return { level: "fatal", check: "canonical-chapter-set", message: formatChapterSetBlockers(canonical.blockers) };
  }
  let chapters;
  try {
    chapters = loadBookChapters(bookId);
  } catch (e) {
    return { level: "fatal", check: "canonical-chapter-set", message: (e as Error).message };
  }
  const comparison = compareChapterSetToCanonical({
    bookId,
    canonical: canonical.chapters,
    actual: chapters,
    actualLabel: "state chapter files",
  });
  if (!comparison.ok) {
    return { level: "fatal", check: "canonical-chapter-set", message: formatChapterSetBlockers(comparison.blockers) };
  }
  return { level: "ok", check: "canonical-chapter-set", message: `${bookId}: state chapters exactly match canonical index (${canonical.chapters.length})` };
}

function checkTocContract(bookId: string): DoctorFinding {
  const tocPath = findRunArtifact(RUNS_DIR, bookId, "source-freeze/toc.json", {
    allowedStatuses: ["running", "failed", "coherence_failed", "complete"],
  });
  if (!tocPath) return { level: "ok", check: "toc-contract", message: `${bookId}: no research TOC on disk yet` };
  const parsed = parseTocFile(tocPath, { bookId });
  if (!parsed.ok) return { level: "fatal", check: "toc-contract", message: formatTocIssues(parsed.issues) };
  if (parsed.migration.inputShape === "canonical" && !parsed.migration.changed) {
    return { level: "ok", check: "toc-contract", message: `${bookId}: canonical TOC (${parsed.chapters.length} chapters)` };
  }
  return { level: "warn", check: "toc-contract", message: `${bookId}: TOC uses ${parsed.migration.inputShape}; run toc-migrate ${bookId} --apply` };
}

function checkSweepHistory(bookId: string): DoctorFinding {
  try {
    loadSweepHistory(bookId);
    return { level: "ok", check: "sweep-history", message: `${bookId}: immutable sweep records are reconstructable` };
  } catch (e) {
    return { level: "fatal", check: "sweep-history", message: (e as Error).message.split("\n").join(" ") };
  }
}

function checkUntrackedImports(): DoctorFinding {
  // Untracked src/*.ts that tracked code imports compile locally (tsconfig globs
  // pick them up) but fail TS2307 on a fresh origin checkout. List untracked
  // source files so a partial commit can't ship the trap.
  const r = spawnSync("git", ["ls-files", "--others", "--exclude-standard", "--", SRC_DIR], { encoding: "utf8", cwd: PIPELINE_DIR });
  if (r.status !== 0) return { level: "warn", check: "untracked-imports", message: "could not run git ls-files (skipped)" };
  const untracked = (r.stdout ?? "").split(/\r?\n/).map((f) => f.trim()).filter((f) => f.endsWith(".ts"));
  if (untracked.length === 0) return { level: "ok", check: "untracked-imports", message: "no untracked src/*.ts" };
  // Is any untracked file imported by a tracked sibling? (the actual TS2307 trap)
  const trackedSrc = (spawnSync("git", ["ls-files", "--", SRC_DIR], { encoding: "utf8", cwd: PIPELINE_DIR }).stdout ?? "")
    .split(/\r?\n/).map((f) => f.trim()).filter((f) => f.endsWith(".ts"));
  // git ls-files run with cwd=PIPELINE_DIR returns paths relative to that dir.
  const trackedContents = trackedSrc
    .map((t) => { try { return readFileSync(resolve(PIPELINE_DIR, t), "utf8"); } catch { return ""; } })
    .join("\n");
  const imported = untracked.filter((u) => {
    const base = u.replace(/.*\//, "").replace(/\.ts$/, "");
    return trackedContents.includes(`/${base}.js"`) || trackedContents.includes(`/${base}.js'`);
  });
  if (imported.length > 0) {
    return { level: "fatal", check: "untracked-imports", message: `untracked source files are imported by tracked code (origin/CI will fail TS2307): ${imported.map((u) => u.replace(/.*\/src\//, "src/")).join(", ")} — git add them` };
  }
  return { level: "warn", check: "untracked-imports", message: `${untracked.length} untracked src/*.ts (not yet imported by tracked code)` };
}

export function runDoctorChecks(bookId?: string): DoctorFinding[] {
  const findings: DoctorFinding[] = [checkShadowStateDir(), checkUntrackedImports()];
  if (bookId) {
    findings.push(checkDualBrief(bookId), checkChapterNumbers(bookId), checkCanonicalChapterSet(bookId), checkTocContract(bookId), checkSweepHistory(bookId));
  } else {
    // sweep every book's chapter-number integrity
    try {
      const books = new Set(
        readdirSync(resolve(STATE_DIR, "chapters"))
          .map((f) => f.match(/^(.+)-ch\d+\.v21-native\.chapter\.json$/i)?.[1])
          .filter((b): b is string => !!b),
      );
      for (const b of [...books].sort()) findings.push(checkChapterNumbers(b));
    } catch { /* no chapters dir */ }
  }
  return findings;
}

export function formatDoctor(findings: DoctorFinding[]): string {
  const icon = (l: DoctorFinding["level"]) => (l === "ok" ? "✓" : l === "warn" ? "⚠" : "✗");
  const fatal = findings.filter((f) => f.level === "fatal").length;
  const warn = findings.filter((f) => f.level === "warn").length;
  const L: string[] = [`DOCTOR — ${fatal} fatal, ${warn} warning(s)`];
  // Show fatals + warnings first, then a compact ok summary.
  for (const f of findings.filter((f) => f.level !== "ok")) L.push(`  ${icon(f.level)} [${f.check}] ${f.message}`);
  const oks = findings.filter((f) => f.level === "ok");
  if (oks.length) L.push(`  ✓ ${oks.length} check(s) passed`);
  return L.join("\n");
}

export function doctorExitCode(findings: DoctorFinding[]): number {
  if (findings.some((f) => f.level === "fatal")) return 2;
  if (findings.some((f) => f.level === "warn")) return 1;
  return 0;
}
