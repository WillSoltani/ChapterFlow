import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { runCli } from "./helpers.js";
import { REPO_ROOT } from "../src/lib/chapterPaths.js";
import { stagingPlan, formatPublishAfterQcResult, shouldPrunePostPublish, publishBranchError, dirtySourceOutsidePlan, pushWithRebase, dirtyVsHead, type PublishAfterQcResult } from "../src/qc/publishAfterQc.js";

const BOOK = "zz-fixture-publish-git";
const ROUND = "r-git";
const PACKAGE = resolve(REPO_ROOT, "book-packages", `${BOOK}.v21.json`);
const REGISTRY = resolve(REPO_ROOT, "app/book/data/bookPackages.ts");

function cleanup(): void {
  rmSync(PACKAGE, { force: true });
}

test("publish-after-qc staging plan includes only package unless register-web changed files", () => {
  cleanup();
  try {
    mkdirSync(dirname(PACKAGE), { recursive: true });
    writeFileSync(PACKAGE, JSON.stringify({ schemaVersion: "chapterflow-book-v21", book: { bookId: BOOK }, chapters: [] }) + "\n", "utf8");
    assert.ok(existsSync(REGISTRY), "fixture expects the web registry file to exist");

    const withoutRegistry = stagingPlan(BOOK, ROUND, { registeredFiles: [] });
    assert.deepEqual(withoutRegistry, [PACKAGE]);

    const withRegistry = stagingPlan(BOOK, ROUND, { registeredFiles: [REGISTRY] });
    assert.deepEqual(withRegistry, [REGISTRY, PACKAGE].sort());
  } finally {
    cleanup();
  }
});

test("dirtyVsHead: returns registry files that DIFFER FROM HEAD (modified/untracked/renamed), not just what one register-web call changed", () => {
  const bookPackages = resolve(REPO_ROOT, "app/book/data/bookPackages.ts");
  const catalog = resolve(REPO_ROOT, "app/book/data/booksCatalog.metadata.json");
  const booksJson = resolve(REPO_ROOT, "scripts/book/prompts/chapterflow-v21-authored/books.json");
  const registry = [bookPackages, catalog, booksJson];

  // git status --porcelain: catalog modified (M ), books.json modified+staged (M ), bookPackages CLEAN
  // (absent). The behave orphan: a prior run left the catalog dirty though THIS call changed nothing —
  // diffing vs HEAD still picks it up. Paths are repo-relative in porcelain.
  const status =
    " M app/book/data/booksCatalog.metadata.json\n" +
    "M  scripts/book/prompts/chapterflow-v21-authored/books.json\n";
  const runner = (_cmd: string, a: string[]): string => (a[0] === "status" ? status : "");
  assert.deepEqual(dirtyVsHead(registry, runner).sort(), [catalog, booksJson].sort(), "dirty registry files (incl. books.json) are picked up; the clean one is dropped");

  // A renamed entry → take the destination path.
  const renamed = (_cmd: string, a: string[]): string => (a[0] === "status" ? "R  app/book/data/old.ts -> app/book/data/bookPackages.ts\n" : "");
  assert.deepEqual(dirtyVsHead(registry, renamed), [bookPackages]);

  // Clean tree / git failure → [] (publish then stages only the package, as before).
  assert.deepEqual(dirtyVsHead(registry, () => ""), []);
  assert.deepEqual(dirtyVsHead(registry, () => { throw new Error("git unavailable"); }), []);
  assert.deepEqual(dirtyVsHead([], runner), []);
});

test("stagingPlan: the default promote set now includes books.json (so a dirty registration is committed, not orphaned, and a pre-staged books.json is in-plan)", () => {
  cleanup();
  try {
    mkdirSync(dirname(PACKAGE), { recursive: true });
    writeFileSync(PACKAGE, JSON.stringify({ schemaVersion: "chapterflow-book-v21", book: { bookId: BOOK }, chapters: [] }) + "\n", "utf8");
    const booksJson = resolve(REPO_ROOT, "scripts/book/prompts/chapterflow-v21-authored/books.json");
    assert.ok(existsSync(booksJson), "fixture expects the pipeline books.json to exist");
    // No registeredFiles override ⇒ uses registryFiles(), which now lists books.json.
    const plan = stagingPlan(BOOK, ROUND);
    assert.ok(plan.includes(booksJson), "books.json is part of the default promote set");
    assert.ok(plan.includes(PACKAGE), "the package is always staged");
  } finally {
    cleanup();
  }
});

