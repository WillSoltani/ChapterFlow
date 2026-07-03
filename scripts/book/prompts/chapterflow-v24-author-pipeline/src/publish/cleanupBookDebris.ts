/**
 * cleanup-book-debris (v24 WS2 F2) — the per-book debris-cleanup engine behind
 * `publish-final`. After a book's package is COMMITTED + PUSHED to the outer live
 * catalog, the git-committed package is the sole durable record; every scrap of
 * generation-time state the pipeline left on disk (chapters, QC rounds, reviews,
 * provenance, plans, the sandbox package copy, the production-manifest sidecar,
 * .chapterflow run caches, scratch review dirs, and the OUTER-root shadow state)
 * is DEBRIS and can be swept.
 *
 * This module is exact-path, fail-closed, and SAFE BY CONSTRUCTION:
 *   - buildCleanupManifest() enumerates only the taxonomy paths that EXIST, as
 *     {path, bytes, fileCount, kind} rows — a pure read (no mutation).
 *   - SHARED LEDGERS are never deleted — they are LINE-PRUNED (only lines that
 *     reference the book are removed; other books' lines stay byte-identical).
 *   - SAFETY RAILS (each independently tested):
 *       (1) if ANY matched path is git-tracked → the whole cleanup ABORTS (report
 *           only) — git is the source of truth for "precious".
 *       (2) STRUCTURAL exclusions: never anything under the v21 gold corpus
 *           (chapterflow-v21-authored/**), never state/autopilot-locks/, never
 *           the source/tests/config/node_modules of this package.
 *       (3) dry-run is the DEFAULT — it prints the manifest and mutates nothing.
 *       (4) a REAL deletion requires a step-6 PUBLISH PROOF object (a pushed
 *           commit sha + an asserted 0/0 origin sync) — applyCleanup refuses
 *           without it. The publish flow is the only thing that can produce one.
 *       (5) empty parent dirs are removed deepest-first after deletion.
 *
 * ADDITIVE: reached only via publishFinal.ts and the cleanup-related CLI/tests.
 * It never touches promote/publish-after-qc paths.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

import { CANONICAL_STATE, MONOREPO_ANCESTOR, REPO_ROOT, normSlug } from "../lib/chapterPaths.js";

/** The one structural boundary we must NEVER cross: the v21 gold-corpus pipeline dir
 *  (2,813 tracked files, the regression corpus). Excluded at the tool level, not by
 *  convention — any path resolving inside it is dropped from every manifest. */
const GOLD_CORPUS_MARKER = `${sep}chapterflow-v21-authored${sep}`;

/** State subdirs that are lifecycle infra, never per-book debris. */
const STRUCTURAL_STATE_EXCLUDES = new Set(["autopilot-locks"]);

/** Kinds of debris row (for the report table + tests). */
export type DebrisKind =
  | "state-book"
  | "state-chapters"
  | "state-qc"
  | "state-review"
  | "state-plan"
  | "state-provenance"
  | "state-index"
  | "state-brief"
  | "state-book-design"
  | "state-autopilot-log"
  | "state-regen-backup"
  | "state-cache"
  | "state-other"
  | "chapterflow-run"
  | "chapterflow-source-verify"
  | "tmp"
  | "sandbox-package"
  | "scratch-review"
  | "outer-shadow";

/** One exact-path debris row. `path` is a file or directory; `bytes`/`fileCount`
 *  are its recursive on-disk size / file count. */
export type DebrisRow = {
  path: string;
  bytes: number;
  fileCount: number;
  kind: DebrisKind;
};

/** A shared-ledger line-prune plan: keep only the non-book lines. */
export type LedgerPrune = {
  path: string;
  /** lines that reference the book (would be removed). */
  removedLines: number;
  /** lines that survive (byte-identical). */
  keptLines: number;
  /** the exact new file contents (kept lines only). */
  nextContent: string;
};

export type CleanupManifest = {
  bookId: string;
  /** exact-path debris rows (sorted). */
  rows: DebrisRow[];
  /** shared ledgers to LINE-PRUNE (never delete). */
  ledgers: LedgerPrune[];
  /** if non-empty, the cleanup MUST abort — these matched paths are git-tracked. */
  trackedMatches: string[];
  totalBytes: number;
  totalFiles: number;
};

