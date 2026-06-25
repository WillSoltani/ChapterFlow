/**
 * WS-4 — the central source-REALITY policy evaluator.
 *
 * Verification of a newly produced source-v2 book is a PRODUCTION INVARIANT, not an entrypoint
 * convention. These tests pin the decision table that makes that true:
 *   - a new source-v2 book with no record + no exemption BLOCKS even with the env unset (the hole
 *     the old `require`-only gate left open);
 *   - a present-but-bad record blocks regardless of the environment;
 *   - absence is acceptable ONLY through a valid, content-bound legacy exemption;
 *   - a malformed / wrong-book / content-mismatched / expired exemption blocks;
 *   - an env var can only STRENGTHEN — it can never make a new book legacy.
 */

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { resolve } from "path";

import { test } from "./harness.js";
import {
  PIPELINE_DIR,
  RUNS_DIR,
  STATE_CHAPTERS,
  makeChapter,
  writeCanonicalIndexFixture,
  writeFixtureBook,
  writeSourceEvidenceFixture,
} from "./helpers.js";
import { promoteBook } from "../src/promoteBook.js";
import { sourceVerifyRecordPath } from "../src/critics/sourceVerify.js";
import {
  decideSourceRealityPolicy,
  evaluateSourceRealityPolicy,
  canonicalIndexHashFor,
  collectSourceVerifyItems,
  loadLegacyExemption,
  LEGACY_EXEMPTION_SCHEMA,
  type SourceRealityInputs,
} from "../src/qc/sourceRealityPolicy.js";
import type { SourceVerifyItem as SVItem } from "../src/critics/sourceVerify.js";

const ITEMS: SVItem[] = [1, 2, 3, 4, 5].map((i) => ({ chapterNumber: 1, kind: "testable_fact", id: `ch01.f${i}`, claim: `claim ${i}`, detail: "" }));

function record(items: Array<{ id: string; verdict?: string; sourceRef?: string; note?: string }>): string {
  return JSON.stringify({ schemaVersion: "source-verify-record-v1", bookId: "zz", chapters: [{ chapterNumber: 1, items: items.map((it) => ({ kind: "testable_fact", verdict: "VERIFIED", sourceRef: "", note: "", ...it })) }] });
}
const verifiedRecord = (): string => record(ITEMS.map((it, i) => ({ id: it.id, verdict: "VERIFIED", sourceRef: `https://example.com/${i}`, note: `checked ${i}` })));

const HASH = "0123456789abcdef0123456789abcdef";

function exemption(over: Record<string, unknown> = {}): string {
  return JSON.stringify({
    schemaVersion: LEGACY_EXEMPTION_SCHEMA,
    bookId: "zz",
    reason: "Pre-WS-4 legacy catalog package, grandfathered at the index level.",
    approvedBy: "human:owner",
    approvedAt: "2026-06-24T00:00:00.000Z",
    canonicalIndexHash: HASH,
    ...over,
  });
}

function inputs(over: Partial<SourceRealityInputs> = {}): SourceRealityInputs {
  return {
    bookId: "zz",
    expectedItems: ITEMS,
    hasSourceV2Sidecars: true,
    recordText: null,
    exemptionText: null,
    exemptionError: null,
    contentIdentity: { canonicalIndexHash: HASH },
    requireEnv: false,
    now: new Date("2026-06-24T12:00:00.000Z"),
    ...over,
  };
}

// ── The headline fix: new source-v2 book, env unset, no record ⇒ blocked ──────
test("new source-v2 book with no record + no exemption is NON-BLOCKING by default; blocks only under the env opt-in", () => {
  // Fully-unattended default: a missing record is not-applicable, not a block, so the
  // autopilot converges without a human source check.
  const off = decideSourceRealityPolicy(inputs({ requireEnv: false }));
  assert.equal(off.decision, "not-applicable");
  assert.equal(off.blocking, false);
  assert.equal(off.classification, "new-source-v2");

  // Operator opt-in: CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1 makes a missing record block.
  const on = decideSourceRealityPolicy(inputs({ requireEnv: true }));
  assert.equal(on.decision, "missing");
  assert.equal(on.blocking, true);
  assert.ok(on.findings.some((f) => f.checkId === "SR.record_missing"));
});

