/**
 * publish-to-live — the sandbox→live bridge (v24 component A3).
 *
 * This pipeline is a standalone sandbox with its OWN `book-packages/` dir
 * (REPO_ROOT/book-packages). The live web app bundles the OUTER checkout
 * root's git-tracked `book-packages/*.v21.json` (imported by
 * `<outer>/lib/bookPackages.ts`). `publish-after-qc` promotes to the SANDBOX
 * catalog only and its commit plan refuses repo-root files ("staged file
 * outside publish plan") — so no regenerated book could reach live. This verb
 * is that missing bridge, fail-closed at every step:
 *
 *   (a) local package exists under the sandbox REPO_ROOT
 *   (b) it passes the existing production verifier (verifyProductionPackage)
 *   (c) copy to <outerRoot>/book-packages/<id>.v21.json + byte-hash verify
 *   (d) read-only registration probe of <outerRoot>/lib/bookPackages.ts
 *   (e) optional --commit: stage + commit ONLY that one file in the outer
 *       repo (pathspec commit, so other staged work is untouched). NEVER
 *       pushes. Refuses if the destination file is already staged/dirty from
 *       other work (checked BEFORE the copy, so we never clobber it).
 *
 * Default is report-only: steps (a)–(d) run, the commit is printed as a plan.
 *
 * ADDITIVE ONLY — this module is reached exclusively via the new
 * `publish-to-live` CLI verb and its tests. It does not touch promote/publish
 * code paths, and it never writes into any state/ dir.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { MONOREPO_ANCESTOR, REPO_ROOT, normSlug } from "../lib/chapterPaths.js";
// `import type` is erased at compile time, so the real module is still loaded
// lazily (inside makeDefaultVerify) exactly as before.
import type { PreflightOutcome } from "./candidatePreflight.js";

export type PublishToLiveOptions = {
  /** Live checkout root. Default: the pipeline's outer-checkout ancestor
   *  (MONOREPO_ANCESTOR from chapterPaths — six levels above src/lib). */
  outerRoot?: string;
  /** Stage + commit the copied package in the outer repo. Default false (report-only). */
  commit?: boolean;
  /** Verifier override (tests). Default runs `publishPreflightVerify` on the local
   *  package, which supplies the sidecar path explicitly and reports its strength.
   *  A seam may return a bare boolean (the pre-existing contract) or `{ ok, detail }`. */
  verify?: (pkgPath: string) => Promise<boolean | PreflightOutcome> | boolean | PreflightOutcome;
  /** Local package path override (tests — REPO_ROOT is fixed).
   *  Default: <REPO_ROOT>/book-packages/<normSlug(bookId)>.v21.json. */
  localPackagePath?: string;
  /** OPT-IN candidate-store re-verification — see publishFinal's `v25Root`. */
  v25Root?: string;
  /** Sidecar path override. Default: the path the verifier itself derives. */
  manifestPath?: string;
};

/** Re-exported so publishFinal and the CLI share ONE definition of the seam's
 *  richer return shape. `import type` is erased, so this adds no load-time edge. */
export type { PreflightOutcome } from "./candidatePreflight.js";

export type PublishToLiveResult = { ok: boolean; steps: string[]; error?: string };

export const COMMIT_TRAILER = "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>";

/** The REAL live-app registry the reader bundles. NOTE (v24 F1 fix): the probe used
 *  to check <outer>/lib/bookPackages.ts, which never exists in a real ChapterFlow
 *  checkout — so every registration probe printed UNKNOWN. The actual registry is
 *  app/book/data/bookPackages.ts (imported into the client bundle). */
export const OUTER_REGISTRY_REL = "app/book/data/bookPackages.ts";
export const OUTER_CATALOG_METADATA_REL = "app/book/data/booksCatalog.metadata.json";

export function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** A thin git wrapper (never throws): {status, stdout, stderr}, trimmed. Shared by
 *  publishToLive and publishFinal so both speak the same git dialect. */
export function gitOutcome(cwd: string, args: string[]): { status: number; stdout: string; stderr: string } {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { status: r.status ?? 1, stdout: (r.stdout ?? "").trim(), stderr: (r.stderr ?? "").trim() };
}

const git = gitOutcome;

/** realpath both sides so macOS /tmp→/private/tmp symlinks can't fake a mismatch. */
export function samePath(a: string, b: string): boolean {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return resolve(a) === resolve(b);
  }
}

/** The registration probe for a book against the OUTER live registry. Read-only.
 *  Returns a structured verdict; publishToLive maps it to a step line and
 *  publishFinal uses it to decide whether to append-register. */
export type RegistrationProbe = { state: "found" | "not-found" | "unknown"; registryPath: string };