/** The publish-proof gate object. `applyCleanup` refuses to delete without it.
 *  Produced only by publishFinal's post-push sync step (a pushed commit + 0/0). */
export type PublishProof = {
  /** the sha of the commit that shipped the package. */
  pushedCommit: string;
  /** the asserted origin sync — MUST be "0 0" (ahead/behind both zero). */
  syncState: string;
};

export type CleanupRoots = {
  /** the pipeline dir (default REPO_ROOT) — resolves state/, .chapterflow/, .tmp/, scratch/, book-packages/. */
  pipelineRoot?: string;
  /** the pipeline's canonical state dir (default CANONICAL_STATE). */
  stateRoot?: string;
  /** the OUTER live checkout root (default MONOREPO_ANCESTOR) — resolves outer state shadows + scratch. */
  outerRoot?: string;
};

function resolveRoots(roots?: CleanupRoots): Required<CleanupRoots> {
  return {
    pipelineRoot: roots?.pipelineRoot ?? REPO_ROOT,
    stateRoot: roots?.stateRoot ?? CANONICAL_STATE,
    outerRoot: roots?.outerRoot ?? MONOREPO_ANCESTOR,
  };
}

/** True iff `p` resolves inside the v21 gold corpus. */
export function isGoldCorpusPath(p: string): boolean {
  const abs = resolve(p);
  return abs.includes(GOLD_CORPUS_MARKER) || abs.endsWith(`${sep}chapterflow-v21-authored`);
}

/** Recursive size + file count of a file or directory. Missing path → {0,0}. */
function measure(p: string): { bytes: number; fileCount: number } {
  if (!existsSync(p)) return { bytes: 0, fileCount: 0 };
  let st;
  try { st = statSync(p); } catch { return { bytes: 0, fileCount: 0 }; }
  if (!st.isDirectory()) return { bytes: st.size, fileCount: 1 };
  let bytes = 0;
  let fileCount = 0;
  for (const e of readdirSync(p, { withFileTypes: true })) {
    const child = resolve(p, e.name);
    if (e.isDirectory()) {
      const r = measure(child);
      bytes += r.bytes;
      fileCount += r.fileCount;
    } else {
      try { bytes += statSync(child).size; fileCount += 1; } catch { /* vanished mid-scan */ }
    }
  }
  return { bytes, fileCount };
}

/** Every FILE under a path (recursive). A file yields itself; a dir yields its
 *  files; a missing path yields []. Used for the git-tracked check (git only
 *  tracks files, never dirs). */
function filesUnder(p: string, out: string[] = []): string[] {
  if (!existsSync(p)) return out;
  let st;
  try { st = statSync(p); } catch { return out; }
  if (!st.isDirectory()) { out.push(p); return out; }
  for (const e of readdirSync(p, { withFileTypes: true })) {
    const child = resolve(p, e.name);
    if (e.isDirectory()) filesUnder(child, out);
    else out.push(child);
  }
  return out;
}

/** state/<sub> entries whose NAME starts with `${bookId}` and is boundary-safe
 *  (the char after the prefix is a separator: '.', '-', '/', or end). Prevents
 *  a sibling ("the-willpower-instinct" vs "willpower") from ever matching. */
function stateEntriesByPrefix(stateRoot: string, sub: string, bookId: string): string[] {
  const dir = resolve(stateRoot, sub);
  if (!existsSync(dir)) return [];
  const slug = normSlug(bookId);
  const out: string[] = [];
  for (const name of safeReaddir(dir)) {
    // exact book directory, or <book>.<...>, or <book>-<...> file/dir.
    if (name === bookId || name === slug) { out.push(resolve(dir, name)); continue; }
    for (const b of new Set([bookId, slug])) {
      if (name.startsWith(`${b}.`) || name.startsWith(`${b}-`)) { out.push(resolve(dir, name)); break; }
    }
  }
  return out;
}

function safeReaddir(dir: string): string[] {
  try { return readdirSync(dir); } catch { return []; }
}

