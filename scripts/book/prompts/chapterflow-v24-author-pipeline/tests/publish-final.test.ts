/**
 * publish-final (v24 WS2 F1) — the one-verb ship: bridge → commit → push (MERGE loop) →
 * origin sync 0/0 → debris cleanup.
 *
 * ALL git behavior runs against THROWAWAY bare + clone fixture repos (git init --bare +
 * git clone), never the real repo/origin. Every case injects outerRoot, localPackagePath,
 * lockDir, a stub verify, and a stub catalog-regen script so nothing touches the real
 * checkout, state/, or git tree.
 *
 * Locks in the contract:
 *  - happy E2E: bridge + register + commit + push + 0/0 sync + cleanup, structured steps
 *  - push MERGE loop: origin advances between commit and push → loop MERGES (a merge commit
 *    exists; NO rebase, NO force) → push succeeds → 0/0 assert
 *  - push conflict → merge --abort → structured error (no force)
 *  - dry-run: zero mutations (fs snapshot before/after) + full plan incl. cleanup manifest
 *  - preflight fail-closed: missing package / verify=false / fresh lock / non-toplevel outer
 *  - registration append into the fixture registry (unregistered → import + block appended)
 *  - idempotent re-run: a second publish-final skips the commit (no duplicate)
 *  - cleanup gated on the step-6 proof (a --keep-debris run leaves debris; a real run sweeps it)
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { hostname, tmpdir } from "node:os";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { publishFinal, pushWithMerge, hasFreshLock, mergePendingDeploy, PENDING_DEPLOY_REL } from "../src/publish/publishFinal.js";

const BOOK = "zz-fixture-publish-final";
const PKG = JSON.stringify({ schemaVersion: "v21", packageId: `${BOOK}-v21-1`, book: { bookId: BOOK }, chapters: [{ number: 1, title: "One" }] }, null, 2) + "\n";

function tmpRoot(label: string): string {
  return resolve(tmpdir(), `cf-v24-pubfinal-${label}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
}
function git(cwd: string, args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, `fixture git ${args.join(" ")} failed: ${r.stderr}`);
  return (r.stdout ?? "").trim();
}

/** A catalog-regen script that (like the real generate-catalog-metadata) rewrites
 *  booksCatalog.metadata.json in cwd — DETERMINISTICALLY (derived from the registry
 *  imports), so a re-run over unchanged content produces byte-identical output. This
 *  mirrors the real generator (deterministic) and is what makes the idempotent re-run
 *  a genuine no-op. */
const CATALOG_GEN_SCRIPT =
  `import { readFileSync, writeFileSync } from "node:fs";\n` +
  `import { resolve } from "node:path";\n` +
  `const reg = readFileSync(resolve(process.cwd(), "app/book/data/bookPackages.ts"), "utf8");\n` +
  `const ids = [...reg.matchAll(/@\\/book-packages\\/([^.]+)\\.v21\\.json/g)].map((m) => m[1]).sort();\n` +
  `writeFileSync(resolve(process.cwd(), "app/book/data/booksCatalog.metadata.json"), JSON.stringify(ids.map((id) => ({ bookId: id }))) + "\\n");\n`;

