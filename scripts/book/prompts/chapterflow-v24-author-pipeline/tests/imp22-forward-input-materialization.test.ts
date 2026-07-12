/** Real-archive, model-free IMP-22 input materialization regression. */

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { sha256Hex } from "../src/contracts/contractUtil.js";
import {
  IMP22_FORWARD_INPUT_EXPECTED_HASHES,
  materializeImp22ForwardInputs,
} from "../src/orchestrator/forwardInputMaterialization.js";
import { test } from "./harness.js";
import { mkTestRoots } from "./testRoots.js";

function filesUnder(root: string): string[] {
  const files: string[] = [];
  const visit = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) visit(path);
      else files.push(path);
    }
  };
  visit(root);
  return files.sort((a, b) => a.localeCompare(b));
}

function treeHashes(root: string): Record<string, string> {
  return Object.fromEntries(filesUnder(root).map((path) => [path.slice(root.length + 1), sha256Hex(readFileSync(path))]));
}

test("IMP-22 real pilot/gold inputs materialize reproducibly without prior prose or canonical chapters", () => {
  const roots = mkTestRoots("imp22-real-forward-inputs");
  try {
    const stateRoot = join(roots.base, "migration-experiments");
    const first = materializeImp22ForwardInputs(stateRoot);
    assert.equal(first.freeze.freezeSha256, IMP22_FORWARD_INPUT_EXPECTED_HASHES.freezeSha256);
    assert.equal(first.freeze.pilot.flatMap((book) => book.chapters).length, 8);
    assert.equal(first.freeze.goldChapterCount, 13);
    assert.deepEqual(
      first.freeze.pilot.flatMap((book) => book.chapters).map((chapter) => `${chapter.bookId}:ch${String(chapter.chapterNumber).padStart(2, "0")}:${chapter.stratum}`),
      [
        "radical-candor:ch01:abstract-conceptual",
        "radical-candor:ch02:example-heavy",
        "radical-candor:ch03:causal-quiz-sensitive",
        "radical-candor:ch04:research-heavy",
        "start-with-why:ch01:example-heavy",
        "start-with-why:ch02:causal-quiz-sensitive",
        "start-with-why:ch03:research-heavy",
        "start-with-why:ch07:abstract-conceptual",
      ],
    );
    assert.equal(first.freeze.goldStratumAssignmentSha256, IMP22_FORWARD_INPUT_EXPECTED_HASHES.goldStratumAssignmentSha256);
    assert.equal(existsSync(join(first.pilotRoot, "inputs", "radical-candor", "chapters")), false);
    assert.equal(existsSync(join(first.goldRoot, "inputs", "the-gifts-of-imperfection", "chapters")), false);

    const manifestText = readFileSync(join(first.pilotRoot, "input-materialization.json"), "utf8");
    assert.equal(manifestText.includes("/Users/"), false);
    assert.equal(manifestText.includes("/private/tmp/"), false);
    assert.equal(manifestText.includes('"priorChapterProseUsed":false'), true);
    assert.equal(manifestText.includes('"publish":false'), true);
    assert.equal(manifestText.includes('"promote":false'), true);

    const before = treeHashes(stateRoot);
    const second = materializeImp22ForwardInputs(stateRoot);
    assert.equal(second.freeze.freezeSha256, first.freeze.freezeSha256);
    assert.deepEqual(treeHashes(stateRoot), before);
    assert.equal(
      readFileSync(join(first.pilotRoot, "input-freeze.json"), "utf8"),
      readFileSync(join(first.goldRoot, "input-freeze.json"), "utf8"),
    );
  } finally {
    roots.dispose();
  }
});