export function probeRegistration(outerRoot: string, bookId: string): RegistrationProbe {
  const registryPath = resolve(outerRoot, OUTER_REGISTRY_REL);
  if (!existsSync(registryPath)) return { state: "unknown", registryPath };
  // Boundary-safe: match the EXACT import path the writer/register-web emits, not a bare
  // substring. A bare `.includes(bookId)` would false-positive "found" when the target id
  // is a substring of an already-registered id (e.g. probe "why" against "start-with-why",
  // or "stoic" against "the-daily-stoic") → publishFinal would then SKIP append-register and
  // the book would ship a committed package that the reader never bundles. The import-path
  // marker (`from "@/book-packages/<id>.v21.json"`) is what the register-web writer keys on.
  const src = readFileSync(registryPath, "utf8");
  const marker = `from "@/book-packages/${bookId}.v21.json"`;
  return { state: src.includes(marker) ? "found" : "not-found", registryPath };
}

function makeDefaultVerify(
  bookId: string,
  opts: PublishToLiveOptions | undefined,
): (pkgPath: string) => Promise<PreflightOutcome> {
  return async (pkgPath: string) => {
    const { publishPreflightVerify, formatPublishPreflightResult } = await import("./candidatePreflight.js");
    const result = await publishPreflightVerify({
      bookId,
      packagePath: pkgPath,
      ...(opts?.manifestPath === undefined ? {} : { manifestPath: opts.manifestPath }),
      ...(opts?.v25Root === undefined ? {} : { v25Root: opts.v25Root }),
    });
    if (!result.ok) console.error(formatPublishPreflightResult(result));
    return { ok: result.ok, detail: result.detail };
  };
}

export async function publishToLive(bookId: string, opts?: PublishToLiveOptions): Promise<PublishToLiveResult> {
  const steps: string[] = [];
  const fail = (error: string): PublishToLiveResult => ({ ok: false, steps, error });

  const id = normSlug(bookId);
  if (!id) return fail(`invalid bookId: "${bookId}"`);
  const relPath = `book-packages/${id}.v21.json`;

  // (a) local sandbox package must exist.
  const localPath = opts?.localPackagePath ?? resolve(REPO_ROOT, "book-packages", `${id}.v21.json`);
  if (!existsSync(localPath)) {
    return fail(`local package missing: ${localPath} — run publish-after-qc / promote-book first`);
  }
  steps.push(`local package: ${localPath}`);

  // (b) production verification — fail-closed before anything is copied.
  const verify = opts?.verify ?? makeDefaultVerify(id, opts);
  let outcome: boolean | PreflightOutcome;
  try {
    outcome = await verify(localPath);
  } catch (err) {
    return fail(`verify threw: ${(err as Error).message}`);
  }
  const verified = typeof outcome === "boolean" ? outcome : outcome.ok;
  if (!verified) {
    return fail(`verify: FAIL — production verifier rejected ${localPath}; nothing was copied`);
  }
  // A boolean seam keeps the original "verify: PASS" wording verbatim; the default
  // preflight names the strength it ran at so a replay is never read as a re-verify.
  steps.push(typeof outcome === "boolean" ? "verify: PASS" : `verify: PASS — ${outcome.detail}`);

  const outerRoot = opts?.outerRoot ?? MONOREPO_ANCESTOR;
  const destPath = resolve(outerRoot, "book-packages", `${id}.v21.json`);

  // (e-pre) refuse BEFORE copying if the outer repo already has that file
  // staged/dirty from other work — copying first would clobber it and make
  // "dirty from elsewhere" indistinguishable from our copy. This refusal is
  // ALWAYS-ON (report-only mode overwrites the dest file too, so it needs the
  // same protection); the git-tree/toplevel requirements stay --commit-only so
  // report-only runs against non-git outer roots (tests, dry-runs) still work.
  const inside = git(outerRoot, ["rev-parse", "--is-inside-work-tree"]);
  const outerIsGit = inside.status === 0 && inside.stdout === "true";
  if (opts?.commit) {
    if (!outerIsGit) {
      return fail(`--commit requested but outer root is not a git work tree: ${outerRoot}`);
    }
    const toplevel = git(outerRoot, ["rev-parse", "--show-toplevel"]);
    if (toplevel.status !== 0 || !samePath(toplevel.stdout, outerRoot)) {
      return fail(
        `--commit requested but outer root is not the git toplevel (toplevel=${toplevel.stdout || "?"}, outerRoot=${outerRoot}) — refusing to commit into an enclosing repo`,
      );
    }
  }
  if (outerIsGit) {
    const dirty = git(outerRoot, ["status", "--porcelain", "--", relPath]);
    if (dirty.status !== 0) {
      return fail(`git status failed in ${outerRoot}: ${dirty.stderr || dirty.stdout}`);
    }
    if (dirty.stdout !== "") {
      return fail(
        `refusing to overwrite: ${relPath} is already staged/dirty in the outer tree (${dirty.stdout.split("\n")[0]}) — reconcile that change first`,
      );
    }
  }

  // (c) copy + independent byte-hash comparison.
  try {
    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(localPath, destPath);
  } catch (err) {
    return fail(`copy failed: ${(err as Error).message}`);
  }
  steps.push(`copy: ${destPath}`);
  const srcHash = sha256File(localPath);
  const destHash = sha256File(destPath);
  if (srcHash !== destHash) {
    return fail(`hash mismatch after copy: src sha256 ${srcHash} != dest sha256 ${destHash} — do NOT ship ${destPath}`);
  }
  steps.push(`hash: MATCH (sha256 ${srcHash.slice(0, 12)}…)`);

  // (d) registration probe — read-only; the live app only bundles packages
  // imported by <outer>/app/book/data/bookPackages.ts (the REAL registry — the old
  // lib/bookPackages.ts probe never existed in a real checkout, so it always UNKNOWN'd).
  const probe = probeRegistration(outerRoot, id);
  if (probe.state === "unknown") {
    steps.push(`registration: UNKNOWN — ${probe.registryPath} not found (outer root may not be a ChapterFlow checkout)`);
  } else if (probe.state === "found") {
    steps.push("registration: FOUND");
  } else {
    steps.push(
      "registration: NOT FOUND — manual steps: add import in app/book/data/bookPackages.ts + run generate-catalog-metadata + commit",
    );
  }

  // (e) commit — only on request; default is a report-only plan. NEVER pushes.
  if (!opts?.commit) {
    steps.push(`commit: SKIPPED (report-only) — plan: cd ${outerRoot} && git add -- ${relPath} && git commit`);
    return { ok: true, steps };
  }

  const postCopy = git(outerRoot, ["status", "--porcelain", "--", relPath]);
  if (postCopy.status !== 0) {
    return fail(`git status failed in ${outerRoot}: ${postCopy.stderr || postCopy.stdout}`);
  }
  if (postCopy.stdout === "") {
    steps.push("commit: SKIPPED (outer tree already has identical content committed)");
    return { ok: true, steps };
  }
  const add = git(outerRoot, ["add", "--", relPath]);
  if (add.status !== 0) {
    return fail(`git add failed: ${add.stderr || add.stdout}`);
  }
  // Pathspec commit: commits ONLY this file even if unrelated work is staged.
  const commit = git(outerRoot, [
    "commit",
    "-m",
    `chore(books): publish ${id} package to live catalog`,
    "-m",
    COMMIT_TRAILER,
    "--",
    relPath,
  ]);
  if (commit.status !== 0) {
    return fail(`git commit failed: ${commit.stderr || commit.stdout}`);
  }
  const head = git(outerRoot, ["rev-parse", "--short", "HEAD"]);
  steps.push(`commit: ${head.status === 0 ? head.stdout : "HEAD"} ${relPath} (NOT pushed — push is manual)`);
  return { ok: true, steps };
}

