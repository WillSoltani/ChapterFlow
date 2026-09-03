/**
 * publish-final terminal states the release audit found mislabelled
 * (R-240, R-241, R-255).
 *
 * All git behavior runs against THROWAWAY bare + clone fixture repos, never the
 * real repo/origin, and the cleanup roots are injected so nothing touches the
 * real state tree.
 *
 * Locks in:
 *  - R-240 a dry run whose cleanup WOULD abort reports the plan as FAILED, with
 *    the tracked paths named (it used to print the abort inside a PASS line).
 *  - R-241 a publish that shipped and could not clean returns ok:true with
 *    `cleanupBlocked` (the book IS live), and only `--strict-cleanup` makes it a
 *    failure — the exit code the CLI derives is distinct from a failed publish.
 *  - R-255 a corrupt deploy sentinel refuses the publish BEFORE the commit
 *    instead of silently rewriting the file with every other book's owed deploy
 *    steps dropped.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { test } from "./harness.js";
import { publishFinal, mergePendingDeploy, PENDING_DEPLOY_REL } from "../src/publish/publishFinal.js";

const BOOK = "zz-fixture-publish-outcomes";
const PKG = JSON.stringify({ schemaVersion: "v21", packageId: `${BOOK}-v21-1`, book: { bookId: BOOK }, chapters: [{ number: 1, title: "One" }] }, null, 2) + "\n";

const CATALOG_GEN_SCRIPT =
  `import { readFileSync, writeFileSync } from "node:fs";\n` +
  `import { resolve } from "node:path";\n` +
  `const reg = readFileSync(resolve(process.cwd(), "app/book/data/bookPackages.ts"), "utf8");\n` +
  `const ids = [...reg.matchAll(/@\\/book-packages\\/([^.]+)\\.v21\\.json/g)].map((m) => m[1]).sort();\n` +
  `writeFileSync(resolve(process.cwd(), "app/book/data/booksCatalog.metadata.json"), JSON.stringify(ids.map((id) => ({ bookId: id }))) + "\\n");\n`;

function git(cwd: string, args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, `fixture git ${args.join(" ")} failed: ${r.stderr}`);
  return (r.stdout ?? "").trim();
}

function makeFixture(label: string) {
  const root = resolve(tmpdir(), `cf-v25-pubout-${label}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
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
  writeFileSync(resolve(outer, "app/book/data/bookPackages.ts"), `import a from "@/book-packages/existing.v21.json";\n\nconst BOOK_PACKAGES = [];\nconst BOOK_PACKAGE_TONE_GETTERS = {};\nfunction normalizeAnyPackage(x, t) { return x; }\n`);
  writeFileSync(resolve(outer, "app/book/data/booksCatalog.metadata.json"), "[]\n");
  writeFileSync(resolve(outer, "scripts/book/generate-catalog-metadata.ts"), CATALOG_GEN_SCRIPT);
  git(outer, ["add", "-A"]);
  git(outer, ["commit", "-q", "-m", "init outer"]);
  git(outer, ["push", "-q", "origin", "HEAD"]);
  const branch = git(outer, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const localPkg = resolve(sandbox, `${BOOK}.v21.json`);
  writeFileSync(localPkg, PKG);
  // Debris that lives INSIDE the outer checkout, so a fixture can make one piece
  // of it git-tracked without touching the real state tree.
  const stateRoot = resolve(outer, "pipeline-state");
  const trackedChapter = resolve(stateRoot, "chapters", `${BOOK}-ch01.v21-native.chapter.json`);
  mkdirSync(resolve(trackedChapter, ".."), { recursive: true });
  writeFileSync(trackedChapter, "{}");
  return {
    root, bare, outer, localPkg, branch, lockDir, stateRoot, trackedChapter,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

const fixtureRunner = (cmd: string, args: string[], cwd: string): void => {
  assert.equal(cmd, "npx");
  const script = readFileSync(args[1], "utf8");
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, `fixture catalog generator failed: ${result.stderr}`);
};

function commonOpts(fx: ReturnType<typeof makeFixture>) {
  return {
    outerRoot: fx.outer,
    localPackagePath: fx.localPkg,
    lockDir: fx.lockDir,
    branch: fx.branch,
    verify: () => true,
    runner: fixtureRunner,
    cleanupRoots: { pipelineRoot: fx.outer, stateRoot: fx.stateRoot },
  };
}

/** Track the fixture debris chapter so the cleanup rail will abort on it. */
function trackDebris(fx: ReturnType<typeof makeFixture>): void {
  git(fx.outer, ["add", "--", "pipeline-state"]);
  git(fx.outer, ["commit", "-q", "-m", "track debris"]);
  git(fx.outer, ["push", "-q", "origin", "HEAD"]);
}