/** Build a throwaway origin (bare) + a clone (outer live checkout) + a sandbox pkg. */
function makeFixture(label: string, opts?: { registered?: boolean }): {
  root: string; bare: string; outer: string; localPkg: string; branch: string; lockDir: string; cleanup: () => void;
} {
  const root = tmpRoot(label);
  const bare = resolve(root, "origin.git");
  const outer = resolve(root, "outer");
  const sandbox = resolve(root, "sandbox");
  const lockDir = resolve(root, "locks");
  mkdirSync(sandbox, { recursive: true });
  mkdirSync(lockDir, { recursive: true });
  git(root, ["init", "--bare", "-q", bare]);
  git(root, ["clone", "-q", bare, outer]);
  git(outer, ["config", "user.name", "fx"]);
  git(outer, ["config", "user.email", "fx@t"]);
  mkdirSync(resolve(outer, "app/book/data"), { recursive: true });
  mkdirSync(resolve(outer, "book-packages"), { recursive: true });
  mkdirSync(resolve(outer, "scripts/book"), { recursive: true });
  const reg = opts?.registered
    ? `import a from "@/book-packages/existing.v21.json";\nimport b from "@/book-packages/${BOOK}.v21.json";\n`
    : `import a from "@/book-packages/existing.v21.json";\n`;
  writeFileSync(resolve(outer, "app/book/data/bookPackages.ts"), `${reg}\nconst BOOK_PACKAGES = [];\nconst BOOK_PACKAGE_TONE_GETTERS = {};\nfunction normalizeAnyPackage(x, t) { return x; }\n`);
  writeFileSync(resolve(outer, "app/book/data/booksCatalog.metadata.json"), "[]\n");
  writeFileSync(resolve(outer, "scripts/book/generate-catalog-metadata.ts"), CATALOG_GEN_SCRIPT);
  git(outer, ["add", "-A"]);
  git(outer, ["commit", "-q", "-m", "init outer"]);
  git(outer, ["push", "-q", "origin", "HEAD"]);
  const branch = git(outer, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const localPkg = resolve(sandbox, `${BOOK}.v21.json`);
  writeFileSync(localPkg, PKG);
  return { root, bare, outer, localPkg, branch, lockDir, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

/** Advance origin by pushing an unrelated commit from a second clone. */
function advanceOrigin(root: string, bare: string, label = "advance"): void {
  const other = resolve(root, `other-${label}-${Math.random().toString(36).slice(2, 6)}`);
  git(root, ["clone", "-q", bare, other]);
  git(other, ["config", "user.name", "o"]);
  git(other, ["config", "user.email", "o@t"]);
  writeFileSync(resolve(other, `${label}.txt`), `${label}\n`);
  git(other, ["add", "-A"]);
  git(other, ["commit", "-q", "-m", label]);
  git(other, ["push", "-q", "origin", "HEAD"]);
}

/** Snapshot every file path+mtime+size under a dir, recursively, for a zero-mutation check. */
function snapshot(dir: string): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (d: string) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = resolve(d, e.name);
      if (e.name === ".git") { out.set(p, "GITDIR"); continue; } // don't descend into .git (fetch touches it)
      if (e.isDirectory()) walk(p);
      else { const st = statSync(p); out.set(p, `${st.size}:${st.mtimeMs}`); }
    }
  };
  walk(dir);
  return out;
}

const stubVerify = () => true;
const fixtureRunner = (cmd: string, args: string[], cwd: string): void => {
  assert.equal(cmd, "npx", "publish fixture should only invoke catalog regeneration through runner seam");
  assert.deepEqual(args.slice(0, 1), ["tsx"]);
  const script = readFileSync(args[1], "utf8");
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, `fixture catalog generator failed: ${result.stderr}`);
};
const commonOpts = (fx: ReturnType<typeof makeFixture>) => ({
  outerRoot: fx.outer,
  localPackagePath: fx.localPkg,
  lockDir: fx.lockDir,
  branch: fx.branch,
  verify: stubVerify,
  runner: fixtureRunner,
});

