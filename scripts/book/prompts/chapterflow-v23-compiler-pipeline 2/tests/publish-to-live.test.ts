/**
 * publish-to-live (v24 A3) — the sandbox→live bridge.
 *
 * Fully sandboxed: every case injects BOTH paths (opts.localPackagePath for the
 * sandbox side — REPO_ROOT is fixed — and opts.outerRoot for the live side, a
 * tmp dir; the commit cases init a REAL tmp git repo) plus a stub verify, so no
 * test ever reads or writes the repo's real book-packages/, state/, or git tree.
 *
 * Locks in the fail-closed contract:
 *  - happy path: copy + byte-hash verify + registration probe steps
 *  - missing local package → error, nothing copied
 *  - verify=false → error, nothing copied
 *  - registration NOT FOUND / UNKNOWN step wording
 *  - --commit: exactly ONE file in the commit, correct message + trailer,
 *    unrelated staged work left staged (pathspec commit)
 *  - dirty-dest refusal: pre-existing dirty dest is refused AND not clobbered
 *  - identical re-publish: commit skipped, still ok
 *  - non-git outerRoot with commit → error
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { publishToLive } from "../src/publish/publishToLive.js";

const BOOK = "zz-fixture-publish-to-live";
const PKG_CONTENT = JSON.stringify({ formatVersion: "v21", bookId: BOOK, chapters: [{ number: 1 }] }, null, 2);

function tmpRoot(label: string): string {
  return resolve(tmpdir(), `cf-v24-publish-to-live-${label}-${process.pid}-${Date.now()}`);
}

/** Build a sandboxed fixture: tmp "sandbox" package file + tmp outer root. */
function makeFixture(label: string, opts?: { registry?: string | null; git?: boolean }): {
  localPkg: string;
  outerRoot: string;
  destPkg: string;
  cleanup: () => void;
} {
  const root = tmpRoot(label);
  const sandbox = resolve(root, "sandbox");
  const outerRoot = resolve(root, "outer");
  mkdirSync(sandbox, { recursive: true });
  mkdirSync(resolve(outerRoot, "book-packages"), { recursive: true });
  const localPkg = resolve(sandbox, `${BOOK}.v21.json`);
  writeFileSync(localPkg, PKG_CONTENT);
  if (opts?.registry !== null) {
    mkdirSync(resolve(outerRoot, "lib"), { recursive: true });
    writeFileSync(resolve(outerRoot, "lib", "bookPackages.ts"), opts?.registry ?? `import pkg from "../book-packages/${BOOK}.v21.json";\n`);
  }
  if (opts?.git) {
    git(outerRoot, ["init", "-q"]);
    git(outerRoot, ["config", "user.name", "fixture"]);
    git(outerRoot, ["config", "user.email", "fixture@test"]);
    writeFileSync(resolve(outerRoot, "README.md"), "fixture outer repo\n");
    git(outerRoot, ["add", "README.md"]);
    git(outerRoot, ["commit", "-q", "-m", "init"]);
  }
  return { localPkg, outerRoot, destPkg: resolve(outerRoot, "book-packages", `${BOOK}.v21.json`), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function git(cwd: string, args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, `fixture git ${args.join(" ")} failed: ${r.stderr}`);
  return (r.stdout ?? "").trim();
}

test("happy path (report-only): verifies, copies, byte-hash matches, registration FOUND, no commit", async () => {
  const fx = makeFixture("happy");
  try {
    let verifiedPath = "";
    const result = await publishToLive(BOOK, {
      localPackagePath: fx.localPkg,
      outerRoot: fx.outerRoot,
      verify: (p) => { verifiedPath = p; return true; },
    });
    assert.equal(result.ok, true, result.error);
    assert.equal(verifiedPath, fx.localPkg, "verify must run against the LOCAL sandbox package");
    assert.equal(readFileSync(fx.destPkg, "utf8"), PKG_CONTENT, "dest must be a byte-identical copy");
    assert.ok(result.steps.some((s) => s.startsWith("verify: PASS")), `steps: ${result.steps.join(" | ")}`);
    assert.ok(result.steps.some((s) => s.startsWith(`copy: ${fx.destPkg}`)));
    assert.ok(result.steps.some((s) => s.startsWith("hash: MATCH")));
    assert.ok(result.steps.some((s) => s === "registration: FOUND"));
    assert.ok(result.steps.some((s) => s.startsWith("commit: SKIPPED (report-only)")), "default must be report-only");
  } finally {
    fx.cleanup();
  }
});

test("missing local package fails closed before verify/copy", async () => {
  const fx = makeFixture("missing");
  try {
    rmSync(fx.localPkg);
    let verifyCalled = false;
    const result = await publishToLive(BOOK, {
      localPackagePath: fx.localPkg,
      outerRoot: fx.outerRoot,
      verify: () => { verifyCalled = true; return true; },
    });
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /local package missing/);
    assert.equal(verifyCalled, false, "verify must not run for a missing package");
    assert.equal(existsSync(fx.destPkg), false, "nothing may be copied");
  } finally {
    fx.cleanup();
  }
});

