/**
 * WP-201 — run-architecture marker + resume guard.
 *
 * The default conductor architecture flipped to v24 author. These tests pin the guard that
 * prevents the flip from SILENTLY switching a book that was mid-run under a different
 * architecture, plus the absence-safe "record it from now on, treat absence as author-ok"
 * behavior the charter sanctions (resume metadata never recorded the architecture before).
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { test } from "./harness.js";
import {
  RUN_ARCHITECTURE_MARKER_SCHEMA,
  decideResumeArchitecture,
  guardResumeArchitecture,
  readRunArchitecture,
  recordRunArchitecture,
  runArchitectureMarkerPath,
} from "../src/orchestrator/runArchitectureMarker.js";

function tmpRoot(): string {
  return mkdtempSync(join(tmpdir(), "run-arch-marker-"));
}

// ── pure decision (no I/O) ──────────────────────────────────────────────────

test("decideResumeArchitecture: absence → record (author-ok); marker predates the run", () => {
  const d = decideResumeArchitecture({ bookId: "zz", selected: "author", recorded: null, explicit: false });
  assert.deepEqual(d, { ok: true, action: "record" });
});

test("decideResumeArchitecture: marker == selected → proceed", () => {
  const d = decideResumeArchitecture({ bookId: "zz", selected: "author", recorded: "author", explicit: false });
  assert.deepEqual(d, { ok: true, action: "proceed" });
});

test("decideResumeArchitecture: marker != selected WITHOUT an explicit flag → FAIL CLOSED (silent switch refused)", () => {
  const d = decideResumeArchitecture({ bookId: "zz", selected: "author", recorded: "compiler", explicit: false });
  assert.equal(d.ok, false);
  if (!d.ok) {
    assert.match(d.message, /previous run under the compiler architecture/);
    assert.match(d.message, /SILENTLY/);
    // The remedy names BOTH the flag to continue under the recorded arch and the flag to switch.
    assert.match(d.message, /--compiler to continue under compiler/);
    assert.match(d.message, /--author to deliberately switch to author/);
  }
});

test("decideResumeArchitecture: marker != selected WITH an explicit flag → switch allowed (no longer silent)", () => {
  const d = decideResumeArchitecture({ bookId: "zz", selected: "author", recorded: "compiler", explicit: true });
  assert.deepEqual(d, { ok: true, action: "switch" });
});

// ── fs round-trip + guard ───────────────────────────────────────────────────

test("record/readRunArchitecture: round-trips the schema-tagged marker under state/books/<id>/", () => {
  const root = tmpRoot();
  try {
    assert.equal(readRunArchitecture("zz", root), null, "no marker yet → null (absence-safe)");
    recordRunArchitecture("zz", "author", root);
    assert.equal(readRunArchitecture("zz", root), "author");
    const raw = JSON.parse(readFileSync(runArchitectureMarkerPath("zz", root), "utf8"));
    assert.equal(raw.schemaVersion, RUN_ARCHITECTURE_MARKER_SCHEMA);
    assert.equal(raw.architecture, "author");
    assert.equal(raw.bookId, "zz");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("readRunArchitecture: a malformed/unknown-schema marker reads as null (never wedges a run)", () => {
  const root = tmpRoot();
  try {
    const p = runArchitectureMarkerPath("zz", root);
    // Write a wrong-schema marker directly (mkdir via record first, then clobber).
    recordRunArchitecture("zz", "compiler", root);
    writeFileSync(p, JSON.stringify({ schemaVersion: "something-else", architecture: "compiler" }), "utf8");
    assert.equal(readRunArchitecture("zz", root), null);
    writeFileSync(p, "{ not json", "utf8");
    assert.equal(readRunArchitecture("zz", root), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("guardResumeArchitecture: first run records the arch; a silent default switch then fails closed; an explicit flag re-records", () => {
  const root = tmpRoot();
  try {
    // Fresh book, default author, no explicit flag → ok, marker recorded.
    const g1 = guardResumeArchitecture({ bookId: "zz", selected: "author", explicit: false, stateRoot: root });
    assert.equal(g1.ok, true);
    assert.equal(readRunArchitecture("zz", root), "author");

    // Same book resumed under the default (author) again → ok, idempotent.
    const g2 = guardResumeArchitecture({ bookId: "zz", selected: "author", explicit: false, stateRoot: root });
    assert.equal(g2.ok, true);

    // Now a book recorded as compiler: a zero-flag (default author) resume must FAIL CLOSED.
    recordRunArchitecture("cc", "compiler", root);
    const g3 = guardResumeArchitecture({ bookId: "cc", selected: "author", explicit: false, stateRoot: root });
    assert.equal(g3.ok, false);
    // The refusal must NOT have mutated the marker.
    assert.equal(readRunArchitecture("cc", root), "compiler");

    // Passing the explicit --compiler (selected: compiler, explicit: true) matches → ok.
    const g4 = guardResumeArchitecture({ bookId: "cc", selected: "compiler", explicit: true, stateRoot: root });
    assert.equal(g4.ok, true);
    assert.equal(readRunArchitecture("cc", root), "compiler");

    // A deliberate switch (explicit --author over a compiler marker) is allowed and re-records.
    const g5 = guardResumeArchitecture({ bookId: "cc", selected: "author", explicit: true, stateRoot: root });
    assert.equal(g5.ok, true);
    assert.equal(readRunArchitecture("cc", root), "author");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