export type BridgeResult =
  | { ok: true; srcHash: string; destHash: string; relPath: string; destPath: string; bytes: number }
  | { ok: false; error: string };

/**
 * The sandbox→outer package bridge, factored out so publish-final can reuse the
 * exact copy + INDEPENDENT sha256 byte-compare publishToLive performs (no
 * duplication). Copies <localPath> to <outerRoot>/book-packages/<id>.v21.json and
 * proves the two files are byte-identical by hashing each side separately. Does NOT
 * commit, push, register, or probe. Refuses BEFORE copying if the dest is already
 * staged/dirty in the outer tree (so an in-flight edit is never clobbered).
 */
export function bridgePackage(bookId: string, localPath: string, outerRoot: string): BridgeResult {
  const id = normSlug(bookId);
  if (!id) return { ok: false, error: `invalid bookId: "${bookId}"` };
  const relPath = `book-packages/${id}.v21.json`;
  if (!existsSync(localPath)) return { ok: false, error: `local package missing: ${localPath}` };

  const destPath = resolve(outerRoot, "book-packages", `${id}.v21.json`);

  // Refuse BEFORE copying if the dest is already staged/dirty from other work.
  const inside = gitOutcome(outerRoot, ["rev-parse", "--is-inside-work-tree"]);
  if (inside.status === 0 && inside.stdout === "true") {
    const dirty = gitOutcome(outerRoot, ["status", "--porcelain", "--", relPath]);
    if (dirty.status !== 0) return { ok: false, error: `git status failed in ${outerRoot}: ${dirty.stderr || dirty.stdout}` };
    if (dirty.stdout !== "") {
      return { ok: false, error: `refusing to overwrite: ${relPath} is already staged/dirty in the outer tree (${dirty.stdout.split("\n")[0]}) — reconcile that change first` };
    }
  }

  try {
    mkdirSync(dirname(destPath), { recursive: true });
    copyFileSync(localPath, destPath);
  } catch (err) {
    return { ok: false, error: `copy failed: ${(err as Error).message}` };
  }
  const srcHash = sha256File(localPath);
  const destHash = sha256File(destPath);
  if (srcHash !== destHash) {
    return { ok: false, error: `hash mismatch after copy: src sha256 ${srcHash} != dest sha256 ${destHash} — do NOT ship ${destPath}` };
  }
  let bytes = 0;
  try { bytes = readFileSync(destPath).length; } catch { /* ignore */ }
  return { ok: true, srcHash, destHash, relPath, destPath, bytes };
}