test("verify=false fails closed and does NOT copy", async () => {
  const fx = makeFixture("verify-false");
  try {
    const result = await publishToLive(BOOK, {
      localPackagePath: fx.localPkg,
      outerRoot: fx.outerRoot,
      verify: () => false,
    });
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /verify: FAIL/);
    assert.equal(existsSync(fx.destPkg), false, "a rejected package must never reach the live catalog dir");
  } finally {
    fx.cleanup();
  }
});

test("registration probe: NOT FOUND emits the manual-steps line; missing registry emits UNKNOWN", async () => {
  const fxNotFound = makeFixture("reg-notfound", { registry: `// no imports here yet\n` });
  const fxUnknown = makeFixture("reg-unknown", { registry: null });
  try {
    const notFound = await publishToLive(BOOK, { localPackagePath: fxNotFound.localPkg, outerRoot: fxNotFound.outerRoot, verify: () => true });
    assert.equal(notFound.ok, true, notFound.error);
    assert.ok(
      notFound.steps.some((s) => s === "registration: NOT FOUND — manual steps: add import in lib/bookPackages.ts + run generate-catalog-metadata + commit"),
      `steps: ${notFound.steps.join(" | ")}`,
    );
    const unknown = await publishToLive(BOOK, { localPackagePath: fxUnknown.localPkg, outerRoot: fxUnknown.outerRoot, verify: () => true });
    assert.equal(unknown.ok, true, unknown.error);
    assert.ok(unknown.steps.some((s) => s.startsWith("registration: UNKNOWN")), `steps: ${unknown.steps.join(" | ")}`);
  } finally {
    fxNotFound.cleanup();
    fxUnknown.cleanup();
  }
});

test("--commit commits EXACTLY the one package file (message + trailer), leaving unrelated staged work staged", async () => {
  const fx = makeFixture("commit", { git: true });
  try {
    // Unrelated staged work in the outer tree must survive untouched (pathspec commit).
    writeFileSync(resolve(fx.outerRoot, "unrelated.txt"), "other work\n");
    git(fx.outerRoot, ["add", "unrelated.txt"]);

    const result = await publishToLive(BOOK, {
      localPackagePath: fx.localPkg,
      outerRoot: fx.outerRoot,
      commit: true,
      verify: () => true,
    });
    assert.equal(result.ok, true, result.error);
    assert.ok(result.steps.some((s) => s.startsWith("commit: ") && s.includes(`book-packages/${BOOK}.v21.json`)), `steps: ${result.steps.join(" | ")}`);

    const log = git(fx.outerRoot, ["log", "-1", "--format=%B"]);
    assert.match(log, new RegExp(`^chore\\(books\\): publish ${BOOK} package to live catalog`));
    assert.match(log, /Co-Authored-By: Claude Fable 5 <noreply@anthropic\.com>/);

    const files = git(fx.outerRoot, ["show", "--name-only", "--format=", "HEAD"]).split("\n").map((l) => l.trim()).filter(Boolean);
    assert.deepEqual(files, [`book-packages/${BOOK}.v21.json`], "the commit must contain exactly the one package file");
    assert.match(git(fx.outerRoot, ["show", "--stat", "--format=", "HEAD"]), / 1 file changed/, "stat must report exactly one file");

    assert.equal(git(fx.outerRoot, ["diff", "--cached", "--name-only"]), "unrelated.txt", "unrelated staged work must remain staged");
  } finally {
    fx.cleanup();
  }
});