test("R-240: a dry run whose cleanup WOULD abort reports PLAN FAILED, naming the tracked path", async () => {
  const fx = makeFixture("dry-abort");
  try {
    trackDebris(fx);
    const res = await publishFinal(BOOK, { ...commonOpts(fx), dryRun: true });
    const step = res.steps.find((s) => s.step === "plan:cleanup");
    assert.ok(step, "the plan must include a cleanup step");
    assert.equal(step.ok, false, "a plan that prints an ABORT must not be reported as OK");
    assert.match(step.detail, /ABORT/);
    assert.equal(res.ok, false, "PUBLISH-FINAL PLAN must be BLOCKED when the real run's cleanup would abort");
    assert.match(res.error ?? "", /cleanup/i);
    assert.deepEqual(res.cleanupManifest?.trackedMatches, [fx.trackedChapter]);
  } finally { fx.cleanup(); }
});

test("R-240: a dry run with --keep-debris is OK even with tracked debris (cleanup will not run)", async () => {
  const fx = makeFixture("dry-keep");
  try {
    trackDebris(fx);
    const res = await publishFinal(BOOK, { ...commonOpts(fx), dryRun: true, keepDebris: true });
    assert.equal(res.steps.find((s) => s.step === "plan:cleanup")?.ok, true);
    assert.equal(res.ok, true, `plan must pass under --keep-debris: ${res.error}`);
  } finally { fx.cleanup(); }
});

test("R-241: a publish that SHIPPED but could not clean returns ok:true with cleanupBlocked", async () => {
  const fx = makeFixture("shipped-blocked");
  try {
    trackDebris(fx);
    const res = await publishFinal(BOOK, commonOpts(fx));
    assert.equal(res.ok, true, `the book shipped, so the publish is not a failure: ${res.error}`);
    assert.ok(res.cleanupBlocked, "the blocked cleanup is reported on its own field");
    assert.match(res.cleanupBlocked ?? "", /git-tracked/);
    assert.equal(res.steps.find((s) => s.step === "cleanup")?.ok, false, "the cleanup STEP still reports the abort");
    // The publish really did land: package committed and origin in sync.
    assert.equal(readFileSync(resolve(fx.outer, "book-packages", `${BOOK}.v21.json`), "utf8"), PKG);
    assert.equal(res.syncState, "0 0");
    assert.equal(git(fx.outer, ["rev-parse", `origin/${fx.branch}`]), git(fx.outer, ["rev-parse", "HEAD"]));
    assert.ok((res.deployRequired ?? []).length > 0, "a shipped book still owes its deploy steps");
  } finally { fx.cleanup(); }
});

test("R-241: --strict-cleanup turns the same shipped-but-uncleaned publish back into a failure", async () => {
  const fx = makeFixture("strict");
  try {
    trackDebris(fx);
    const res = await publishFinal(BOOK, { ...commonOpts(fx), strictCleanup: true });
    assert.equal(res.ok, false, "--strict-cleanup is the opt-in that makes an uncleaned publish fail");
    assert.ok(res.cleanupBlocked, "the reason is still reported on cleanupBlocked");
    assert.match(res.error ?? "", /publish succeeded but cleanup/);
  } finally { fx.cleanup(); }
});