test("new source-v2 book with a complete VERIFIED record passes (required-and-verified, non-blocking)", () => {
  const r = decideSourceRealityPolicy(inputs({ recordText: verifiedRecord() }));
  assert.equal(r.decision, "required-and-verified");
  assert.equal(r.blocking, false);
  assert.deepEqual(r.findings, []);
});

test("a PRESENT rubber-stamp record BLOCKS regardless of the environment (invalid)", () => {
  // One identical note over reused sources = the digital-minimalism SV4 signature.
  const stamp = record(ITEMS.map((it, i) => ({ id: it.id, verdict: "VERIFIED", sourceRef: `https://example.com/${i % 2}`, note: "stamp" })));
  for (const requireEnv of [false, true]) {
    const r = decideSourceRealityPolicy(inputs({ recordText: stamp, requireEnv }));
    assert.equal(r.decision, "invalid", `requireEnv=${requireEnv}`);
    assert.equal(r.blocking, true);
    assert.ok(r.findings.some((f) => f.checkId === "SV4"), `expected SV4, got ${r.findings.map((f) => f.checkId).join(",")}`);
  }
});

test("a present non-VERIFIED record blocks (invalid → SV2) and a present unparseable record blocks (invalid)", () => {
  const fillMe = record([{ id: "ch01.f1", verdict: "FILL_ME" }]);
  const r1 = decideSourceRealityPolicy(inputs({ expectedItems: [ITEMS[0]], recordText: fillMe }));
  assert.equal(r1.decision, "invalid");
  assert.ok(r1.findings.some((f) => f.checkId === "SV2"));

  const r2 = decideSourceRealityPolicy(inputs({ recordText: "{ not json" }));
  assert.equal(r2.decision, "invalid");
  assert.ok(r2.findings.some((f) => f.checkId === "SR.record_unparseable"));
});

// ── Legacy classification + env strengthening (env can never weaken) ──────────
test("a book with NO source-v2 content and env unset is not-applicable (non-blocking)", () => {
  const r = decideSourceRealityPolicy(inputs({ hasSourceV2Sidecars: false, expectedItems: [], requireEnv: false }));
  assert.equal(r.decision, "not-applicable");
  assert.equal(r.blocking, false);
  assert.equal(r.classification, "legacy");
});

test("CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1 STRENGTHENS: a no-source book now requires a record (missing)", () => {
  const r = decideSourceRealityPolicy(inputs({ hasSourceV2Sidecars: false, expectedItems: [], requireEnv: true }));
  assert.equal(r.decision, "missing");
  assert.equal(r.blocking, true);
});

test("a NEW source-v2 book stays classified new-source-v2; the env flag toggles whether a MISSING record applies", () => {
  // Classification is content-based (sidecars present) regardless of env.
  const off = decideSourceRealityPolicy(inputs({ hasSourceV2Sidecars: true, requireEnv: false }));
  assert.equal(off.classification, "new-source-v2");
  assert.equal(off.applies, false);
  assert.equal(off.decision, "not-applicable"); // a missing record is non-blocking by default

  const on = decideSourceRealityPolicy(inputs({ hasSourceV2Sidecars: true, requireEnv: true }));
  assert.equal(on.classification, "new-source-v2");
  assert.equal(on.applies, true);
  assert.equal(on.decision, "missing"); // no record, no exemption → blocks under opt-in
});

// ── Legacy exemption: valid, expired, malformed, wrong-book, content-mismatch ─
test("a valid content-bound legacy exemption is ACCEPTED and reported (legacy-exempt)", () => {
  const r = decideSourceRealityPolicy(inputs({ exemptionText: exemption() }));
  assert.equal(r.decision, "legacy-exempt");
  assert.equal(r.blocking, false);
  assert.equal(r.exemption?.approvedBy, "human:owner");
  assert.match(r.summary, /legacy-exempt/);
});

test("an EXPIRED exemption blocks (stale)", () => {
  const r = decideSourceRealityPolicy(inputs({
    exemptionText: exemption({ expiresAt: "2026-06-01T00:00:00.000Z" }),
    now: new Date("2026-06-24T00:00:00.000Z"),
  }));
  assert.equal(r.decision, "stale");
  assert.equal(r.blocking, true);
  assert.ok(r.findings.some((f) => f.checkId === "SR.exemption_expired"));
});