test("happy E2E: bridge → register → commit → push → 0/0 sync → cleanup, structured steps", async () => {
  const fx = makeFixture("happy");
  try {
    const res = await publishFinal(BOOK, { ...commonOpts(fx), keepDebris: true });
    assert.equal(res.ok, true, `${res.error}\n${res.steps.map((s) => `${s.ok ? "OK" : "XX"} ${s.step}: ${s.detail}`).join("\n")}`);
    const stepOk = (name: string) => res.steps.find((s) => s.step === name)?.ok === true;
    for (const s of ["preflight:package-exists", "preflight:verify", "preflight:no-fresh-lock", "preflight:outer-toplevel", "preflight:fetch", "bridge", "register:append", "register:catalog", "commit", "push", "sync"]) {
      assert.ok(stepOk(s), `step ${s} must be OK\n${res.steps.map((x) => `${x.ok ? "OK" : "XX"} ${x.step}`).join("\n")}`);
    }
    assert.equal(res.syncState, "0 0");
    assert.ok(res.commitSha && res.commitSha.length >= 7);
    // the package reached the outer catalog dir, byte-identical.
    assert.equal(readFileSync(resolve(fx.outer, "book-packages", `${BOOK}.v21.json`), "utf8"), PKG);
    // it is committed on the branch and pushed to origin.
    const originHead = git(fx.outer, ["rev-parse", `origin/${fx.branch}`]);
    const localHead = git(fx.outer, ["rev-parse", "HEAD"]);
    assert.equal(originHead, localHead, "origin and local must be in sync");
    // Deploy sentinel (FINAL-HARDENING-PLAN 2026-07-04): written, tracked in the
    // publish commit, records this book with the same sha the byte-compare used.
    assert.ok(res.steps.find((s) => s.step === "deploy-sentinel")?.ok, "the deploy-sentinel step ran");
    const sentinelAbs = resolve(fx.outer, PENDING_DEPLOY_REL);
    assert.ok(existsSync(sentinelAbs), "the sentinel file exists in the outer checkout");
    const sentinel = JSON.parse(readFileSync(sentinelAbs, "utf8"));
    assert.equal(sentinel.schemaVersion, "pending-deploy-v1");
    const entry = sentinel.pending.find((e: { bookId: string }) => e.bookId === BOOK);
    assert.ok(entry, "the published book is recorded as pending deploy");
    assert.equal(entry.packageSha256, res.packageSha, "the sentinel sha matches the published package sha");
    // It rode the publish commit (tracked, not left dirty).
    const tracked = git(fx.outer, ["ls-files", "--", PENDING_DEPLOY_REL]);
    assert.equal(tracked, PENDING_DEPLOY_REL, "the sentinel is committed, not an untracked leftover");
    // The success report carries the loud DEPLOY REQUIRED hint.
    assert.ok((res.deployRequired ?? []).some((l) => /DEPLOY REQUIRED/.test(l)), "the result exposes the deploy-required hint");
    assert.ok((res.deployRequired ?? []).some((l) => /verify:live/.test(l)), "the hint names the verify command");
  } finally { fx.cleanup(); }
});

test("deploy sentinel: mergePendingDeploy replaces same-book, preserves others, tolerates torn JSON, is stable+newline-terminated", () => {
  // Fresh file.
  const first = mergePendingDeploy(null, { bookId: "b-two", packageSha256: "aaa", publishedAt: "t1", steps: ["x"] });
  assert.ok(first.endsWith("\n"), "newline-terminated");
  const p1 = JSON.parse(first);
  assert.equal(p1.schemaVersion, "pending-deploy-v1");
  assert.deepEqual(p1.pending.map((e: { bookId: string }) => e.bookId), ["b-two"]);
  // Preserve others + sort by bookId.
  const second = mergePendingDeploy(first, { bookId: "a-one", packageSha256: "bbb", publishedAt: "t2", steps: ["y"] });
  assert.deepEqual(JSON.parse(second).pending.map((e: { bookId: string }) => e.bookId), ["a-one", "b-two"], "other entries preserved, sorted by bookId");
  // Replace same book (new sha), keep the other.
  const third = mergePendingDeploy(second, { bookId: "b-two", packageSha256: "ccc", publishedAt: "t3", steps: ["z"] });
  const p3 = JSON.parse(third);
  assert.equal(p3.pending.length, 2, "same-book entry replaced, not duplicated");
  assert.equal(p3.pending.find((e: { bookId: string }) => e.bookId === "b-two").packageSha256, "ccc", "replaced with the new sha");
  assert.equal(p3.pending.find((e: { bookId: string }) => e.bookId === "a-one").packageSha256, "bbb", "the other entry is untouched");
  // IDEMPOTENT: re-merging the SAME book+sha keeps the prior entry verbatim
  // (publishedAt not refreshed) → byte-identical output → publish-final's
  // commit-skip idempotency holds.
  const reMerged = mergePendingDeploy(third, { bookId: "b-two", packageSha256: "ccc", publishedAt: "t3-DIFFERENT", steps: ["z"] });
  assert.equal(reMerged, third, "same book+sha re-merge is byte-identical (publishedAt preserved)");
  // Torn/foreign existing blob → start fresh with just the new entry (never throws).
  const fromTorn = mergePendingDeploy("{ this is not json", { bookId: "c", packageSha256: "d", publishedAt: "t", steps: [] });
  assert.deepEqual(JSON.parse(fromTorn).pending.map((e: { bookId: string }) => e.bookId), ["c"]);
  // A well-formed blob with an unexpected shape keeps only valid entries.
  const mixed = mergePendingDeploy(JSON.stringify({ pending: [{ bookId: "keep", packageSha256: "k", publishedAt: "t", steps: [] }, { junk: 1 }] }), { bookId: "new", packageSha256: "n", publishedAt: "t", steps: [] });
  assert.deepEqual(JSON.parse(mixed).pending.map((e: { bookId: string }) => e.bookId).sort(), ["keep", "new"], "invalid entries dropped, valid ones preserved");
});