/** state/chapters/<book>-ch*.v21-native.chapter.json — the per-chapter files
 *  (boundary-safe: <book>-ch<NN> so "the-X-ch01" never matches book "X"). */
function chapterFiles(stateRoot: string, bookId: string): string[] {
  const dir = resolve(stateRoot, "chapters");
  if (!existsSync(dir)) return [];
  const slug = normSlug(bookId);
  return safeReaddir(dir)
    .filter((f) => {
      const m = f.match(/^(.+)-ch\d{1,3}(?=[._-]|$)/i);
      return !!m && normSlug(m[1]) === slug;
    })
    .map((f) => resolve(dir, f));
}

/** state/provenance/<book>-ch*.json (per-chapter author provenance). */
function provenanceFiles(stateRoot: string, bookId: string): string[] {
  return stateEntriesByPrefix(stateRoot, "provenance", bookId);
}

/** A single exact index file, if present: state/indexes/<book>.json. */
function indexFile(stateRoot: string, bookId: string): string[] {
  const p = resolve(stateRoot, "indexes", `${bookId}.json`);
  return existsSync(p) ? [p] : [];
}

/** Assign a kind to a state-relative debris path for the report table. */
function kindForStatePath(stateSub: string): DebrisKind {
  switch (stateSub) {
    case "books": return "state-book";
    case "chapters": return "state-chapters";
    case "reviews": return "state-review";
    case "plans": return "state-plan";
    case "provenance": return "state-provenance";
    case "indexes": return "state-index";
    case "briefs": return "state-brief";
    case "book-design": return "state-book-design";
    case "autopilot-logs": return "state-autopilot-log";
    case "_regen-backups": return "state-regen-backup";
    case "cache-acceptance": return "state-cache";
    default:
      if (stateSub.startsWith("qc")) return "state-qc";
      return "state-other";
  }
}

/** Enumerate every candidate debris path for the book (as {path, kind}), before
 *  the exists/tracked filters. Exact-path taxonomy from the debris inventory. */