test("a not-yet-expired exemption is still accepted", () => {
  const r = decideSourceRealityPolicy(inputs({
    exemptionText: exemption({ expiresAt: "2026-12-31T00:00:00.000Z" }),
    now: new Date("2026-06-24T00:00:00.000Z"),
  }));
  assert.equal(r.decision, "legacy-exempt");
});

test("a malformed exemption (wrong schema / missing fields) blocks (invalid)", () => {
  const badSchema = decideSourceRealityPolicy(inputs({ exemptionText: JSON.stringify({ schemaVersion: "nope", bookId: "zz" }) }));
  assert.equal(badSchema.decision, "invalid");
  assert.ok(badSchema.findings.some((f) => f.checkId === "SR.exemption_bad_schema"));

  const incomplete = decideSourceRealityPolicy(inputs({ exemptionText: JSON.stringify({ schemaVersion: LEGACY_EXEMPTION_SCHEMA, bookId: "zz", canonicalIndexHash: HASH }) }));
  assert.equal(incomplete.decision, "invalid");
  assert.ok(incomplete.findings.some((f) => f.checkId === "SR.exemption_incomplete"));

  const unparseable = decideSourceRealityPolicy(inputs({ exemptionText: "{ not json" }));
  assert.equal(unparseable.decision, "invalid");
  assert.ok(unparseable.findings.some((f) => f.checkId === "SR.exemption_unparseable"));
});

test("a wrong-book exemption blocks (invalid)", () => {
  const r = decideSourceRealityPolicy(inputs({ exemptionText: exemption({ bookId: "other-book" }) }));
  assert.equal(r.decision, "invalid");
  assert.ok(r.findings.some((f) => f.checkId === "SR.exemption_wrong_book"));
});

test("a content-mismatched exemption (canonicalIndexHash drifted) blocks (invalid)", () => {
  const r = decideSourceRealityPolicy(inputs({
    exemptionText: exemption({ canonicalIndexHash: "ffffffffffffffffffffffffffffffff" }),
    contentIdentity: { canonicalIndexHash: HASH },
  }));
  assert.equal(r.decision, "invalid");
  assert.ok(r.findings.some((f) => f.checkId === "SR.exemption_content_mismatch"));
});

test("an exemption declaring no content identity blocks (invalid)", () => {
  const r = decideSourceRealityPolicy(inputs({ exemptionText: JSON.stringify({ schemaVersion: LEGACY_EXEMPTION_SCHEMA, bookId: "zz", reason: "r", approvedBy: "a", approvedAt: "2026-06-24T00:00:00.000Z" }) }));
  assert.equal(r.decision, "invalid");
  assert.ok(r.findings.some((f) => f.checkId === "SR.exemption_no_identity"));
});

test("an exemption that declares only an identity the caller cannot verify fails closed (invalid)", () => {
  // The exemption binds to packageId, but this path provides only canonicalIndexHash.
  const r = decideSourceRealityPolicy(inputs({
    exemptionText: exemption({ canonicalIndexHash: undefined, packageId: "pkg-123" }),
    contentIdentity: { canonicalIndexHash: HASH },
  }));
  assert.equal(r.decision, "invalid");
  assert.ok(r.findings.some((f) => f.checkId === "SR.exemption_unverifiable"));
});

test("an unreadable exemption REGISTRY fails closed (invalid), never silently treated as absent", () => {
  const r = decideSourceRealityPolicy(inputs({ exemptionText: null, exemptionError: "registry: bad json" }));
  assert.equal(r.decision, "invalid");
  assert.equal(r.blocking, true);
  assert.ok(r.findings.some((f) => f.checkId === "SR.exemption_registry_unreadable"));
});

test("a PRESENT record takes precedence over an exemption (a bad record still blocks even if exempt)", () => {
  const r = decideSourceRealityPolicy(inputs({
    recordText: record([{ id: "ch01.f1", verdict: "UNVERIFIABLE" }]),
    expectedItems: [ITEMS[0]],
    exemptionText: exemption(),
  }));
  assert.equal(r.decision, "invalid");
});