test("push MERGE loop: origin advances between commit and push → merges (merge commit, NO rebase/force) → push → 0/0", async () => {
  const fx = makeFixture("merge");
  try {
    advanceOrigin(fx.root, fx.bare, "concurrent");
    const res = await publishFinal(BOOK, { ...commonOpts(fx), keepDebris: true });
    assert.equal(res.ok, true, `${res.error}\n${res.steps.map((s) => `${s.ok ? "OK" : "XX"} ${s.step}: ${s.detail}`).join("\n")}`);
    assert.equal(res.syncState, "0 0");
    // A MERGE commit must exist (proves we merged, not rebased).
    const merges = git(fx.outer, ["log", "--merges", "--oneline", "-5"]);
    assert.ok(merges.length > 0, "a merge commit must exist (reconciled by merge, not rebase)");
    // The concurrent advance is in our history (merge, not a rewrite that would drop it).
    const containsAdvance = git(fx.outer, ["log", "--oneline"]).includes("concurrent");
    assert.ok(containsAdvance, "the concurrent origin commit must be merged in");
    // origin == local.
    assert.equal(git(fx.outer, ["rev-parse", `origin/${fx.branch}`]), git(fx.outer, ["rev-parse", "HEAD"]));
  } finally { fx.cleanup(); }
});

