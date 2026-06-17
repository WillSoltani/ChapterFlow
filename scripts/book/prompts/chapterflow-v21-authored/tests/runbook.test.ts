/**
 * runbookPlan — the pure phase→orchestrate mapping behind `runbook <book>`. It must mirror the
 * RUN-A-BOOK.md phase table: each honest book-status phase points to the right orchestrate prompt
 * and next command, and the QC/Publish next commands carry the strict env.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { runbookPlan, formatRunbook, STRICT_ENV } from "../src/runbook.js";

test("runbookPlan maps each book-status phase to the right orchestrate prompt + next command", () => {
  const qc = runbookPlan("qc", "zz-book");
  assert.equal(qc.label, "QC");
  assert.match(qc.openPrompt, /QC-ORCHESTRATE-CODEX-SESSION\.md/);
  assert.match(qc.next, /qc-auto "zz-book" --pass --max-agents 6/);

  const pub = runbookPlan("ready to publish", "zz-book");
  assert.equal(pub.label, "Publish");
  assert.match(pub.openPrompt, /PUBLISH-AFTER-QC-CODEX-SESSION\.md/);
  assert.match(pub.next, /publish-after-qc "zz-book" --round <PASS-roundId> --dry-run/);

  assert.equal(runbookPlan("gating", "zz-book").label, "Write");
  assert.equal(runbookPlan("generating (2/7 written)", "zz-book").label, "Write");
  assert.equal(runbookPlan("research-bibliography", "zz-book").label, "Research");
  assert.equal(runbookPlan("shipped", "zz-book").label, "Shipped");
});

test("runbookPlan threads the strict env into the QC and Publish next commands", () => {
  for (const phase of ["qc", "ready to publish"]) {
    const plan = runbookPlan(phase, "zz-book");
    for (const e of STRICT_ENV) assert.ok(plan.next.includes(e), `${phase} next command must carry ${e}`);
  }
});

test("formatRunbook prints phase, strict env, next, prompt, the session-id footgun, and warnings", () => {
  const out = formatRunbook("zz-book", "qc", runbookPlan("qc", "zz-book"), ["source-verify record present and PASS"]);
  assert.match(out, /ChapterFlow Runbook — zz-book/);
  assert.match(out, /phase: QC/);
  assert.match(out, /CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE=1/);
  assert.match(out, /CHAPTERFLOW_SESSION_ID FRESH per phase/);
  assert.match(out, /source-verify record present and PASS/);
});
