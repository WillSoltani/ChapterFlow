import { test } from "node:test";
import assert from "node:assert/strict";
import { getApplicationAxisView } from "./application-axis";
import type { ChapterApplicationState } from "@/app/app/api/book/_lib/types";

/**
 * Two-axis completion (feedback #4) — APPLICATION axis celebration copy.
 *
 * Guards the per-state copy the modal renders and the key contract that the
 * invitation appears ONLY for "none" (so it hides the moment a commitment exists —
 * correct under either phase ordering). Display-only: this never gates anything.
 */

test("applied → gold celebration, not an invitation", () => {
  const v = getApplicationAxisView("applied");
  assert.equal(v.tone, "applied");
  assert.equal(v.isInvitation, false);
  assert.equal(v.label, "Applied");
  assert.match(v.description, /came back/i);
});

test("committed → neutral confirmation, not an invitation", () => {
  const v = getApplicationAxisView("committed");
  assert.equal(v.tone, "committed");
  assert.equal(v.isInvitation, false);
  assert.equal(v.label, "Committed");
  assert.match(v.description, /if-then plan/i);
});

test("none → invitation pointing at the commitment prompt", () => {
  const v = getApplicationAxisView("none");
  assert.equal(v.tone, "invite");
  assert.equal(v.isInvitation, true);
  assert.match(v.description, /if-then action/i);
});

test("the invitation shows ONLY for 'none' (hidden once committed/applied)", () => {
  const states: ChapterApplicationState[] = ["none", "committed", "applied"];
  const invitationStates = states.filter(
    (s) => getApplicationAxisView(s).isInvitation,
  );
  assert.deepEqual(invitationStates, ["none"]);
});

test("every state yields non-empty label + description", () => {
  for (const s of ["none", "committed", "applied"] as ChapterApplicationState[]) {
    const v = getApplicationAxisView(s);
    assert.ok(v.label.length > 0, `label for ${s}`);
    assert.ok(v.description.length > 0, `description for ${s}`);
  }
});