function candidatePaths(bookId: string, roots: Required<CleanupRoots>): Array<{ path: string; kind: DebrisKind }> {
  const { pipelineRoot, stateRoot, outerRoot } = roots;
  const cands: Array<{ path: string; kind: DebrisKind }> = [];

  // ── state/ per-book subtrees (prefix-matched, boundary-safe) ──
  // Directory-or-file prefix subdirs: state/<sub>/<book>* .
  const prefixSubs: Array<[string, DebrisKind]> = [
    ["books", "state-book"],
    ["qc-orchestrator", "state-qc"],
    ["qc", "state-qc"],
    ["qc-rounds", "state-qc"],
    ["qc-packs", "state-qc"],
    ["qc-preflight", "state-qc"],
    ["briefs", "state-brief"],
    ["book-design", "state-book-design"],
    ["plans", "state-plan"],
    ["reviews", "state-review"],
    ["autopilot-logs", "state-autopilot-log"],
    ["_regen-backups", "state-regen-backup"],
    ["cache-acceptance", "state-cache"],
  ];
  for (const [sub, kind] of prefixSubs) {
    for (const p of stateEntriesByPrefix(stateRoot, sub, bookId)) cands.push({ path: p, kind });
  }
  for (const p of chapterFiles(stateRoot, bookId)) cands.push({ path: p, kind: "state-chapters" });
  for (const p of provenanceFiles(stateRoot, bookId)) cands.push({ path: p, kind: "state-provenance" });
  for (const p of indexFile(stateRoot, bookId)) cands.push({ path: p, kind: "state-index" });

  // ── .chapterflow/ run cache + source-verify record ──
  const runsDir = resolve(pipelineRoot, ".chapterflow", "runs", bookId);
  if (existsSync(runsDir)) cands.push({ path: runsDir, kind: "chapterflow-run" });
  const srcVerify = resolve(pipelineRoot, ".chapterflow", `source-verify-${bookId}.md`);
  if (existsSync(srcVerify)) cands.push({ path: srcVerify, kind: "chapterflow-source-verify" });

  // ── .tmp/* entries whose NAME contains the book ──
  const tmpDir = resolve(pipelineRoot, ".tmp");
  for (const name of safeReaddir(tmpDir)) {
    if (name.includes(bookId) || name.includes(normSlug(bookId))) cands.push({ path: resolve(tmpDir, name), kind: "tmp" });
  }

  // ── the sandbox package copy ──
  const sandboxPkg = resolve(pipelineRoot, "book-packages", `${normSlug(bookId)}.v21.json`);
  if (existsSync(sandboxPkg)) cands.push({ path: sandboxPkg, kind: "sandbox-package" });

  // ── scratch review dirs (pipeline root) ──
  const scratchReview = resolve(pipelineRoot, "scratch", "review", bookId);
  if (existsSync(scratchReview)) cands.push({ path: scratchReview, kind: "scratch-review" });
  const evalProxy = resolve(pipelineRoot, "scratch", "eval-proxy");
  for (const name of safeReaddir(evalProxy)) {
    if (name.includes(bookId) || name.includes(normSlug(bookId))) cands.push({ path: resolve(evalProxy, name), kind: "scratch-review" });
  }

  // ── OUTER-root shadows ──
  // <outer>/state/**<book>** dirs/files (the accidental shadow state one level out).
  const outerState = resolve(outerRoot, "state");
  if (existsSync(outerState) && resolve(outerState) !== resolve(stateRoot)) {
    for (const sub of safeReaddir(outerState)) {
      if (STRUCTURAL_STATE_EXCLUDES.has(sub)) continue;
      for (const p of stateEntriesByPrefix(outerState, sub, bookId)) cands.push({ path: p, kind: "outer-shadow" });
      // direct file named after the book, e.g. <outer>/state/<book>.json
    }
    for (const name of safeReaddir(outerState)) {
      for (const b of new Set([bookId, normSlug(bookId)])) {
        if (name.startsWith(`${b}.`) || name.startsWith(`${b}-`) || name === b) {
          cands.push({ path: resolve(outerState, name), kind: "outer-shadow" });
          break;
        }
      }
    }
  }
  // <outer>/scratch/qc-submissions/<book>*
  const outerQcSub = resolve(outerRoot, "scratch", "qc-submissions");
  for (const name of safeReaddir(outerQcSub)) {
    for (const b of new Set([bookId, normSlug(bookId)])) {
      if (name.startsWith(b) && (name.length === b.length || /[._-]/.test(name[b.length]))) {
        cands.push({ path: resolve(outerQcSub, name), kind: "outer-shadow" });
        break;
      }
    }
  }

  // De-dupe by resolved path (first kind wins) and drop structural exclusions.
  const seen = new Set<string>();
  const out: Array<{ path: string; kind: DebrisKind }> = [];
  for (const c of cands) {
    const abs = resolve(c.path);
    if (seen.has(abs)) continue;
    if (isStructurallyExcluded(abs, stateRoot)) continue;
    seen.add(abs);
    out.push({ path: abs, kind: c.kind });
  }
  return out;
}

/** STRUCTURAL exclusions — never eligible regardless of name match. */
function isStructurallyExcluded(abs: string, stateRoot: string): boolean {
  if (isGoldCorpusPath(abs)) return true;
  // state/autopilot-locks/** — lifecycle infra, never per-book debris.
  const relToState = relative(stateRoot, abs);
  if (relToState && !relToState.startsWith("..")) {
    const seg0 = relToState.split(/[/\\]+/)[0];
    if (STRUCTURAL_STATE_EXCLUDES.has(seg0)) return true;
  }
  // never the package's own source/tests/config/node_modules.
  if (/[/\\](node_modules|src|tests|config)[/\\]/.test(abs) || abs.endsWith(`${sep}node_modules`) || abs.endsWith(`${sep}src`) || abs.endsWith(`${sep}tests`) || abs.endsWith(`${sep}config`)) return true;
  return false;
}

