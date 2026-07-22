import { test } from "node:test";
import assert from "node:assert/strict";

import { loadNotebookReads } from "./notebook-read-core";

/**
 * WS4-009: the Notebook GET handler issued its three reads (chapter states,
 * commitments, highlights) as three sequential `await`s — each one paying
 * the full round-trip latency of the last before the next even starts. This
 * proves the fan-out dispatches all three thunks BEFORE any of them
 * resolves, so they run concurrently regardless of the order the caller
 * later awaits their results in.
 */
test("loadNotebookReads dispatches all three reads before any resolves", async () => {
  const invokedBeforeAnyResolved: string[] = [];
  const resolvedOrder: string[] = [];

  function deferred<T>(label: string, value: T) {
    let resolve!: () => void;
    const gate = new Promise<void>((r) => {
      resolve = r;
    });
    const thunk = () => {
      invokedBeforeAnyResolved.push(label);
      return gate.then(() => {
        resolvedOrder.push(label);
        return value;
      });
    };
    return { thunk, resolve };
  }

  const chapterStates = deferred("chapterStates", [{ a: 1 }]);
  const commitments = deferred("commitments", [{ b: 2 }]);
  const highlights = deferred("highlights", [{ c: 3 }]);

  const promise = loadNotebookReads({
    chapterStates: chapterStates.thunk,
    commitments: commitments.thunk,
    highlights: highlights.thunk,
  });

  // All three thunks must have been invoked synchronously, before ANY of
  // them has resolved — proving they run concurrently, not serially.
  assert.deepEqual(
    invokedBeforeAnyResolved.sort(),
    ["chapterStates", "commitments", "highlights"],
    "all three reads must be dispatched before any resolves",
  );
  assert.deepEqual(resolvedOrder, [], "nothing should have resolved yet");

  // Resolve out of declared order to prove there is no serial dependency.
  commitments.resolve();
  highlights.resolve();
  chapterStates.resolve();

  const result = await promise;
  assert.deepEqual(result.chapterStates, [{ a: 1 }]);
  assert.deepEqual(result.commitments, [{ b: 2 }]);
  assert.deepEqual(result.highlights, [{ c: 3 }]);
});
