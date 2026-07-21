/**
 * runbookPlan — the pure phase→orchestrate mapping behind `runbook <book>`. It must mirror the
 * RUN-A-BOOK.md phase table: each honest book-status phase points to the right orchestrate prompt
 * and next command, and the QC/Publish next commands carry the strict env. The control-panel
 * formatters (text + json) must render the live env OK/MISSING, the gate/record state, and blockers.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  runbookPlan,
  formatRunbook,
  runbookJson,
  strictEnvStatus,
  STRICT_ENV,
  type RunbookStatus,
} from "../src/runbook.js";

function status(over: Partial<RunbookStatus> = {}): RunbookStatus {
  return {
    phase: "qc",
    env: strictEnvStatus({ CHAPTERFLOW_NO_API_CODEX_QC: "1", CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE: "1" }),
    sourceV2: "PASS",
    sourceVerify: "PRESENT_BAD",
    qcRound: "r20260617025157-b9b1bf",
    blockers: [{ kind: "sourceVerify", message: "SV4 rubber-stamp detected" }],
    notes: [],
    ...over,
  };
}

test("runbookPlan maps each book-status phase to the right orchestrate prompt + next command", () => {
  const qc = runbookPlan("qc", "zz-book");
  assert.equal(qc.label, "QC");
  assert.match(qc.openPrompt, /QC-ORCHESTRATE-CODEX-SESSION\.md/);
  assert.match(qc.next, /qc-auto "zz-book" --pass --max-agents 6/);

  const pub = runbookPlan("ready to publish", "zz-book");
  assert.equal(pub.label, "Publish");
  assert.match(pub.openPrompt, /PUBLISH-AFTER-QC-CODEX-SESSION\.md/);
  assert.match(pub.next, /publish-after-qc "zz-book" --round <PASS-roundId> --dry-run/);

  assert.equal(runbookPlan("write-chapter", "zz-book").label, "Write", "research-complete (0 chapters written) is the WRITE handoff, not more research");
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

test("strictEnvStatus marks a var set only when it equals \"1\"", () => {
  const s = strictEnvStatus({ CHAPTERFLOW_NO_API_CODEX_QC: "1", CHAPTERFLOW_REQUIRE_SOURCE_VERIFY: "0" });
  const byName = Object.fromEntries(s.map((e) => [e.name, e.set]));
  assert.equal(byName["CHAPTERFLOW_NO_API_CODEX_QC"], true);
  assert.equal(byName["CHAPTERFLOW_REQUIRE_SOURCE_VERIFY"], false); // "0" is not set
  assert.equal(byName["CHAPTERFLOW_ENFORCE_SESSION_INDEPENDENCE"], false); // absent
});

test("formatRunbook renders live env OK/MISSING, the state lines, the footgun, and blockers", () => {
  const out = formatRunbook("zz-book", runbookPlan("qc", "zz-book"), status());
  assert.match(out, /ChapterFlow Runbook — zz-book/);
  assert.match(out, /phase: QC {2}\(book-status: qc\)/);
  assert.match(out, /CHAPTERFLOW_NO_API_CODEX_QC=1 +OK/);
  assert.match(out, /CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1 +MISSING/); // not in the test env
  assert.match(out, /CHAPTERFLOW_SESSION_ID FRESH per phase/);
  assert.match(out, /source-v2: +PASS/);
  assert.match(out, /source-verify: +PRESENT BUT BAD/);
  assert.match(out, /qc round: +r20260617025157-b9b1bf/);
  assert.match(out, /\[sourceVerify\] SV4 rubber-stamp detected/);
});

test("formatRunbook prints 'none' when there are no blockers and shows notes", () => {
  const out = formatRunbook("zz-book", runbookPlan("qc", "zz-book"), status({ blockers: [], notes: ["token reminder"] }));
  assert.match(out, /blockers:\n {2}none/);
  assert.match(out, /notes:\n {2}token reminder/);
});

test("runbookJson exposes a harness-feedable model: phase, strictEnv booleans, blockers, next", () => {
  const j = runbookJson("zz-book", runbookPlan("qc", "zz-book"), status()) as any;
  assert.equal(j.bookId, "zz-book");
  assert.equal(j.phase, "qc");
  assert.equal(j.label, "QC");
  assert.deepEqual(j.strictEnv, { noApi: true, sourceVerifyRequired: false, sessionIndependence: true });
  assert.equal(j.sourceVerify, "PRESENT_BAD");
  assert.equal(j.qcRound, "r20260617025157-b9b1bf");
  assert.equal(j.blockers[0].kind, "sourceVerify");
  assert.match(j.next.command, /qc-auto "zz-book"/);
  assert.match(j.next.prompt, /QC-ORCHESTRATE-CODEX-SESSION\.md/);
});

test("failed lifecycle qualification renders safe diagnostic rollback boundary and manual owner without telemetry", () => {
  const qualification = {
    owner: "LC-08",
    message: "required lifecycle case is FAIL",
    safeDiagnostic: "qc-diagnose fixture-book --round round-failed",
    rollbackBoundary: "retain predecessor and successor; disable successor promotion",
    manualOwner: "release owner reviews local optional evidence",
  };
  const withFailure = status({ qualification });
  const out = formatRunbook("fixture-book", runbookPlan("qc", "fixture-book"), withFailure);
  assert.match(out, /\[LC-08\] BLOCKED — required lifecycle case is FAIL/);
  assert.match(out, /safe diagnostic: qc-diagnose fixture-book --round round-failed/);
  assert.match(out, /rollback boundary: retain predecessor and successor; disable successor promotion/);
  assert.match(out, /manual owner: release owner reviews local optional evidence/);
  assert.match(out, /telemetry exporter not required/);

  const json = runbookJson("fixture-book", runbookPlan("qc", "fixture-book"), withFailure) as any;
  assert.deepEqual(json.qualification, qualification);
});
