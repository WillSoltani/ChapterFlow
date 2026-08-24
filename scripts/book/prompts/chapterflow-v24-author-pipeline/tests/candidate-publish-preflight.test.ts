/**
 * The candidate-aware publish preflight (`src/publish/candidatePreflight.ts`).
 *
 * Every case is hermetic: the pair, the sidecar and the v25 root are built in a
 * tmp dir, and the candidate snapshot / CURRENT pointer arrive through the
 * `openCandidate` / `readPointer` seams. No test reads the repo's real
 * `book-packages/`, `state/`, git tree, or any v25 root on this machine.
 *
 * WHAT THESE CASES PIN, and why each one exists:
 *
 *  (a) A candidate-regime pair is verified WITH its sidecar, and the strength is
 *      reported as the replay it actually is.
 *  (b) `--v25-root` + a sidecar naming a DIFFERENT candidate than the CURRENT
 *      pointer is REFUSED before the candidate is ever opened.
 *  (c) The re-authored-pair residual: a package whose chapter set is a strict
 *      subset of the candidate's, paired with a sidecar re-authored over that
 *      smaller set, is invisible to a two-file verify and is CAUGHT by the
 *      candidate-store re-verify. This is the case the whole module exists for,
 *      and it is asserted in BOTH directions (weak mode passes it, strong mode
 *      refuses it) so a future change that silently strengthens the weak mode or
 *      weakens the strong one fails here.
 *  (d) CONTROL: the legacy canonical-index pair is untouched — same verifier
 *      options, same verdict, and a strength line that says "legacy".
 *
 * The forged-pair cases drive `compareCandidateInventory` directly rather than
 * through a real 400-file candidate, because the property under test is exactly
 * "package chapter set vs candidate chapter inventory" and nothing else.
 */
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { test } from "./harness.js";
import type { CandidateSnapshot } from "../src/books/candidateTypes.js";
import {
  candidateChapterIds,
  compareCandidateInventory,
  defaultManifestPathForBook,
  publishPreflightVerify,
  readDeclaredCandidate,
  type CandidateOpener,
  type PointerReader,
} from "../src/publish/candidatePreflight.js";

const BOOK = "zz-fixture-candidate-preflight";
const CANDIDATE_ID = "repair-candidate-0123456789abcdef0123456789abcdef";
const DIGEST = "a".repeat(64);
const OTHER_DIGEST = "b".repeat(64);

