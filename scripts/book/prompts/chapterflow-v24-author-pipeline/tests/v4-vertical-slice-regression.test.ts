import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { test } from "./harness.js";

type Evidence = Readonly<{ path: string; markers: readonly string[] }>;

function assertRecordedEvidence(...evidence: readonly Evidence[]): void {
  for (const item of evidence) {
    const source = readFileSync(resolve(process.cwd(), item.path), "utf8");
    for (const marker of item.markers) assert.ok(source.includes(marker), `${item.path} missing recorded evidence: ${marker}`);
  }
}

test("LC-01 admission and recovery retains last-slot and uncertain-no-replay observations", () => {
  assertRecordedEvidence(
    { path: "tests/v25/run-store.test.ts", markers: ["last-slot contenders consume one durable admission", "crash-shaped admitted work becomes stale without replay"] },
    { path: "src/run-state/runStore.ts", markers: ["admitAttempt", "finishAttempt"] },
  );
});

test("LC-02 process bounds retains bounded streams descendant cleanup and terminal observations", () => {
  assertRecordedEvidence(
    { path: "tests/v25/process-supervisor.test.ts", markers: ["stdout overflow is independently bounded and terminates tree", "stderr overflow is independently bounded and terminates tree", "normal root exit still removes surviving descendant before return"] },
    { path: "src/runtime/processSupervisor.ts", markers: ["ProcessSupervisor"] },
  );
});

test("LC-03 gateway route retains one-process admission order and invalid-profile blocking observations", () => {
  assertRecordedEvidence(
    { path: "tests/v25/model-gateway.test.ts", markers: ["valid task orders validation admission process output validation and terminal", "invalid profile workdir and pre-admission cancellation start no process"] },
    { path: "src/runtime/modelGateway.ts", markers: ["ModelGateway"] },
  );
});

test("LC-04 candidate and read purity retains exact inventory immutability checksum and pure-read observations", () => {
  assertRecordedEvidence(
    { path: "tests/v25/candidate-store-reader.test.ts", markers: ["complete candidate stages and reopens with stable ordered bytes and checksum", "immutable candidate rejects overwrite, inventory drift, and byte drift without repair", "pure CURRENT read preserves path byte mode mtime inventory and never falls back"] },
    { path: "src/books/candidateTypes.ts", markers: ["CandidateStore", "BookContentReader"] },
  );
});

test("LC-05 resume and cancellation retains same-run checkpoint changed-identity and reconciliation observations", () => {
  assertRecordedEvidence(
    { path: "tests/v25/stage-resume.test.ts", markers: ["checkpoint replay is byte-idempotent and resume order is deterministic", "changed run identity conflicts without importing checkpoints"] },
    { path: "tests/v25/stage-cancel.test.ts", markers: ["durable cancellation blocks work and waits for reconciliation"] },
    { path: "src/run-state/stageTypes.ts", markers: ["StageCoordinator"] },
  );
});

test("LC-06 review and QC retains canonical authority fresh exact join and pure-read observations", () => {
  assertRecordedEvidence(
    { path: "tests/v25/review-authority.test.ts", markers: ["screening writes no canonical record and has no QC authority"] },
    { path: "tests/v25/qc-service.test.ts", markers: ["fresh QC exact join creates one idempotent PASS round", "QC identity mismatch writes zero bytes"] },
    { path: "tests/v25/qc-pure-read.test.ts", markers: ["review and QC status getters preserve path byte mode and mtime inventory"] },
  );
});

test("LC-07 promotion retains one-winner atomic visibility and verified-readback observations", () => {
  assertRecordedEvidence(
    { path: "tests/v25/promotion-concurrency.test.ts", markers: ["two concurrent valid promotions for one revision have one verified winner and one conflict"] },
    { path: "tests/v25/promotion-atomicity.test.ts", markers: ["replace exposes complete old or complete new candidate", "post-commit readback failure returns reconciliation blocker with no publication action"] },
    { path: "src/release/promotionTypes.ts", markers: ["PromotionService"] },
  );
});

test("LC-08 repair re-entry retains immutable successor fresh review-QC and current-diagnosis observations", () => {
  assertRecordedEvidence(
    { path: "tests/content-repair-review.test.ts", markers: ["first repair preserves predecessor and creates reviewed fresh-QC successor", "old canonical review cannot authorize successor", "second repair without diagnosis blocks before candidate creation", "matching diagnosis permits one ordinal-two successor"] },
    { path: "src/app/contentRepairWorkflow.ts", markers: ["REPAIR_REVIEW_STALE", "REPAIR_QC_ROUND_REUSED"] },
  );
});

test("LC-09 migration and qualification retains cutover rollback no-live and zero-bypass observations", () => {
  assertRecordedEvidence(
    { path: "tests/v25/v4-canonical-promotion-adapters-migration.test.ts", markers: ["pure package and manifest parity survives real canonical adapter release", "never re-enables legacy after V4 authority"] },
    { path: "tests/v25/v4-publish-release-migration.test.ts", markers: ["no-live release and legacy shadow keep remote network credential and execution counts zero"] },
    { path: "tests/legacy-route-removal.test.ts", markers: ["legacy inventory deep-equals independent path, symbol, and disposition set", "STABLE_DISABLED"] },
  );
});