test("register-web refuses to update registries for an unverified package", () => {
  cleanup();
  const before = readFileSync(REGISTRY, "utf8");
  try {
    mkdirSync(dirname(PACKAGE), { recursive: true });
    writeFileSync(PACKAGE, JSON.stringify({
      schemaVersion: "chapterflow-book-v21",
      book: { bookId: BOOK, title: "Bad Fixture", author: "Nobody" },
      chapters: [],
    }, null, 2) + "\n", "utf8");

    const result = runCli(["register-web", BOOK, "--skip-ingest"]);
    assert.equal(result.status, 1);
    assert.match(result.out, /not verified|refusing/i);
    assert.equal(readFileSync(REGISTRY, "utf8"), before, "registry bytes must stay untouched when package verification fails");
  } finally {
    cleanup();
  }
});

test("formatPublishAfterQcResult: a commit that SUCCEEDED but failed to PUSH is reported accurately (not 'no commit performed')", () => {
  // The mis-report bug: a failed push after a successful commit advanced HEAD, yet the
  // formatter printed "no publish/commit/push performed" — luring a re-run into a
  // DUPLICATE publish commit.
  const result: PublishAfterQcResult = {
    ok: false,
    bookId: BOOK,
    roundId: ROUND,
    commitHash: "abc1234",
    pushed: false,
    staged: [PACKAGE],
    errors: ["Publish commit abc1234 was created locally, but git push FAILED: remote moved"],
    warnings: [],
    next: ["the publish commit abc1234 IS on your local branch — do NOT re-promote from scratch"],
  };
  const out = formatPublishAfterQcResult(result);
  assert.match(out, /commit: abc1234/);
  assert.match(out, /push: FAILED/);
  assert.match(out, /EXISTS locally/);
  assert.doesNotMatch(out, /no publish\/commit\/push performed/, "must NOT claim nothing was committed when a commit exists");
});

test("shouldPrunePostPublish: package-only prune fires ONLY on a fully committed+pushed publish (autopilot parity)", () => {
  // The verify-first `publish-after-qc --commit --push` path should self-clean like the
  // autopilot — but only when the publish actually landed, and never on dry-run/--keep-state.
  const base: PublishAfterQcResult = { ok: true, bookId: "zz-book", commitHash: "abc1234", pushed: true, errors: [], warnings: [] };
  assert.equal(shouldPrunePostPublish(base, { dryRun: false, keepState: false }), true, "committed + pushed, no opt-out → prune");
  assert.equal(shouldPrunePostPublish(base, { dryRun: true, keepState: false }), false, "a dry run never prunes");
  assert.equal(shouldPrunePostPublish(base, { dryRun: false, keepState: true }), false, "--keep-state preserves the working state");
  assert.equal(shouldPrunePostPublish({ ...base, pushed: false }, { dryRun: false, keepState: false }), false, "a failed/absent push never prunes (gated on the real outcome, not the flag)");
  assert.equal(shouldPrunePostPublish({ ...base, commitHash: undefined }, { dryRun: false, keepState: false }), false, "no commit → nothing to serve, never prune");
  assert.equal(shouldPrunePostPublish({ ...base, ok: false }, { dryRun: false, keepState: false }), false, "a failed publish never prunes");
  assert.equal(shouldPrunePostPublish({ ...base, bookId: undefined }, { dryRun: false, keepState: false }), false, "no resolved bookId → never prune");
});