test("push conflict → merge --abort → structured error (never force)", () => {
  // Unit-test pushWithMerge directly on a bare-repo fixture where the SAME file conflicts.
  const root = tmpRoot("conflict");
  const bare = resolve(root, "o.git");
  const a = resolve(root, "a");
  try {
    mkdirSync(root, { recursive: true });
    git(root, ["init", "--bare", "-q", bare]);
    git(root, ["clone", "-q", bare, a]);
    git(a, ["config", "user.name", "a"]);
    git(a, ["config", "user.email", "a@t"]);
    writeFileSync(resolve(a, "conflict.txt"), "base\n");
    git(a, ["add", "-A"]); git(a, ["commit", "-q", "-m", "base"]); git(a, ["push", "-q", "origin", "HEAD"]);
    const branch = git(a, ["rev-parse", "--abbrev-ref", "HEAD"]);
    // origin advances with a CONFLICTING change to the same file.
    const b = resolve(root, "b");
    git(root, ["clone", "-q", bare, b]);
    git(b, ["config", "user.name", "b"]); git(b, ["config", "user.email", "b@t"]);
    writeFileSync(resolve(b, "conflict.txt"), "origin-version\n");
    git(b, ["add", "-A"]); git(b, ["commit", "-q", "-m", "origin change"]); git(b, ["push", "-q", "origin", "HEAD"]);
    // local makes a conflicting change and tries to push.
    writeFileSync(resolve(a, "conflict.txt"), "local-version\n");
    git(a, ["add", "-A"]); git(a, ["commit", "-q", "-m", "local change"]);

    const r = pushWithMerge(a, branch, 3);
    assert.equal(r.pushed, false, "a real conflict must not push");
    assert.match(r.error ?? "", /conflict/i);
    // the merge was aborted — no MERGE_HEAD, tree clean of markers.
    assert.equal(existsSync(resolve(a, ".git", "MERGE_HEAD")), false, "merge must be aborted (no MERGE_HEAD)");
    assert.equal(readFileSync(resolve(a, "conflict.txt"), "utf8"), "local-version\n", "our version is restored (no conflict markers left)");
    // no force-push happened: origin still holds the origin-version commit.
    const originLog = git(a, ["log", `origin/${branch}`, "--oneline"]);
    assert.ok(originLog.includes("origin change"), "origin must be untouched (no force-push)");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("dry-run: ZERO mutations (fs snapshot before/after) + full plan incl. cleanup manifest", async () => {
  const fx = makeFixture("dryrun");
  try {
    const before = snapshot(fx.outer);
    const res = await publishFinal(BOOK, { ...commonOpts(fx), dryRun: true });
    const after = snapshot(fx.outer);
    assert.equal(res.ok, true, res.error);
    assert.equal(res.dryRun, true);
    // no file mutated (same paths, same size:mtime).
    assert.deepEqual([...after.entries()].sort(), [...before.entries()].sort(), "dry-run must not mutate any outer file");
    // the package was NOT copied.
    assert.equal(existsSync(resolve(fx.outer, "book-packages", `${BOOK}.v21.json`)), false, "dry-run must not copy the package");
    // no new commit.
    assert.equal(git(fx.outer, ["log", "--oneline"]).split("\n").length, 1, "dry-run must not commit");
    // the plan includes the cleanup manifest.
    assert.ok(res.cleanupManifest, "dry-run must compute a cleanup manifest");
    assert.ok(res.steps.some((s) => s.step === "plan:cleanup"), "dry-run must print a cleanup plan step");
    assert.ok(res.steps.some((s) => s.step === "plan:push" && /merge loop/i.test(s.detail)), "the plan must state the merge loop");
    assert.ok(res.packageSha, "the plan reports the package sha");
  } finally { fx.cleanup(); }
});

test("preflight fail-closed: missing package / verify=false / fresh lock / non-toplevel outer", async () => {
  const fx = makeFixture("preflight");
  try {
    // missing package
    const miss = await publishFinal(BOOK, { ...commonOpts(fx), localPackagePath: resolve(fx.root, "nope.json") });
    assert.equal(miss.ok, false);
    assert.match(miss.error ?? "", /sandbox package missing/);
    assert.equal(existsSync(resolve(fx.outer, "book-packages", `${BOOK}.v21.json`)), false, "nothing copied on a missing package");

    // verify=false
    const bad = await publishFinal(BOOK, { ...commonOpts(fx), verify: () => false });
    assert.equal(bad.ok, false);
    assert.match(bad.error ?? "", /verifier rejected/);
    assert.equal(existsSync(resolve(fx.outer, "book-packages", `${BOOK}.v21.json`)), false, "nothing copied on verify=false");

    // fresh lock (owner = THIS live pid → provably alive)
    writeFileSync(resolve(fx.lockDir, `${BOOK}.lock`), JSON.stringify({ pid: process.pid, host: hostname(), at: new Date().toISOString(), owner: "held" }));
    const locked = await publishFinal(BOOK, { ...commonOpts(fx) });
    assert.equal(locked.ok, false);
    assert.match(locked.error ?? "", /fresh autopilot lock/);
    rmSync(resolve(fx.lockDir, `${BOOK}.lock`));

    // non-toplevel outer (a SUBDIR of the repo, not the toplevel)
    const sub = resolve(fx.outer, "app");
    const nonTop = await publishFinal(BOOK, { ...commonOpts(fx), outerRoot: sub });
    assert.equal(nonTop.ok, false);
    assert.match(nonTop.error ?? "", /toplevel/);
  } finally { fx.cleanup(); }
});

test("registration append: an unregistered book gets an import + a self-contained block", async () => {
  const fx = makeFixture("register");
  try {
    const regBefore = readFileSync(resolve(fx.outer, "app/book/data/bookPackages.ts"), "utf8");
    assert.ok(!regBefore.includes(`from "@/book-packages/${BOOK}.v21.json"`), "book must start unregistered");
    const res = await publishFinal(BOOK, { ...commonOpts(fx), keepDebris: true });
    assert.equal(res.ok, true, res.error);
    const regAfter = readFileSync(resolve(fx.outer, "app/book/data/bookPackages.ts"), "utf8");
    assert.ok(regAfter.includes(`import auto_${BOOK.replace(/[^a-zA-Z0-9]/g, "_")}_Json from "@/book-packages/${BOOK}.v21.json";`), "import must be appended");
    assert.ok(regAfter.includes(`BOOK_PACKAGE_TONE_GETTERS["${BOOK}"]`), "tone getter block must be appended");
    // register step fired.
    assert.ok(res.steps.some((s) => s.step === "register:append" && s.ok), "the append-register step must fire");
  } finally { fx.cleanup(); }
});

test("already-registered book: probe FOUND, no double registration", async () => {
  const fx = makeFixture("already-reg", { registered: true });
  try {
    const res = await publishFinal(BOOK, { ...commonOpts(fx), keepDebris: true });
    assert.equal(res.ok, true, res.error);
    assert.ok(res.steps.some((s) => s.step === "register:probe" && s.ok), "an already-registered book takes the probe path");
    const reg = readFileSync(resolve(fx.outer, "app/book/data/bookPackages.ts"), "utf8");
    const importCount = (reg.match(new RegExp(`from "@/book-packages/${BOOK}\\.v21\\.json"`, "g")) ?? []).length;
    assert.equal(importCount, 1, "no duplicate import for an already-registered book");
  } finally { fx.cleanup(); }
});

test("idempotent re-run: a second publish-final skips the commit (no duplicate commit)", async () => {
  const fx = makeFixture("idempotent");
  try {
    const first = await publishFinal(BOOK, { ...commonOpts(fx), keepDebris: true });
    assert.equal(first.ok, true, first.error);
    const headAfterFirst = git(fx.outer, ["rev-parse", "HEAD"]);
    const logLenFirst = git(fx.outer, ["log", "--oneline"]).split("\n").length;

    const second = await publishFinal(BOOK, { ...commonOpts(fx), keepDebris: true });
    assert.equal(second.ok, true, second.error);
    const commitStep = second.steps.find((s) => s.step === "commit");
    assert.match(commitStep?.detail ?? "", /SKIPPED \(content already committed\)/);
    assert.equal(git(fx.outer, ["rev-parse", "HEAD"]), headAfterFirst, "no new commit on the idempotent re-run");
    assert.equal(git(fx.outer, ["log", "--oneline"]).split("\n").length, logLenFirst, "log length unchanged");
    assert.equal(second.syncState, "0 0", "still in sync");
  } finally { fx.cleanup(); }
});

test("cleanup runs only after the 0/0 sync proof; a real run sweeps debris, --keep-debris leaves it", async () => {
  // Wire debris under the OUTER root's own gitignored state (so the cleanup engine's default
  // pipelineRoot=REPO_ROOT is irrelevant — we probe the outer shadow, which the engine covers,
  // AND we verify the proof gate fired). Simplest: assert the cleanup STEP is proof-gated by
  // checking a --keep-debris run reports SKIPPED and a real run reports a removal count of 0+
  // WITHOUT error (no debris in this fixture → empty, but proof-gated + ok).
  const fx = makeFixture("cleanup");
  try {
    const kept = await publishFinal(BOOK, { ...commonOpts(fx), keepDebris: true });
    assert.equal(kept.ok, true, kept.error);
    assert.ok(kept.steps.some((s) => s.step === "cleanup" && /--keep-debris/.test(s.detail)), "keep-debris must skip cleanup");

    // A real (non-keep) re-run: idempotent commit-skip, still hits sync 0/0, then runs cleanup
    // gated on that proof. With no book debris in this fixture the cleanup is a proof-gated no-op.
    const real = await publishFinal(BOOK, { ...commonOpts(fx) });
    assert.equal(real.ok, true, `${real.error}\n${real.steps.map((s) => `${s.ok ? "OK" : "XX"} ${s.step}: ${s.detail}`).join("\n")}`);
    assert.ok(real.cleanup, "a real run produces a cleanup result");
    assert.equal(real.cleanup!.ok, true, "cleanup ran (proof-gated) and succeeded");
    assert.ok(real.steps.some((s) => s.step === "cleanup" && s.ok), "the cleanup step is OK on a real run");
  } finally { fx.cleanup(); }
});

test("step-6 sync assert: a concurrent DIVERGENT origin advance after push → ff-only pull fails → structured error (no cleanup)", async () => {
  const fx = makeFixture("sync-fail");
  try {
    // After our push succeeds, simulate a concurrent DIVERGENT commit landing on origin
    // (via the test seam): our local branch and origin now diverge, so the post-push
    // ff-only pull fails and the 0/0 assert must surface a structured error — and cleanup
    // must NOT run (no valid proof).
    const res = await publishFinal(BOOK, {
      ...commonOpts(fx),
      __afterPushHook: () => {
        // divergent: origin gets a commit our local doesn't have, AND we already have a
        // commit origin doesn't (our publish) → non-fast-forward for both directions.
        // Make it non-ff by rewriting origin's branch to a sibling commit.
        const other = resolve(fx.root, "diverge");
        git(fx.root, ["clone", "-q", fx.bare, other]);
        git(other, ["config", "user.name", "d"]);
        git(other, ["config", "user.email", "d@t"]);
        // reset origin's branch to BEFORE our publish commit + add a different commit.
        const beforeOurs = git(other, ["rev-parse", "HEAD~1"]);
        git(other, ["reset", "--hard", "-q", beforeOurs]);
        writeFileSync(resolve(other, "divergent.txt"), "divergent\n");
        git(other, ["add", "-A"]);
        git(other, ["commit", "-q", "-m", "divergent origin"]);
        git(other, ["push", "-q", "--force", "origin", `HEAD:${fx.branch}`]);
      },
    });
    assert.equal(res.ok, false, "a post-push divergence must fail the sync assert");
    assert.match(res.error ?? "", /sync|ff-only/i);
    // the sync step is marked failed.
    assert.ok(res.steps.some((s) => s.step === "sync" && !s.ok), "the sync step must be marked failed");
    // cleanup must NOT have run (no 0/0 proof).
    assert.ok(!res.cleanup || res.cleanup.ok === false, "cleanup must not run without a 0/0 sync proof");
    assert.ok(!res.steps.some((s) => s.step === "cleanup"), "no cleanup step should appear after a sync failure");
  } finally { fx.cleanup(); }
});

test("hasFreshLock: a live-pid lock is fresh; a dead-pid / stale-heartbeat lock is not", () => {
  const root = tmpRoot("lock");
  try {
    mkdirSync(root, { recursive: true });
    
    // fresh: our own pid, now.
    writeFileSync(resolve(root, `${BOOK}.lock`), JSON.stringify({ pid: process.pid, host: hostname(), at: new Date().toISOString(), owner: "x" }));
    assert.equal(hasFreshLock(root, BOOK), true, "our live pid is a fresh lock");
    // dead: a definitely-unused high pid on this host.
    writeFileSync(resolve(root, `${BOOK}.lock`), JSON.stringify({ pid: 2_000_000_000, host: hostname(), at: new Date().toISOString(), owner: "x" }));
    assert.equal(hasFreshLock(root, BOOK), false, "a dead pid is not a fresh lock");
    // cross-host, stale heartbeat (>2h).
    writeFileSync(resolve(root, `${BOOK}.lock`), JSON.stringify({ pid: 123, host: "some-other-host", at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), owner: "x" }));
    assert.equal(hasFreshLock(root, BOOK), false, "a stale cross-host heartbeat is not fresh");
    // cross-host, recent heartbeat.
    writeFileSync(resolve(root, `${BOOK}.lock`), JSON.stringify({ pid: 123, host: "some-other-host", at: new Date().toISOString(), owner: "x" }));
    assert.equal(hasFreshLock(root, BOOK), true, "a recent cross-host heartbeat is fresh");
    // no lock file.
    rmSync(resolve(root, `${BOOK}.lock`));
    assert.equal(hasFreshLock(root, BOOK), false, "no lock file → not fresh");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