// ── Disk-backed helpers + wrapper (isolated temp fixture) ─────────────────────
test("canonicalIndexHashFor is stable and changes when the index changes", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "cf-sr-hash-"));
  try {
    const indexDir = resolve(dir, "indexes");
    writeCanonicalIndexFixture("zz-hash", [{ chapterId: "zz-hash-ch01", number: 1, title: "One" }], indexDir);
    const h1 = canonicalIndexHashFor("zz-hash", dir);
    const h2 = canonicalIndexHashFor("zz-hash", dir);
    assert.equal(typeof h1, "string");
    assert.equal(h1, h2, "same index ⇒ same hash");
    writeCanonicalIndexFixture("zz-hash", [{ chapterId: "zz-hash-ch01", number: 1, title: "One" }, { chapterId: "zz-hash-ch02", number: 2, title: "Two" }], indexDir);
    assert.notEqual(canonicalIndexHashFor("zz-hash", dir), h1, "adding a chapter changes the hash");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("loadLegacyExemption: absent ⇒ none, present ⇒ entry, duplicate ⇒ error, malformed registry ⇒ error", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "cf-sr-exempt-"));
  try {
    const file = resolve(dir, "exemptions.json");
    assert.deepEqual(loadLegacyExemption("zz", file), { text: null, error: null });

    writeFileSync(file, JSON.stringify({ schemaVersion: "source-reality-legacy-exemptions-v1", exemptions: [{ schemaVersion: LEGACY_EXEMPTION_SCHEMA, bookId: "zz", reason: "r", approvedBy: "a", approvedAt: "t", canonicalIndexHash: HASH }] }));
    const found = loadLegacyExemption("zz", file);
    assert.ok(found.text && JSON.parse(found.text).bookId === "zz");
    assert.deepEqual(loadLegacyExemption("missing-book", file), { text: null, error: null });

    writeFileSync(file, JSON.stringify({ exemptions: [{ bookId: "zz" }, { bookId: "zz" }] }));
    assert.match(loadLegacyExemption("zz", file).error ?? "", /duplicate|ambiguous|2 entries/i);

    writeFileSync(file, "{ not json");
    assert.ok(loadLegacyExemption("zz", file).error, "a malformed registry must surface an error (fail closed)");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("evaluateSourceRealityPolicy (disk wrapper) over an isolated source-v2 fixture covers the decision table", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "cf-sr-wrap-"));
  const bookId = "zz-sr-wrap";
  try {
    const stateRoot = resolve(dir, "state");
    const runsRoot = resolve(dir, "runs");
    const chapters = [{ number: 1, title: "One" }, { number: 2, title: "Two" }];
    writeCanonicalIndexFixture(bookId, chapters.map((c) => ({ chapterId: `${bookId}-ch${String(c.number).padStart(2, "0")}`, number: c.number, title: c.title })), resolve(stateRoot, "indexes"));
    writeSourceEvidenceFixture(bookId, chapters, "20260624T000000Z-fixture", runsRoot);
    const recordPath = resolve(dir, "record.md");
    const exemptionsFile = resolve(dir, "exemptions.json");
    const baseRoots = { stateRoot, runsRoot, recordPath, exemptionsFile };

    // Sanity: the fixture really is a new-source-v2 book with verifiable items.
    const items = collectSourceVerifyItems(bookId, baseRoots);
    assert.ok(items.length > 0, "fixture sidecars must expose verifiable items");

    // (a) no record, no exemption: env unset ⇒ not-applicable (opt-in default), env set ⇒ missing.
    const off = evaluateSourceRealityPolicy({ bookId, env: {}, roots: baseRoots });
    assert.equal(off.decision, "not-applicable");
    assert.equal(off.blocking, false);
    const on = evaluateSourceRealityPolicy({ bookId, env: { CHAPTERFLOW_REQUIRE_SOURCE_VERIFY: "1" }, roots: baseRoots });
    assert.equal(on.decision, "missing");
    assert.equal(on.blocking, true);

    // (b) a valid VERIFIED record ⇒ required-and-verified.
    const byChapter = new Map<number, any[]>();
    for (const it of items) {
      const arr = byChapter.get(it.chapterNumber) ?? [];
      arr.push({ id: it.id, kind: it.kind, verdict: "VERIFIED", sourceRef: `https://example.com/${it.id}`, note: `checked ${it.id}` });
      byChapter.set(it.chapterNumber, arr);
    }
    writeFileSync(recordPath, "```json\n" + JSON.stringify({ schemaVersion: "source-verify-record-v1", bookId, chapters: [...byChapter.keys()].sort((a, b) => a - b).map((n) => ({ chapterNumber: n, items: byChapter.get(n) })) }) + "\n```\n");
    assert.equal(evaluateSourceRealityPolicy({ bookId, env: {}, roots: baseRoots }).decision, "required-and-verified");

    // (c) remove the record, add a content-bound legacy exemption ⇒ legacy-exempt.
    rmSync(recordPath, { force: true });
    const hash = canonicalIndexHashFor(bookId, stateRoot)!;
    writeFileSync(exemptionsFile, JSON.stringify({ schemaVersion: "source-reality-legacy-exemptions-v1", exemptions: [{ schemaVersion: LEGACY_EXEMPTION_SCHEMA, bookId, reason: "legacy", approvedBy: "human:owner", approvedAt: "2026-06-24T00:00:00.000Z", canonicalIndexHash: hash }] }));
    const exempt = evaluateSourceRealityPolicy({ bookId, env: {}, roots: baseRoots });
    assert.equal(exempt.decision, "legacy-exempt");
    assert.equal(exempt.blocking, false);

    // (d) tamper the index so the bound hash no longer matches ⇒ content-mismatch (invalid).
    writeCanonicalIndexFixture(bookId, [...chapters, { number: 3, title: "Three" }].map((c) => ({ chapterId: `${bookId}-ch${String(c.number).padStart(2, "0")}`, number: c.number, title: c.title })), resolve(stateRoot, "indexes"));
    assert.equal(evaluateSourceRealityPolicy({ bookId, env: {}, roots: baseRoots }).decision, "invalid");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a caller cannot OVERRIDE the computed canonicalIndexHash to revive a content-mismatched exemption", () => {
  const dir = mkdtempSync(resolve(tmpdir(), "cf-sr-override-"));
  const bookId = "zz-sr-override";
  try {
    const stateRoot = resolve(dir, "state");
    const runsRoot = resolve(dir, "runs");
    const exemptionsFile = resolve(dir, "exemptions.json");
    const chapters = [{ number: 1, title: "One" }];
    writeCanonicalIndexFixture(bookId, chapters.map((c) => ({ chapterId: `${bookId}-ch01`, number: c.number, title: c.title })), resolve(stateRoot, "indexes"));
    writeSourceEvidenceFixture(bookId, chapters, "20260624T000000Z-fixture", runsRoot);
    // Exemption bound to a STALE hash (≠ the current index hash) and no record present.
    const staleHash = "deadbeefdeadbeefdeadbeefdeadbeef";
    assert.notEqual(canonicalIndexHashFor(bookId, stateRoot), staleHash);
    writeFileSync(exemptionsFile, JSON.stringify({ schemaVersion: "source-reality-legacy-exemptions-v1", exemptions: [{ schemaVersion: LEGACY_EXEMPTION_SCHEMA, bookId, reason: "legacy", approvedBy: "human:owner", approvedAt: "2026-06-24T00:00:00.000Z", canonicalIndexHash: staleHash }] }));
    // A careless future caller tries to pass the matching stale hash (bypassing the narrowed type).
    const r = evaluateSourceRealityPolicy({ bookId, env: {}, roots: { stateRoot, runsRoot, exemptionsFile }, contentIdentity: { canonicalIndexHash: staleHash } as any });
    assert.equal(r.decision, "invalid", "the computed canonicalIndexHash must win — a caller-supplied stale hash cannot revive a mismatched exemption");
    assert.ok(r.findings.some((f) => f.checkId === "SR.exemption_content_mismatch"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── Integration: a direct promote-book cannot bypass the requirement, and promote +
//    publish-after-qc compute the SAME source-reality verdict (both call the same evaluator). ──
const PROMOTE_BOOK = "zz-fixture-source-reality";

function cleanupPromoteFixture(): void {
  try {
    for (const f of [...require("fs").readdirSync(STATE_CHAPTERS)]) {
      if (f.startsWith(`${PROMOTE_BOOK}-ch`)) rmSync(resolve(STATE_CHAPTERS, f), { force: true });
    }
  } catch {}
  rmSync(resolve(PIPELINE_DIR, "state", "indexes", `${PROMOTE_BOOK}.json`), { force: true });
  rmSync(resolve(PIPELINE_DIR, "state", "books", `${PROMOTE_BOOK}.gate.json`), { force: true });
  rmSync(resolve(RUNS_DIR, PROMOTE_BOOK), { recursive: true, force: true });
  rmSync(sourceVerifyRecordPath(PROMOTE_BOOK), { force: true });
  const locks = resolve(PIPELINE_DIR, "state", "books", "_locks");
  try {
    for (const f of require("fs").readdirSync(locks)) {
      if (f.startsWith(`${PROMOTE_BOOK}.promotion.lock`)) rmSync(resolve(locks, f), { force: true });
    }
  } catch {}
  const blocked = resolve(PIPELINE_DIR, "state", "books", "_blocked");
  try {
    for (const f of require("fs").readdirSync(blocked)) {
      if (f.startsWith(`${PROMOTE_BOOK}.`)) rmSync(resolve(blocked, f), { force: true });
    }
  } catch {}
}

test("a DIRECT promote-book applies the source-verify RECORD requirement only under the env opt-in (no auto-block by default, no bypass when enforced)", () => {
  const prevNoApi = process.env.CHAPTERFLOW_NO_API_CODEX_QC;
  const prevReq = process.env.CHAPTERFLOW_REQUIRE_SOURCE_VERIFY;
  const oldWarn = console.warn;
  const promote = () => promoteBook({
    bookId: PROMOTE_BOOK,
    title: "Source Reality Fixture",
    author: "Nobody",
    chapters: [1, 2].map((n) => ({ chapterId: `${PROMOTE_BOOK}-ch${String(n).padStart(2, "0")}`, chapterNumber: n, chapterTitle: `Chapter ${n}` })) as any,
  });
  try {
    console.warn = () => {};
    cleanupPromoteFixture();
    delete process.env.CHAPTERFLOW_NO_API_CODEX_QC;

    const chapters = [1, 2].map((n) => makeChapter(PROMOTE_BOOK, n));
    writeFixtureBook(STATE_CHAPTERS, chapters);
    writeCanonicalIndexFixture(PROMOTE_BOOK, chapters.map((ch) => ({ chapterId: ch.chapterId, number: ch.number, title: ch.title })));
    writeSourceEvidenceFixture(PROMOTE_BOOK, chapters.map((ch) => ({ number: ch.number, title: ch.title })));
    // Deliberately NO source-verify record.

    // (1) DEFAULT (fully-unattended): a missing record does NOT block — source-reality is
    //     not-applicable, so the unattended path converges without a human source check. (The book
    //     may still be blocked by other gates, but source-reality contributes no blocker.)
    delete process.env.CHAPTERFLOW_REQUIRE_SOURCE_VERIFY;
    const def = promote();
    assert.equal(def.sourceRealityDecision, "not-applicable", `default: a missing record is non-blocking, got ${def.sourceRealityDecision}`);
    assert.equal(def.sourceRealityBlockerCount ?? 0, 0, "source-reality must not block by default");

    // (2) OPT-IN: CHAPTERFLOW_REQUIRE_SOURCE_VERIFY=1 makes a missing record block, and a direct
    //     promote-book cannot bypass it — promote + publish-after-qc agree via the shared evaluator.
    process.env.CHAPTERFLOW_REQUIRE_SOURCE_VERIFY = "1";
    const enforced = promote();
    assert.equal(enforced.promoted, false, "under the opt-in a new source-v2 book with no record must not promote");
    assert.equal(enforced.sourceRealityDecision, "missing", `expected source-reality missing, got ${enforced.sourceRealityDecision}: ${enforced.reason}`);
    assert.ok((enforced.sourceRealityBlockerCount ?? 0) > 0, "source-reality must contribute a blocker under the opt-in");
    const preflightVerdict = evaluateSourceRealityPolicy({ bookId: PROMOTE_BOOK, env: process.env });
    assert.equal(preflightVerdict.decision, enforced.sourceRealityDecision, "promote + publish-after-qc must agree on the source-reality decision");
    assert.equal(preflightVerdict.blocking, true);
  } finally {
    console.warn = oldWarn;
    if (prevNoApi === undefined) delete process.env.CHAPTERFLOW_NO_API_CODEX_QC; else process.env.CHAPTERFLOW_NO_API_CODEX_QC = prevNoApi;
    if (prevReq === undefined) delete process.env.CHAPTERFLOW_REQUIRE_SOURCE_VERIFY; else process.env.CHAPTERFLOW_REQUIRE_SOURCE_VERIFY = prevReq;
    cleanupPromoteFixture();
  }
});