test("publishBranchError: refuses to publish off main, allows main, honors the override", () => {
  // A fake git runner that only answers `rev-parse --abbrev-ref HEAD`.
  const onBranch = (branch: string) => (_cmd: string, a: string[]): string =>
    a.join(" ") === "rev-parse --abbrev-ref HEAD" ? `${branch}\n` : "";

  assert.equal(publishBranchError(onBranch("main")), null, "on main → safe to publish");
  const err = publishBranchError(onBranch("feat/auto-publish-after-qc"));
  assert.ok(
    err && /Refusing to publish off main/.test(err) && /feat\/auto-publish-after-qc/.test(err),
    `off-main commit must be refused loudly, got: ${err}`,
  );

  const prev = process.env.CHAPTERFLOW_ALLOW_PUBLISH_BRANCH;
  process.env.CHAPTERFLOW_ALLOW_PUBLISH_BRANCH = "1";
  try {
    assert.equal(publishBranchError(onBranch("feat/x")), null, "override bypasses the guard");
  } finally {
    if (prev === undefined) delete process.env.CHAPTERFLOW_ALLOW_PUBLISH_BRANCH;
    else process.env.CHAPTERFLOW_ALLOW_PUBLISH_BRANCH = prev;
  }
});

test("dirtySourceOutsidePlan: flags dirty source outside the plan; ignores state, the plan itself, and non-source", () => {
  const inPlan = resolve(REPO_ROOT, "scripts/book/prompts/chapterflow-v21-authored/src/qc/publishAfterQc.ts");
  const status = [
    " M scripts/book/prompts/chapterflow-v21-authored/src/qc/sweep.ts", // dirty source outside plan → flagged
    " M scripts/book/prompts/chapterflow-v21-authored/state/gate-attempts.json", // generated state → ignored
    " M scripts/book/prompts/chapterflow-v21-authored/src/qc/publishAfterQc.ts", // in the plan → ignored
    " M book-packages/zz.v21.json", // published package, not a source surface → ignored
  ].join("\n");
  const runner = (_cmd: string, a: string[]): string => (a[0] === "status" ? status : "");

  const dirty = dirtySourceOutsidePlan(runner, [inPlan]);
  assert.deepEqual(dirty, ["scripts/book/prompts/chapterflow-v21-authored/src/qc/sweep.ts"]);

  // A clean source tree (only state churns) yields nothing.
  const cleanRunner = (_cmd: string, a: string[]): string =>
    a[0] === "status" ? " M scripts/book/prompts/chapterflow-v21-authored/state/x.json\n" : "";
  assert.deepEqual(dirtySourceOutsidePlan(cleanRunner, []), []);
});

// ── pushWithRebase — auto-publish must survive a remote that advanced mid-run ────────────────
// A scripted fake git runner: `git(args, runner)` calls runner("git", args), so match on args[0].
function scriptedGit(handlers: { onPush: () => string; onRebase?: () => string; branch?: string; log: string[] }) {
  return (_cmd: string, a: string[]): string => {
    a = a ?? [];
    a.length && handlers.log.push(a.join(" "));
    if (a[0] === "push") return handlers.onPush();
    if (a.join(" ") === "rev-parse --abbrev-ref HEAD") return `${handlers.branch ?? "main"}\n`;
    if (a[0] === "fetch") return "";
    if (a[0] === "rebase" && a[1] === "--abort") return "";
    if (a[0] === "rebase") return (handlers.onRebase ?? (() => ""))();
    return "";
  };
}

test("pushWithRebase: a clean push (remote unchanged) succeeds WITHOUT fetch/rebase (fast path)", () => {
  const log: string[] = [];
  const r = pushWithRebase(scriptedGit({ onPush: () => "", log }));
  assert.equal(r.pushed, true);
  assert.ok(!log.some((c) => c.startsWith("fetch") || c.startsWith("rebase")), "happy path must not reconcile");
});