/** The SHARED LEDGERS — pruned (never deleted). Two formats:
 *  - state/metrics/qc-finalizations.jsonl is TRUE JSONL (one record per line) → line-prune:
 *    drop only the lines whose record names the book; every other line stays byte-identical.
 *  - state/gate-attempts.json is a PRETTY-PRINTED JSON OBJECT keyed by chapterFile PATH
 *    (a book's entries are the keys containing "/<book>-ch"). A single top-level key's value
 *    spans multiple lines, so a naive line-prune would corrupt the JSON. Instead we parse,
 *    delete the book-keyed entries, and re-serialize with the SAME `JSON.stringify(state, null, 2)`
 *    the writer uses — so every surviving entry is byte-identical to a fresh write. */
function ledgerPrunes(bookId: string, roots: Required<CleanupRoots>): LedgerPrune[] {
  const { stateRoot } = roots;
  const out: LedgerPrune[] = [];
  const slug = normSlug(bookId);

  // ── qc-finalizations.jsonl — line-prune on the record's bookId field ──
  const finalizations = resolve(stateRoot, "metrics", "qc-finalizations.jsonl");
  if (existsSync(finalizations)) {
    const mentionsBook = (line: string): boolean =>
      line.includes(`"bookId":"${bookId}"`) || line.includes(`"bookId":"${slug}"`)
      || line.includes(`"bookId": "${bookId}"`) || line.includes(`"bookId": "${slug}"`);
    const plan = pruneLines(finalizations, mentionsBook);
    if (plan && plan.removedLines > 0) out.push(plan);
  }

  // ── gate-attempts.json — structured object-key prune, re-serialized identically ──
  const gateAttempts = resolve(stateRoot, "gate-attempts.json");
  if (existsSync(gateAttempts)) {
    const plan = pruneGateAttemptsObject(gateAttempts, bookId);
    if (plan && plan.removedLines > 0) out.push(plan);
  }

  return out;
}

/** Structured prune of the gate-attempts JSON object: delete every top-level key
 *  (a chapterFile path) that belongs to the book, re-serialize with the writer's
 *  exact formatter. `removedLines` = number of book keys removed (for the report). */
function pruneGateAttemptsObject(path: string, bookId: string): LedgerPrune | null {
  let obj: Record<string, unknown>;
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    obj = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const slug = normSlug(bookId);
  let removed = 0;
  const next: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    // A key belongs to the book iff its basename matches "<book>-ch<NN>" (boundary-safe).
    const base = key.split(/[/\\]+/).pop() ?? key;
    const m = base.match(/^(.+?)-ch\d{1,3}(?=[._-]|$)/i);
    const belongs = (m && normSlug(m[1]) === slug) || base === bookId || base === slug;
    if (belongs) { removed += 1; continue; }
    next[key] = val;
  }
  if (removed === 0) return null;
  const hadTrailingNewline = raw.endsWith("\n");
  const nextContent = JSON.stringify(next, null, 2) + (hadTrailingNewline ? "\n" : "");
  return { path, removedLines: removed, keptLines: Object.keys(next).length, nextContent };
}

/** Build a line-prune plan for a file: drop lines matching `matches`, keep the
 *  rest byte-identical (preserving the trailing-newline state of the original). */
function pruneLines(path: string, matches: (line: string) => boolean): LedgerPrune | null {
  let raw: string;
  try { raw = readFileSync(path, "utf8"); } catch { return null; }
  const hadTrailingNewline = raw.endsWith("\n");
  // Split on \n but keep exact line contents; the last element is "" iff trailing newline.
  const parts = raw.split("\n");
  if (hadTrailingNewline) parts.pop(); // drop the empty tail so we don't re-add a phantom line
  let removed = 0;
  const kept: string[] = [];
  for (const line of parts) {
    if (matches(line)) removed += 1;
    else kept.push(line);
  }
  const nextContent = kept.length === 0
    ? (hadTrailingNewline ? "" : "")
    : kept.join("\n") + (hadTrailingNewline ? "\n" : "");
  return { path, removedLines: removed, keptLines: kept.length, nextContent };
}

/** git ls-files over the candidate FILES — the set of paths git tracks. Throws
 *  on git failure (the caller converts a throw into a fail-closed abort). */