function tmpRoot(label: string): string {
  return resolve(tmpdir(), `cf-candidate-preflight-${label}-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
}

function chapterId(n: number): string {
  return `${BOOK}-ch0${n}`;
}

/** A minimal candidate snapshot carrying `count` CHAPTER artifacts. Only the
 *  fields the inventory check reads are populated; `files` entries mirror the
 *  kind-tagged shape `bookContentReader` returns. */
function snapshotWithChapters(count: number, opts?: { candidateId?: string; manifestDigest?: string }): CandidateSnapshot {
  const files = [] as unknown as CandidateSnapshot["files"];
  const list = files as unknown as Array<Record<string, unknown>>;
  for (let n = 1; n <= count; n++) {
    list.push({
      kind: "CHAPTER",
      mediaType: "application/json",
      logicalPath: `content/chapters/${chapterId(n)}.v21-native.chapter.json`,
      byteLength: 2,
      bytes: new Uint8Array([123, 125]),
    });
  }
  // A non-chapter entry must never contribute to the inventory.
  list.push({
    kind: "SIDECAR",
    mediaType: "application/json",
    logicalPath: "inputs/source/ch01.source.json",
    byteLength: 2,
    bytes: new Uint8Array([123, 125]),
  });
  return {
    manifest: {
      schemaVersion: "1",
      bookId: BOOK,
      candidateId: opts?.candidateId ?? CANDIDATE_ID,
      createdByRunId: "run-fixture",
      entries: [],
      manifestDigest: opts?.manifestDigest ?? DIGEST,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    files,
  } as unknown as CandidateSnapshot;
}

/** A sidecar declaring the CANDIDATE regime. Deliberately NOT a valid manifest —
 *  these cases assert the pointer/inventory layers, which run before and after
 *  the verifier respectively and are independent of its verdict. */
function candidateSidecar(opts?: { candidateId?: string; manifestDigest?: string }): string {
  return JSON.stringify({
    schemaVersion: "chapterflow-production-manifest-sidecar-v1",
    bookId: BOOK,
    manifest: {
      payload: {
        candidateChapterSet: {
          source: "candidate",
          candidateId: opts?.candidateId ?? CANDIDATE_ID,
          manifestDigest: opts?.manifestDigest ?? DIGEST,
        },
      },
    },
  }, null, 2);
}

/** A sidecar declaring the LEGACY canonical-index regime (no candidate block). */
function legacySidecar(): string {
  return JSON.stringify({
    schemaVersion: "chapterflow-production-manifest-sidecar-v1",
    bookId: BOOK,
    manifest: { payload: { canonicalIndex: { path: "state/indexes/x.json", semanticHash: "sha256:x", chapters: [] } } },
  }, null, 2);
}

function makeFixture(label: string, opts: { chapters: number; sidecar: string }): {
  packagePath: string;
  manifestPath: string;
  v25Root: string;
  cleanup: () => void;
} {
  const root = tmpRoot(label);
  mkdirSync(root, { recursive: true });
  const packagePath = resolve(root, `${BOOK}.v21.json`);
  const manifestPath = resolve(root, `${BOOK}.production-manifest.json`);
  const chapters = [];
  for (let n = 1; n <= opts.chapters; n++) chapters.push({ chapterId: chapterId(n), number: n });
  writeFileSync(packagePath, JSON.stringify({ schemaVersion: "v21", book: { bookId: BOOK }, chapters }, null, 2));
  writeFileSync(manifestPath, opts.sidecar);
  return { packagePath, manifestPath, v25Root: resolve(root, "v25"), cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const pointerAt = (candidateId: string, manifestDigest: string): PointerReader =>
  async () => ({ ok: true, pointer: { candidateId, manifestDigest, revision: 3 } });

const opensSnapshot = (snapshot: CandidateSnapshot): CandidateOpener =>
  async () => ({ ok: true, snapshot });

// ── (a) candidate pair, weak mode ────────────────────────────────────────────

test("preflight verifies a candidate pair WITH its sidecar and names the replay strength", async () => {
  const f = makeFixture("weak-candidate", { chapters: 3, sidecar: candidateSidecar() });
  try {
    const r = await publishPreflightVerify({ bookId: BOOK, packagePath: f.packagePath, manifestPath: f.manifestPath });
    assert.equal(r.strength, "recorded-evidence-replay");
    assert.equal(r.manifestPath, f.manifestPath, "the sidecar path must be explicit, not re-derived downstream");
    assert.match(r.detail, /recorded-evidence replay/);
    assert.match(r.detail, /the candidate itself was NOT re-read/);
    // The verifier ran (this fixture's manifest is intentionally not a valid one,
    // so it blocks) — what matters here is that the SIDECAR WAS LOADED at the
    // supplied path rather than the sidecar being reported as missing.
    assert.ok(r.verification, "the verifier must have run");
    assert.ok(
      !r.verification!.findings.some((x) => x.checkId === "PPKG.sidecar_missing"),
      `sidecar must be loaded from manifestPath; got ${r.verification!.findings.map((x) => x.checkId).join(",")}`,
    );
  } finally { f.cleanup(); }
});

test("the default sidecar path is exactly the one verifyProductionPackage derives", () => {
  const stateRoot = "/tmp/cf-fixture-state";
  assert.equal(
    defaultManifestPathForBook(BOOK, stateRoot),
    resolve(stateRoot, "books", `${BOOK}.production-manifest.json`),
  );
});

test("readDeclaredCandidate reads a candidate declaration and returns null for legacy/absent", () => {
  const f = makeFixture("declared", { chapters: 1, sidecar: candidateSidecar() });
  try {
    assert.deepEqual(readDeclaredCandidate(f.manifestPath), { candidateId: CANDIDATE_ID, manifestDigest: DIGEST });
    writeFileSync(f.manifestPath, legacySidecar());
    assert.equal(readDeclaredCandidate(f.manifestPath), null);
    assert.equal(readDeclaredCandidate(resolve(f.v25Root, "nope.json")), null);
  } finally { f.cleanup(); }
});

// ── (b) pointer mismatch REFUSES ─────────────────────────────────────────────

test("--v25-root REFUSES a sidecar naming a different candidate than the CURRENT pointer", async () => {
  const f = makeFixture("pointer-mismatch", {
    chapters: 3,
    sidecar: candidateSidecar({ candidateId: "repair-candidate-deadbeefdeadbeefdeadbeefdeadbeef" }),
  });
  let opened = false;
  try {
    const r = await publishPreflightVerify({
      bookId: BOOK, packagePath: f.packagePath, manifestPath: f.manifestPath, v25Root: f.v25Root,
      readPointer: pointerAt(CANDIDATE_ID, DIGEST),
      openCandidate: async () => { opened = true; return { ok: false, code: "X", message: "must not be reached" }; },
    });
    assert.equal(r.ok, false);
    assert.equal(r.strength, "candidate-store-reverify");
    assert.ok(r.findings.some((x) => x.checkId === "PPKG.v25_pointer_mismatch"), "expected PPKG.v25_pointer_mismatch");
    assert.equal(opened, false, "a pointer mismatch must be refused BEFORE the candidate is opened");
  } finally { f.cleanup(); }
});

test("--v25-root REFUSES a manifestDigest that disagrees with the pointer", async () => {
  const f = makeFixture("digest-mismatch", { chapters: 3, sidecar: candidateSidecar({ manifestDigest: OTHER_DIGEST }) });
  try {
    const r = await publishPreflightVerify({
      bookId: BOOK, packagePath: f.packagePath, manifestPath: f.manifestPath, v25Root: f.v25Root,
      readPointer: pointerAt(CANDIDATE_ID, DIGEST),
      openCandidate: opensSnapshot(snapshotWithChapters(3)),
    });
    assert.equal(r.ok, false);
    assert.ok(r.findings.some((x) => x.checkId === "PPKG.v25_pointer_mismatch"));
  } finally { f.cleanup(); }
});

test("--v25-root REFUSES a legacy sidecar rather than letting it dodge the pointer by downgrading its regime", async () => {
  const f = makeFixture("regime-downgrade", { chapters: 3, sidecar: legacySidecar() });
  try {
    const r = await publishPreflightVerify({
      bookId: BOOK, packagePath: f.packagePath, manifestPath: f.manifestPath, v25Root: f.v25Root,
      readPointer: pointerAt(CANDIDATE_ID, DIGEST),
      openCandidate: opensSnapshot(snapshotWithChapters(3)),
    });
    assert.equal(r.ok, false);
    assert.ok(r.findings.some((x) => x.checkId === "PPKG.v25_pointer_regime_mismatch"));
  } finally { f.cleanup(); }
});

test("--v25-root NEVER silently falls back when the pointer is absent", async () => {
  const f = makeFixture("pointer-absent", { chapters: 3, sidecar: candidateSidecar() });
  try {
    const r = await publishPreflightVerify({
      bookId: BOOK, packagePath: f.packagePath, manifestPath: f.manifestPath, v25Root: f.v25Root,
      readPointer: async () => ({ ok: true, pointer: null }),
      openCandidate: opensSnapshot(snapshotWithChapters(3)),
    });
    assert.equal(r.ok, false);
    assert.equal(r.strength, "candidate-store-reverify", "the requested strength is reported even when it cannot be delivered");
    assert.ok(r.findings.some((x) => x.checkId === "PPKG.v25_pointer_missing"));
  } finally { f.cleanup(); }
});

test("--v25-root REFUSES a candidate whose opened digest disagrees with the pointer", async () => {
  const f = makeFixture("candidate-digest", { chapters: 3, sidecar: candidateSidecar() });
  try {
    const r = await publishPreflightVerify({
      bookId: BOOK, packagePath: f.packagePath, manifestPath: f.manifestPath, v25Root: f.v25Root,
      readPointer: pointerAt(CANDIDATE_ID, DIGEST),
      openCandidate: opensSnapshot(snapshotWithChapters(3, { manifestDigest: OTHER_DIGEST })),
    });
    assert.equal(r.ok, false);
    assert.ok(r.findings.some((x) => x.checkId === "PPKG.v25_candidate_digest_mismatch"));
  } finally { f.cleanup(); }
});

// ── (c) THE RESIDUAL ─────────────────────────────────────────────────────────

test("the candidate's chapter inventory comes from kind-tagged entries only", () => {
  const ids = candidateChapterIds(snapshotWithChapters(4));
  assert.deepEqual(ids, [chapterId(1), chapterId(2), chapterId(3), chapterId(4)]);
});

test("RESIDUAL: a package that drops a chapter the candidate carries is REFUSED", () => {
  const snapshot = snapshotWithChapters(4);
  const packaged = [chapterId(1), chapterId(2), chapterId(3)]; // ch04 re-authored away
  const findings = compareCandidateInventory(packaged, snapshot);
  assert.ok(findings.some((f) => f.checkId === "PPKG.candidate_inventory_count_mismatch"), "expected a count mismatch");
  const dropped = findings.find((f) => f.checkId === "PPKG.candidate_inventory_chapter_dropped");
  assert.ok(dropped, "expected the dropped chapter to be named");
  assert.match(dropped!.message, new RegExp(chapterId(4)));
});

test("RESIDUAL: a package shipping a chapter the candidate does not carry is REFUSED", () => {
  const findings = compareCandidateInventory([chapterId(1), chapterId(2), "foreign-ch99"], snapshotWithChapters(3));
  assert.ok(findings.some((f) => f.checkId === "PPKG.candidate_inventory_chapter_foreign"));
});

test("an honest package matching the candidate inventory exactly yields no inventory findings", () => {
  assert.deepEqual(compareCandidateInventory([chapterId(1), chapterId(2), chapterId(3)], snapshotWithChapters(3)), []);
});

test("RESIDUAL end-to-end: the re-authored pair passes the two-file mode and FAILS the candidate-store mode", async () => {
  // Same pair in both modes — the only difference is whether --v25-root was given.
  const f = makeFixture("residual", { chapters: 3, sidecar: candidateSidecar() });
  try {
    const strong = await publishPreflightVerify({
      bookId: BOOK, packagePath: f.packagePath, manifestPath: f.manifestPath, v25Root: f.v25Root,
      readPointer: pointerAt(CANDIDATE_ID, DIGEST),
      openCandidate: opensSnapshot(snapshotWithChapters(4)), // the candidate really has 4
    });
    assert.equal(strong.ok, false);
    assert.ok(
      strong.findings.some((x) => x.checkId === "PPKG.candidate_inventory_chapter_dropped"),
      "the candidate-store mode must catch the chapter the pair re-authored away",
    );
    assert.match(strong.detail, /candidate-store re-verify/);
    assert.deepEqual(
      strong.pointer,
      { candidateId: CANDIDATE_ID, manifestDigest: DIGEST, revision: 3 },
      "the report must name the pointer it verified against",
    );

    // The weak mode has no candidate to compare against, so it produces NO
    // inventory finding at all — that absence IS the residual this work closes.
    const weak = await publishPreflightVerify({ bookId: BOOK, packagePath: f.packagePath, manifestPath: f.manifestPath });
    assert.equal(weak.strength, "recorded-evidence-replay");
    assert.equal(
      weak.findings.filter((x) => x.checkId.startsWith("PPKG.candidate_inventory")).length,
      0,
      "the two-file mode cannot see the dropped chapter — if this ever fires, the strengths have merged",
    );
  } finally { f.cleanup(); }
});

// ── (d) CONTROL: legacy path untouched ───────────────────────────────────────

test("CONTROL: a legacy canonical-index pair reports the legacy strength and is verified as before", async () => {
  const f = makeFixture("legacy-control", { chapters: 3, sidecar: legacySidecar() });
  try {
    const r = await publishPreflightVerify({ bookId: BOOK, packagePath: f.packagePath, manifestPath: f.manifestPath });
    assert.equal(r.strength, "legacy-canonical-index");
    assert.match(r.detail, /canonical-index \(legacy regime\)/);
    assert.ok(r.verification, "the legacy path still runs the same verifier");
    assert.equal(
      r.findings.filter((x) => x.checkId.startsWith("PPKG.v25_") || x.checkId.startsWith("PPKG.candidate_inventory")).length,
      0,
      "no candidate-regime finding may appear on a legacy pair",
    );
  } finally { f.cleanup(); }
});

// ── WIRING: the strength reaches the publish chain's own output ──────────────

test("publishFinal reports the preflight strength in its verify step, and a boolean seam keeps the old wording", async () => {
  const { publishFinal } = await import("../src/publish/publishFinal.js");
  const f = makeFixture("wiring-final", { chapters: 1, sidecar: candidateSidecar() });
  try {
    const detail = "verifyProductionPackage PASS — strength: candidate-store re-verify (fixture)";
    // A seam returning {ok, detail} puts the strength on the step line...
    const rich = await publishFinal(BOOK, {
      dryRun: true, localPackagePath: f.packagePath, outerRoot: f.v25Root,
      lockDir: resolve(f.v25Root, "locks"),
      verify: () => ({ ok: true, detail }),
    });
    const richStep = rich.steps.find((s) => s.step === "preflight:verify");
    assert.ok(richStep, "expected a preflight:verify step");
    assert.equal(richStep!.detail, detail, "the strength line must be reported verbatim");

    // ...and the pre-existing boolean contract keeps its original wording.
    const plain = await publishFinal(BOOK, {
      dryRun: true, localPackagePath: f.packagePath, outerRoot: f.v25Root,
      lockDir: resolve(f.v25Root, "locks"),
      verify: () => true,
    });
    const plainStep = plain.steps.find((s) => s.step === "preflight:verify");
    assert.ok(plainStep);
    assert.equal(plainStep!.detail, "verifyProductionPackage PASS (sidecar-aware)");
  } finally { f.cleanup(); }
});

test("publishToLive reports the preflight strength on its verify step, and a boolean seam keeps 'verify: PASS'", async () => {
  const { publishToLive } = await import("../src/publish/publishToLive.js");
  const f = makeFixture("wiring-live", { chapters: 1, sidecar: candidateSidecar() });
  const outer = resolve(f.v25Root, "outer");
  mkdirSync(resolve(outer, "book-packages"), { recursive: true });
  mkdirSync(resolve(outer, "app", "book", "data"), { recursive: true });
  writeFileSync(resolve(outer, "app", "book", "data", "bookPackages.ts"), `import x from "@/book-packages/${BOOK}.v21.json";\n`);
  try {
    const detail = "verifyProductionPackage PASS — strength: recorded-evidence replay (fixture)";
    const rich = await publishToLive(BOOK, { localPackagePath: f.packagePath, outerRoot: outer, verify: () => ({ ok: true, detail }) });
    assert.ok(rich.steps.some((s) => s === `verify: PASS — ${detail}`), `steps were: ${rich.steps.join(" | ")}`);

    const plain = await publishToLive(BOOK, { localPackagePath: f.packagePath, outerRoot: outer, verify: () => true });
    assert.ok(plain.steps.includes("verify: PASS"), `steps were: ${plain.steps.join(" | ")}`);
  } finally { f.cleanup(); }
});

test("CONTROL: the weak mode's verifier verdict is identical to a bare verifyProductionPackage call", async () => {
  const { verifyProductionPackage } = await import("../src/verifyProductionPackage.js");
  const f = makeFixture("legacy-parity", { chapters: 3, sidecar: legacySidecar() });
  try {
    const direct = verifyProductionPackage({ packagePath: f.packagePath, manifestPath: f.manifestPath });
    const viaPreflight = await publishPreflightVerify({ bookId: BOOK, packagePath: f.packagePath, manifestPath: f.manifestPath });
    assert.equal(viaPreflight.ok, direct.ok);
    assert.deepEqual(
      viaPreflight.findings.map((x) => x.checkId).sort(),
      direct.findings.map((x) => x.checkId).sort(),
      "the preflight must not add or drop a single finding on the legacy path",
    );
  } finally { f.cleanup(); }
});
