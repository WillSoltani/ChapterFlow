import assert from "node:assert/strict";

import { BookRunApplicationService, BOOK_RUN_PHASES } from "../../src/app/bookRunApplicationService.js";
import { CandidateQcEvaluator } from "../../src/app/candidateQcEvaluator.js";
import { CompilerApplicationPort } from "../../src/app/compilerApplicationPort.js";
import { ResearchCandidateApplicationPort } from "../../src/app/researchCandidateApplicationPort.js";
import { finishV25Tests, requiredTest } from "./harness.js";

requiredTest("production book run exposes one application boundary per durable lifecycle", () => {
  const boundaries = [
    ["ResearchCandidateApplicationPort", ResearchCandidateApplicationPort],
    ["CompilerApplicationPort", CompilerApplicationPort],
    ["CandidateQcEvaluator", CandidateQcEvaluator],
    ["BookRunApplicationService", BookRunApplicationService],
  ] as const;

  for (const [name, boundary] of boundaries) {
    assert.equal(typeof boundary, "function", `${name} must be constructible`);
    assert.equal(typeof boundary.prototype.run, "function", `${name} must expose run()`);
  }
});

requiredTest("production book run has exact local-only phase contract", () => {
  assert.deepEqual([...BOOK_RUN_PHASES], [
    "intake",
    "research",
    "seed",
    "compile",
    "review",
    "fresh-qc",
    "repair",
    // R-080 — the whole-book catalog-rubric gate, added between repair and
    // promotion. Nothing was removed or reordered: the pin above is the
    // pre-existing eight phases with one inserted where the gate runs.
    "rubric",
    "promotion",
  ]);
  assert.equal(Object.isFrozen(BOOK_RUN_PHASES), true);
  assert.equal(BOOK_RUN_PHASES.some((phase) => phase.includes("canonical-state")), false);
  assert.equal(BOOK_RUN_PHASES.some((phase) => phase.includes("publish")), false);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