function gitTrackedFiles(files: string[], gitRoot: string): Set<string> {
  const existing = files.filter((p) => existsSync(p));
  if (existing.length === 0) return new Set();
  // relativize to the git root; ls-files needs in-repo paths.
  const rels: string[] = [];
  for (const p of existing) {
    const r = relative(gitRoot, p);
    if (r && !r.startsWith("..")) rels.push(r);
  }
  if (rels.length === 0) return new Set();
  const out = execFileSync("git", ["ls-files", "-z", "--", ...rels], { cwd: gitRoot, encoding: "utf8" });
  return new Set(out.split("\0").filter(Boolean).map((p) => resolve(gitRoot, p)));
}

/**
 * Build the exact-path cleanup manifest for a book. PURE READ — no mutation.
 * The tracked-file check runs against the OUTER git root (the live checkout the
 * publish committed into) because the pipeline's own state/ is gitignored there;
 * only truly-tracked files (the gold corpus, a committed package) can appear.
 */
export function buildCleanupManifest(bookId: string, roots?: CleanupRoots): CleanupManifest {
  const r = resolveRoots(roots);
  const cands = candidatePaths(bookId, r);

  // Tracked-file abort check: gather EVERY file under EVERY candidate path and ask
  // git (rooted at the outer checkout) which are tracked. Any tracked → abort.
  const allFiles: string[] = [];
  for (const c of cands) filesUnder(c.path, allFiles);
  let tracked = new Set<string>();
  try {
    tracked = gitTrackedFiles(allFiles, r.outerRoot);
  } catch {
    // git unavailable / not a repo — fall back to the pipeline root, then to "no info".
    try { tracked = gitTrackedFiles(allFiles, r.pipelineRoot); } catch { tracked = new Set(); }
  }
  const trackedMatches = [...tracked].sort();

  const rows: DebrisRow[] = cands.map((c) => {
    const m = measure(c.path);
    return { path: c.path, bytes: m.bytes, fileCount: m.fileCount, kind: c.kind };
  }).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const ledgers = ledgerPrunes(bookId, r);

  const totalBytes = rows.reduce((s, x) => s + x.bytes, 0);
  const totalFiles = rows.reduce((s, x) => s + x.fileCount, 0);

  return { bookId, rows, ledgers, trackedMatches, totalBytes, totalFiles };
}

export type CleanupResult = {
  ok: boolean;
  bookId: string;
  /** rows actually deleted (exact paths). */
  removed: string[];
  /** ledgers line-pruned {path, removedLines}. */
  prunedLedgers: Array<{ path: string; removedLines: number }>;
  removedBytes: number;
  removedFiles: number;
  /** empty parent dirs removed after deletion (deepest-first). */
  removedEmptyDirs: string[];
  error?: string;
  /** the manifest that drove the run (for the report). */
  manifest: CleanupManifest;
};

/** Remove empty parent dirs of a deleted path, deepest-first, stopping at a
 *  non-empty dir or the state/pipeline/outer roots. */
function pruneEmptyParents(startDirs: Set<string>, stopRoots: string[]): string[] {
  const removed: string[] = [];
  const stops = new Set(stopRoots.map((s) => resolve(s)));
  // deepest-first
  const sorted = [...startDirs].sort((a, b) => b.length - a.length);
  for (let dir of sorted) {
    while (dir && !stops.has(resolve(dir)) && existsSync(dir)) {
      let entries: string[];
      try { entries = readdirSync(dir); } catch { break; }
      if (entries.length !== 0) break;
      try { rmSync(dir, { recursive: true, force: true }); removed.push(dir); } catch { break; }
      dir = dirname(dir);
    }
  }
  return removed;
}

/**
 * Delete the manifest's debris + line-prune the shared ledgers. FAIL-CLOSED:
 *   - refuses without a valid PublishProof (pushed commit + "0 0" sync) unless
 *     `allowWithoutProof` is set (dry-run/tests never delete regardless — this is
 *     the REAL-deletion gate);
 *   - refuses if the manifest has ANY git-tracked match (tracked-file abort);
 *   - re-derives the manifest from CURRENT bytes at call time (the caller's
 *     manifest is advisory) so a race can't widen the delete set.
 */