test("pushWithRebase: remote ADVANCED (push rejected once) → fetch + rebase + retry → pushed", () => {
  const log: string[] = [];
  let pushCalls = 0;
  const r = pushWithRebase(scriptedGit({
    onPush: () => { pushCalls++; if (pushCalls === 1) throw new Error("! [rejected] main -> main (non-fast-forward)"); return ""; },
    onRebase: () => "", // rebase onto the advanced remote is clean
    log,
  }));
  assert.equal(r.pushed, true, "after reconciling with the advanced remote, the retry push succeeds");
  assert.ok(log.includes("fetch origin main"), "fetched the advanced remote");
  assert.ok(log.includes("rebase --autostash origin/main"), "rebased the publish commit onto it (autostash for run churn)");
  assert.equal(pushCalls, 2, "exactly one retry after the reconcile");
});

test("pushWithRebase: a REAL rebase conflict ABORTS and surfaces the error (never force-pushes)", () => {
  const log: string[] = [];
  const r = pushWithRebase(scriptedGit({
    onPush: () => { throw new Error("non-fast-forward"); },
    onRebase: () => { throw new Error("CONFLICT (content): merge conflict in book-packages/x.v21.json"); },
    log,
  }));
  assert.equal(r.pushed, false);
  assert.match(r.error ?? "", /auto-rebase onto origin\/main failed/);
  assert.match(r.error ?? "", /do NOT force-push/);
  assert.ok(log.includes("rebase --abort"), "a failed rebase must be aborted, never left in progress or forced");
  assert.ok(!log.some((c) => c.includes("--force") || c.includes("-f")), "must never force-push");
});

test("pushWithRebase: an autostash POP-conflict (rebase exits 0 but leaves UU) is cleaned up — never pushes/leaves a marker-laden tree", () => {
  // The subtle case: the publish COMMIT replays clean (so push succeeds + remote is correct), but
  // re-applying the autostashed run-churn (shared state/gate-attempts.json) onto the advanced remote
  // conflicts WITHOUT throwing — rebase exits 0 yet leaves UU markers + an orphaned stash. Must be
  // resolved (take HEAD's version + drop the stash), else JSON.parse later silently wipes history.
  const log: string[] = [];
  let pushCalls = 0;
  let cleaned = false;
  const runner = (_cmd: string, a: string[]): string => {
    a = a ?? []; if (a.length) log.push(a.join(" "));
    if (a[0] === "push") { pushCalls++; if (pushCalls === 1) throw new Error("non-fast-forward"); return ""; }
    if (a.join(" ") === "rev-parse --abbrev-ref HEAD") return "main\n";
    if (a[0] === "fetch") return "";
    if (a[0] === "rebase") return ""; // exits 0 — commit replayed clean, but autostash pop left UU
    if (a.join(" ") === "diff --name-only --diff-filter=U") {
      return cleaned ? "" : "scripts/book/prompts/chapterflow-v21-authored/state/gate-attempts.json\n";
    }
    if (a[0] === "checkout" && a[1] === "HEAD") { cleaned = true; return ""; }
    return "";
  };
  const r = pushWithRebase(runner);
  assert.equal(r.pushed, true, "the publish commit replayed clean → it still pushes");
  assert.ok(log.some((c) => c.startsWith("checkout HEAD -- ")), "took the rebased version of the conflicted churn");
  assert.ok(log.includes("stash drop"), "dropped the orphaned autostash so no UU/markers are left behind");
});

test("pushWithRebase: a detached HEAD cannot auto-rebase → fails safe with a clear error", () => {
  const r = pushWithRebase(scriptedGit({ onPush: () => { throw new Error("rejected"); }, branch: "HEAD", log: [] }));
  assert.equal(r.pushed, false);
  assert.match(r.error ?? "", /detached HEAD/);
});

test("formatPublishAfterQcResult: a genuine PRE-commit failure still says 'no commit performed'", () => {
  const result: PublishAfterQcResult = {
    ok: false,
    bookId: BOOK,
    roundId: ROUND,
    pushed: false,
    errors: ["QC is not all-green: allPublishable=false incomplete=false repairRequired=true."],
    warnings: [],
  };
  const out = formatPublishAfterQcResult(result);
  assert.match(out, /no publish\/commit\/push performed/);
  assert.doesNotMatch(out, /EXISTS locally/);
});
