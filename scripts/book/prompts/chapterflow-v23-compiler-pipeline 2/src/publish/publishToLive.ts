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

export type PublishToLiveOptions = {
  /** Live checkout root. Default: the pipeline's outer-checkout ancestor
   *  (MONOREPO_ANCESTOR from chapterPaths — six levels above src/lib). */
  outerRoot?: string;
  /** Stage + commit the copied package in the outer repo. Default false (report-only). */
  commit?: boolean;
  /** Verifier override (tests). Default runs verifyProductionPackage on the local package. */
  verify?: (pkgPath: string) => Promise<boolean> | boolean;
  /** Local package path override (tests — REPO_ROOT is fixed).
   *  Default: <REPO_ROOT>/book-packages/<normSlug(bookId)>.v21.json. */
  localPackagePath?: string;
};

export type PublishToLiveResult = { ok: boolean; steps: string[]; error?: string };

const COMMIT_TRAILER = "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>";

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function git(cwd: string, args: string[]): { status: number; stdout: string; stderr: string } {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { status: r.status ?? 1, stdout: (r.stdout ?? "").trim(), stderr: (r.stderr ?? "").trim() };
}

/** realpath both sides so macOS /tmp→/private/tmp symlinks can't fake a mismatch. */
function samePath(a: string, b: string): boolean {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return resolve(a) === resolve(b);
  }
}

async function defaultVerify(pkgPath: string): Promise<boolean> {
  // Programmatic reuse of the exact function the CLI's verify-production-package
  // verb calls (same single-option invocation: { packagePath }).
  const { verifyProductionPackage } = await import("../verifyProductionPackage.js");
  return verifyProductionPackage({ packagePath: pkgPath }).ok;
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
  const verify = opts?.verify ?? defaultVerify;
  let verified = false;
  try {
    verified = await verify(localPath);
  } catch (err) {
    return fail(`verify threw: ${(err as Error).message}`);
  }
  if (!verified) {
    return fail(`verify: FAIL — production verifier rejected ${localPath}; nothing was copied`);
  }
  steps.push("verify: PASS");

  const outerRoot = opts?.outerRoot ?? MONOREPO_ANCESTOR;
  const destPath = resolve(outerRoot, "book-packages", `${id}.v21.json`);

  // (e-pre) when a commit is requested, refuse BEFORE copying if the outer repo
  // already has that file staged/dirty from other work — copying first would
  // clobber it and make "dirty from elsewhere" indistinguishable from our copy.
  if (opts?.commit) {
    const inside = git(outerRoot, ["rev-parse", "--is-inside-work-tree"]);
    if (inside.status !== 0 || inside.stdout !== "true") {
      return fail(`--commit requested but outer root is not a git work tree: ${outerRoot}`);
    }
    const toplevel = git(outerRoot, ["rev-parse", "--show-toplevel"]);
    if (toplevel.status !== 0 || !samePath(toplevel.stdout, outerRoot)) {
      return fail(
        `--commit requested but outer root is not the git toplevel (toplevel=${toplevel.stdout || "?"}, outerRoot=${outerRoot}) — refusing to commit into an enclosing repo`,
      );
    }
    const dirty = git(outerRoot, ["status", "--porcelain", "--", relPath]);
    if (dirty.status !== 0) {
      return fail(`git status failed in ${outerRoot}: ${dirty.stderr || dirty.stdout}`);
    }
    if (dirty.stdout !== "") {
      return fail(
        `refusing to commit: ${relPath} is already staged/dirty in the outer tree (${dirty.stdout.split("\n")[0]}) — reconcile that change first`,
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
  // imported by <outer>/lib/bookPackages.ts.
  const registryPath = resolve(outerRoot, "lib", "bookPackages.ts");
  if (!existsSync(registryPath)) {
    steps.push(`registration: UNKNOWN — ${registryPath} not found (outer root may not be a ChapterFlow checkout)`);
  } else if (readFileSync(registryPath, "utf8").includes(id)) {
    steps.push("registration: FOUND");
  } else {
    steps.push(
      "registration: NOT FOUND — manual steps: add import in lib/bookPackages.ts + run generate-catalog-metadata + commit",
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