test("report-only mode ALSO refuses a dirty dest (the copy itself would clobber in-flight work)", async () => {
  const fx = makeFixture("dirty-report-only", { git: true });
  try {
    writeFileSync(fx.destPkg, '{"version":"A"}\n');
    git(fx.outerRoot, ["add", "--", `book-packages/${BOOK}.v21.json`]);
    git(fx.outerRoot, ["commit", "-q", "-m", "someone else's version A"]);
    writeFileSync(fx.destPkg, '{"version":"B-dirty-from-elsewhere"}\n');

    const result = await publishToLive(BOOK, {
      localPackagePath: fx.localPkg,
      outerRoot: fx.outerRoot,
      verify: () => true,
    });
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /already staged\/dirty/);
    assert.equal(readFileSync(fx.destPkg, "utf8"), '{"version":"B-dirty-from-elsewhere"}\n', "report-only must NOT clobber the dirty file either");
  } finally {
    fx.cleanup();
  }
});

test("--commit refuses a dest already dirty from elsewhere and does NOT clobber it", async () => {
  const fx = makeFixture("dirty", { git: true });
  try {
    // Someone else's in-flight edit: tracked version A committed, dirty version B in the tree.
    writeFileSync(fx.destPkg, '{"version":"A"}\n');
    git(fx.outerRoot, ["add", "--", `book-packages/${BOOK}.v21.json`]);
    git(fx.outerRoot, ["commit", "-q", "-m", "someone else's version A"]);
    writeFileSync(fx.destPkg, '{"version":"B-dirty-from-elsewhere"}\n');

    const result = await publishToLive(BOOK, {
      localPackagePath: fx.localPkg,
      outerRoot: fx.outerRoot,
      commit: true,
      verify: () => true,
    });
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /already staged\/dirty/);
    assert.equal(readFileSync(fx.destPkg, "utf8"), '{"version":"B-dirty-from-elsewhere"}\n', "the dirty file must NOT be clobbered by the copy");
    assert.equal(git(fx.outerRoot, ["log", "--format=%s"]).split("\n").length, 2, "no new commit may be created");
  } finally {
    fx.cleanup();
  }
});

test("--commit on an already-identical committed dest skips the commit but still succeeds", async () => {
  const fx = makeFixture("idempotent", { git: true });
  try {
    writeFileSync(fx.destPkg, PKG_CONTENT);
    git(fx.outerRoot, ["add", "--", `book-packages/${BOOK}.v21.json`]);
    git(fx.outerRoot, ["commit", "-q", "-m", "already live"]);

    const result = await publishToLive(BOOK, {
      localPackagePath: fx.localPkg,
      outerRoot: fx.outerRoot,
      commit: true,
      verify: () => true,
    });
    assert.equal(result.ok, true, result.error);
    assert.ok(result.steps.some((s) => s.startsWith("commit: SKIPPED (outer tree already has identical content")), `steps: ${result.steps.join(" | ")}`);
    assert.equal(git(fx.outerRoot, ["log", "--format=%s"]).split("\n").length, 2, "no new commit for identical content");
  } finally {
    fx.cleanup();
  }
});

test("--commit against a non-git outerRoot fails closed (before any copy)", async () => {
  const fx = makeFixture("non-git"); // no git init; /tmp is not inside a repo
  try {
    const result = await publishToLive(BOOK, {
      localPackagePath: fx.localPkg,
      outerRoot: fx.outerRoot,
      commit: true,
      verify: () => true,
    });
    assert.equal(result.ok, false);
    assert.match(result.error ?? "", /not a git work tree|not the git toplevel/);
    assert.equal(existsSync(fx.destPkg), false, "commit-mode preflight failure must abort before the copy");
  } finally {
    fx.cleanup();
  }
});
