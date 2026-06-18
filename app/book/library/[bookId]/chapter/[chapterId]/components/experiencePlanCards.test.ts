/**
 * Render proof for the two behavior-change cards. The round-trip test in
 * app/book/lib/v21-adapter.test.ts proves the DATA reaches BookChapter; this
 * proves the components RENDER that data (and degrade to nothing when absent).
 * Uses React.createElement (no JSX) so it lives in a .test.ts the runner globs.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { FailureRecoveryCard } from "./FailureRecoveryCard";
import { TransferPromptCard } from "./TransferPromptCard";

test("FailureRecoveryCard renders every part of a complete failureRecovery", () => {
  const html = renderToStaticMarkup(
    createElement(FailureRecoveryCard, {
      failureRecovery: {
        normalizingLine: "NORMALIZE_MARKER the slip is the brain trading hard work for a faster reward.",
        cueQuestion: "CUE_MARKER what pressure pushed you here?",
        options: ["OPTION_ALPHA move the phone away", "OPTION_BETA name the task aloud"],
        repairLine: "REPAIR_MARKER close it, set a timer, reopen the work.",
      },
    }),
  );
  for (const marker of ["If you slip", "NORMALIZE_MARKER", "CUE_MARKER", "OPTION_ALPHA", "OPTION_BETA", "REPAIR_MARKER"]) {
    assert.match(html, new RegExp(marker), `expected rendered markup to contain "${marker}"`);
  }
  assert.match(html, /role="note"/, "failure-recovery should be an accessible note region");
});

test("FailureRecoveryCard renders nothing when the field is absent", () => {
  assert.equal(renderToStaticMarkup(createElement(FailureRecoveryCard, { failureRecovery: undefined })), "");
});

test("TransferPromptCard renders the prompt and every context", () => {
  const html = renderToStaticMarkup(
    createElement(TransferPromptCard, {
      transferPrompt: {
        prompt: "TRANSFER_MARKER where else does this cost you?",
        contexts: ["CONTEXT_ALPHA bills", "CONTEXT_BETA hard conversations"],
      },
    }),
  );
  for (const marker of ["Where else this applies", "TRANSFER_MARKER", "CONTEXT_ALPHA", "CONTEXT_BETA"]) {
    assert.match(html, new RegExp(marker), `expected rendered markup to contain "${marker}"`);
  }
});

test("TransferPromptCard renders nothing when the field is absent", () => {
  assert.equal(renderToStaticMarkup(createElement(TransferPromptCard, { transferPrompt: undefined })), "");
});