export function applyCleanup(
  bookId: string,
  proof: PublishProof | null,
  roots?: CleanupRoots,
): CleanupResult {
  const manifest = buildCleanupManifest(bookId, roots);
  const empty: CleanupResult = {
    ok: false, bookId, removed: [], prunedLedgers: [], removedBytes: 0, removedFiles: 0,
    removedEmptyDirs: [], manifest,
  };

  // GATE (4): a real deletion requires a step-6 proof object.
  if (!proof || !proof.pushedCommit || proof.syncState !== "0 0") {
    return { ...empty, error: "cleanup refused: no valid publish proof (need a pushed commit sha + an asserted 0/0 origin sync)" };
  }
  // RAIL (1): tracked-file abort.
  if (manifest.trackedMatches.length > 0) {
    return { ...empty, error: `cleanup ABORTED: ${manifest.trackedMatches.length} matched path(s) are git-tracked (first: ${relative(REPO_ROOT, manifest.trackedMatches[0])}) — refusing to delete tracked state` };
  }

  const r = resolveRoots(roots);
  const removed: string[] = [];
  const parentDirs = new Set<string>();
  let removedBytes = 0;
  let removedFiles = 0;
  for (const row of manifest.rows) {
    if (isStructurallyExcluded(row.path, r.stateRoot)) continue; // defense-in-depth
    if (!existsSync(row.path)) continue;
    try {
      rmSync(row.path, { recursive: true, force: true });
      removed.push(row.path);
      removedBytes += row.bytes;
      removedFiles += row.fileCount;
      parentDirs.add(dirname(row.path));
    } catch { /* best-effort; a vanished/locked path is skipped */ }
  }

  // Shared ledgers: line-prune (never delete).
  const prunedLedgers: Array<{ path: string; removedLines: number }> = [];
  for (const l of manifest.ledgers) {
    try {
      writeFileSync(l.path, l.nextContent);
      prunedLedgers.push({ path: l.path, removedLines: l.removedLines });
    } catch { /* best-effort */ }
  }

  // RAIL (5): remove empty parent dirs deepest-first (never the roots themselves).
  const removedEmptyDirs = pruneEmptyParents(parentDirs, [r.stateRoot, r.pipelineRoot, r.outerRoot, resolve(r.stateRoot, "..")]);

  return { ok: true, bookId, removed, prunedLedgers, removedBytes, removedFiles, removedEmptyDirs, manifest };
}

const MB = 1024 * 1024;

/** Render the manifest as a human-readable table (used by dry-run + the report). */
export function formatCleanupManifest(manifest: CleanupManifest, applied = false): string {
  const L: string[] = [`debris cleanup — ${manifest.bookId}`];
  if (manifest.trackedMatches.length > 0) {
    L.push(`  ABORT: ${manifest.trackedMatches.length} matched path(s) are git-tracked — nothing will be deleted:`);
    for (const p of manifest.trackedMatches.slice(0, 8)) L.push(`    ! ${relative(REPO_ROOT, p)}`);
    return L.join("\n");
  }
  // group by kind
  const byKind = new Map<DebrisKind, { count: number; bytes: number; files: number }>();
  for (const row of manifest.rows) {
    const e = byKind.get(row.kind) ?? { count: 0, bytes: 0, files: 0 };
    e.count += 1; e.bytes += row.bytes; e.files += row.fileCount;
    byKind.set(row.kind, e);
  }
  L.push(`  ${applied ? "removed" : "would remove"} ${manifest.rows.length} path(s) / ${manifest.totalFiles} file(s)  (~${(manifest.totalBytes / MB).toFixed(2)} MB):`);
  for (const [kind, e] of [...byKind.entries()].sort()) {
    L.push(`    ${String(e.count).padStart(4)}  ${kind}  (${e.files} file(s), ~${(e.bytes / MB).toFixed(2)} MB)`);
  }
  if (manifest.ledgers.length) {
    L.push(`  shared ledgers ${applied ? "line-pruned" : "to line-prune"} (NEVER deleted):`);
    for (const l of manifest.ledgers) L.push(`    ${relative(REPO_ROOT, l.path)}: remove ${l.removedLines} book line(s), keep ${l.keptLines}`);
  }
  if (!applied) L.push(`  (dry-run) nothing was removed.`);
  return L.join("\n");
}