test("R-255: mergePendingDeploy REFUSES a sentinel it cannot parse instead of dropping other books", () => {
  const entry = { bookId: "new", packageSha256: "n", publishedAt: "t", steps: [] };
  assert.throws(
    () => mergePendingDeploy("{ this is not json", entry),
    /\.pending-deploy\.json is unreadable \(not valid JSON/,
    "an unparseable sentinel may hide other books' owed deploys — never substitute an empty list",
  );
  assert.throws(
    () => mergePendingDeploy(JSON.stringify({ schemaVersion: "pending-deploy-v1" }), entry),
    /\.pending-deploy\.json is unreadable \(no `pending` array/,
    "a blob with no `pending` array is equally unreadable",
  );
  // An EMPTY file is not corruption — it is the absent-sentinel case.
  assert.deepEqual(JSON.parse(mergePendingDeploy("", entry)).pending.map((e: { bookId: string }) => e.bookId), ["new"]);
  assert.deepEqual(JSON.parse(mergePendingDeploy("   \n", entry)).pending.map((e: { bookId: string }) => e.bookId), ["new"]);
  // A well-formed list still preserves every other book.
  const good = JSON.stringify({ schemaVersion: "pending-deploy-v1", pending: [{ bookId: "keep", packageSha256: "k", publishedAt: "t", steps: [] }] });
  assert.deepEqual(JSON.parse(mergePendingDeploy(good, entry)).pending.map((e: { bookId: string }) => e.bookId).sort(), ["keep", "new"]);
});

test("R-255: a corrupt sentinel stops publish-final BEFORE the commit — nothing is committed or pushed", async () => {
  const fx = makeFixture("sentinel-corrupt");
  try {
    const before = git(fx.outer, ["rev-parse", "HEAD"]);
    writeFileSync(resolve(fx.outer, PENDING_DEPLOY_REL), "{ torn");
    const res = await publishFinal(BOOK, commonOpts(fx));
    assert.equal(res.ok, false, "a publish that cannot record the deploy debt must not proceed");
    assert.equal(res.steps.find((s) => s.step === "deploy-sentinel")?.ok, false);
    assert.equal(git(fx.outer, ["rev-parse", "HEAD"]), before, "no commit may be made");
    assert.equal(readFileSync(resolve(fx.outer, PENDING_DEPLOY_REL), "utf8"), "{ torn", "the operator's bytes are left exactly where they are");
  } finally { fx.cleanup(); }
});

// ── R-231: the strong preflight is the DEFAULT for a candidate-declared pair ──

/** A candidate-regime sidecar, in the exact shape `readDeclaredCandidate` reads:
 *  manifest.payload.candidateChapterSet.{candidateId,manifestDigest}. */
function writeCandidateSidecar(path: string, candidateId = "candidate-1", digest = "a".repeat(64)): string {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify({
    schemaVersion: "chapterflow-production-manifest-sidecar-v1",
    manifest: { payload: { candidateChapterSet: { source: "candidate", candidateId, manifestDigest: digest } } },
  }));
  return path;
}

test("R-231: a CANDIDATE-declared pair with no v25 root REFUSES instead of shipping on the replay", async () => {
  const fx = makeFixture("weak-refuse");
  try {
    const sidecar = writeCandidateSidecar(resolve(fx.root, "sidecar.json"));
    const res = await publishFinal(BOOK, { ...commonOpts(fx), manifestPath: sidecar, env: {} });
    assert.equal(res.ok, false, "the weaker recorded-evidence replay is not an acceptable default for a candidate pair");
    const step = res.steps.find((s) => s.step === "preflight:verification-strength");
    assert.equal(step?.ok, false);
    assert.match(step?.detail ?? "", /--v25-root/);
    assert.match(step?.detail ?? "", /--allow-weak-preflight/, "the refusal names the deliberate escape hatch");
    assert.equal(existsSync(resolve(fx.outer, "book-packages", `${BOOK}.v21.json`)), false, "the package was never bridged into the outer checkout");
  } finally { fx.cleanup(); }
});

test("R-231: a discoverable v25 root (CHAPTERFLOW_V25_ROOT) makes the strong preflight the default", async () => {
  const fx = makeFixture("discover");
  try {
    const sidecar = writeCandidateSidecar(resolve(fx.root, "sidecar.json"));
    const v25Root = resolve(fx.root, "v25");
    mkdirSync(resolve(v25Root, "books", BOOK), { recursive: true });
    writeFileSync(resolve(v25Root, "books", BOOK, "current.json"), "{}");
    const res = await publishFinal(BOOK, {
      ...commonOpts(fx), keepDebris: true, manifestPath: sidecar, env: { CHAPTERFLOW_V25_ROOT: v25Root },
    });
    const step = res.steps.find((s) => s.step === "preflight:verification-strength");
    assert.equal(step?.ok, true, `the discovered root must satisfy the strength gate: ${res.error}`);
    assert.match(step?.detail ?? "", /candidate-store re-verify/);
    assert.match(step?.detail ?? "", /CHAPTERFLOW_V25_ROOT/);
    assert.equal(res.ok, true, res.error);
  } finally { fx.cleanup(); }
});

test("R-231: an env root that does NOT hold this book's pointer is not discovered — the refusal stands", async () => {
  const fx = makeFixture("discover-wrong");
  try {
    const sidecar = writeCandidateSidecar(resolve(fx.root, "sidecar.json"));
    const v25Root = resolve(fx.root, "v25-empty");
    mkdirSync(resolve(v25Root, "books"), { recursive: true });
    const res = await publishFinal(BOOK, { ...commonOpts(fx), manifestPath: sidecar, env: { CHAPTERFLOW_V25_ROOT: v25Root } });
    assert.equal(res.ok, false, "a root without books/<id>/current.json cannot answer the strong preflight");
    assert.equal(res.steps.find((s) => s.step === "preflight:verification-strength")?.ok, false);
  } finally { fx.cleanup(); }
});

test("R-231: --allow-weak-preflight ships the candidate pair on the replay, with the residual named", async () => {
  const fx = makeFixture("weak-allowed");
  try {
    const sidecar = writeCandidateSidecar(resolve(fx.root, "sidecar.json"));
    const res = await publishFinal(BOOK, {
      ...commonOpts(fx), keepDebris: true, manifestPath: sidecar, env: {}, allowWeakPreflight: true,
    });
    assert.equal(res.ok, true, res.error);
    const step = res.steps.find((s) => s.step === "preflight:verification-strength");
    assert.equal(step?.ok, true);
    assert.match(step?.detail ?? "", /WEAK PREFLIGHT/);
    assert.match(step?.detail ?? "", /re-authoring of both shipped files passes/);
  } finally { fx.cleanup(); }
});

test("R-231: a LEGACY (canonical-index) pair is untouched — no strength step, no refusal", async () => {
  const fx = makeFixture("legacy");
  try {
    const sidecar = resolve(fx.root, "legacy-sidecar.json");
    writeFileSync(sidecar, JSON.stringify({ manifest: { payload: { canonicalIndex: { chapters: [] } } } }));
    const res = await publishFinal(BOOK, { ...commonOpts(fx), keepDebris: true, manifestPath: sidecar, env: {} });
    assert.equal(res.ok, true, res.error);
    assert.equal(res.steps.find((s) => s.step === "preflight:verification-strength"), undefined, "a legacy pair has no candidate to re-read, so the gate does not apply");
  } finally { fx.cleanup(); }
});
