import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";

import { test } from "./harness.js";
import { REPO_ROOT } from "../src/lib/chapterPaths.js";
import { stagingPlan, formatPublishAfterQcResult, publishBranchError, dirtySourceOutsidePlan, pushWithRebase, type PublishAfterQcResult } from "../src/qc/publishAfterQc.js";

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
