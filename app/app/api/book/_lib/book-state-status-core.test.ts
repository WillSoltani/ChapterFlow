import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildBookStateGetResponse,
  resolveBookStateStatus,
} from "./book-state-status-core";

test("persisted book state is authoritative started state", () => {
  assert.equal(
    resolveBookStateStatus({ hasBookState: true, hasProgress: false }),
    "started",
  );
});

test("legacy progress without book state is still started", () => {
  assert.equal(
    resolveBookStateStatus({ hasBookState: false, hasProgress: true }),
    "started",
  );
});

test("absence of both book state and progress is not started", () => {
  assert.equal(
    resolveBookStateStatus({ hasBookState: false, hasProgress: false }),
    "not_started",
  );
});

test("application-state degradation cannot change authoritative state status", () => {
  const available = buildBookStateGetResponse({
    state: { bookId: "book-synthetic" },
    applicationStates: { chapter1: { status: "completed" } },
    hasBookState: false,
    hasProgress: true,
  });
  const degraded = buildBookStateGetResponse({
    state: { bookId: "book-synthetic" },
    applicationStates: {},
    hasBookState: false,
    hasProgress: true,
  });

  assert.equal(available.stateStatus, "started");
  assert.equal(degraded.stateStatus, "started");
  assert.deepEqual(Object.keys(degraded).sort(), [
    "applicationStates",
    "state",
    "stateStatus",
  ]);
});
