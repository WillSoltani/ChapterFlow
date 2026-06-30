import assert from "node:assert/strict";
import { readFileSync, rmSync } from "fs";

import { test } from "./harness.js";
import { openQcRound, qcRoundPath, verifyQcRoundToken } from "../src/qc/qcRound.js";

const BOOK = "zz-fixture-qc-round";

test("qc round tokens verify only for the correct role, and plaintext is never stored", () => {
  const roundId = "r-test";
  const path = qcRoundPath(BOOK, roundId);
  rmSync(path, { force: true });
  try {
    const { tokens } = openQcRound(BOOK, roundId);
    assert.equal(verifyQcRoundToken(BOOK, roundId, "sweep", tokens.sweep), true);
    assert.equal(verifyQcRoundToken(BOOK, roundId, "keyA", tokens.sweep), false, "a valid token for one role must not verify for another");
    assert.equal(verifyQcRoundToken(BOOK, roundId, "sweep", "wrong-token"), false);

    const stored = readFileSync(path, "utf8");
    for (const token of Object.values(tokens)) {
      assert.doesNotMatch(stored, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "round file must store hashes only");
    }
    assert.match(stored, /tokenHash/);
    assert.match(stored, /salt/);
  } finally {
    rmSync(path, { force: true });
  }
});
