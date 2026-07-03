/**
 * WS1 / K1 + K3 focused contract tests that run on a CLEAN checkout (no gold
 * corpus): the package-identity decision (createdAt-on-content-change / no-op
 * preservation / human-readable packageId) and the verifier's sidecar +
 * forbidden-field + embedded-manifest behavior.
 *
 * The full gate-clean promote-path (sidecar written transactionally, byte-stable
 * re-promote, fault injection) is exercised by the drive-fixture tests in
 * promote-gate.test.ts + production-manifest.test.ts.
 */

import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { resolve } from "path";

import { decidePackageIdentity, productionManifestSidecarPath } from "../src/promoteBook.js";
import { verifyProductionPackage } from "../src/verifyProductionPackage.js";
import { PIPELINE_DIR } from "./helpers.js";
import { test } from "./harness.js";

const CID_A = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CID_B = "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

test("decidePackageIdentity stamps a fresh human-readable packageId + createdAt when there is no prior sidecar", () => {
  const now = new Date("2026-07-03T00:00:00.000Z");
  const r = decidePackageIdentity({ bookId: "the-example", recomputedContentId: CID_A, priorContentId: null, priorPackageId: null, priorCreatedAt: null, now });
  assert.equal(r.freshStamp, true);
  assert.equal(r.createdAt, "2026-07-03T00:00:00.000Z");
  assert.equal(r.packageId, `the-example-v21-${Date.parse("2026-07-03T00:00:00.000Z")}`);
  assert.doesNotMatch(r.packageId, /sha256|[a-f0-9]{40}/, "packageId is not a hash");
});

test("decidePackageIdentity preserves packageId + createdAt on a byte-stable no-op re-promote (content id unchanged)", () => {
  const r = decidePackageIdentity({
    bookId: "the-example",
    recomputedContentId: CID_A,
    priorContentId: CID_A, // unchanged
    priorPackageId: "the-example-v21-1700000000000",
    priorCreatedAt: "2026-06-30T22:34:42.037Z",
    now: new Date("2026-07-10T00:00:00.000Z"), // a LATER instant
  });
  assert.equal(r.freshStamp, false);
  assert.equal(r.packageId, "the-example-v21-1700000000000", "no-op preserves prior packageId");
  assert.equal(r.createdAt, "2026-06-30T22:34:42.037Z", "no-op preserves prior createdAt — the date does not drift on a re-promote");
});

test("decidePackageIdentity stamps FRESH identity when the recomputed content id differs from the prior sidecar (content changed)", () => {
  const r = decidePackageIdentity({
    bookId: "the-example",
    recomputedContentId: CID_B, // changed
    priorContentId: CID_A,
    priorPackageId: "the-example-v21-1700000000000",
    priorCreatedAt: "2026-06-30T22:34:42.037Z",
    now: new Date("2026-07-11T00:00:00.000Z"),
  });
  assert.equal(r.freshStamp, true);
  assert.equal(r.createdAt, "2026-07-11T00:00:00.000Z", "a content change stamps createdAt = the promote instant");
  assert.equal(r.packageId, `the-example-v21-${Date.parse("2026-07-11T00:00:00.000Z")}`);
});

test("decidePackageIdentity treats a prior sidecar with matching content but no packageId/createdAt as a fresh stamp (fail-safe)", () => {
  const now = new Date("2026-07-03T00:00:00.000Z");
  const r = decidePackageIdentity({ bookId: "the-example", recomputedContentId: CID_A, priorContentId: CID_A, priorPackageId: null, priorCreatedAt: null, now });
  assert.equal(r.freshStamp, true, "a truncated prior sidecar cannot preserve identity — stamp fresh");
});

test("productionManifestSidecarPath lands under state/books next to the gate report and normalizes the slug", () => {
  const p = productionManifestSidecarPath("Some Book!");
  assert.match(p, /state\/books\/some-book\.production-manifest\.json$/);
});

// ── Verifier: embedded manifest rejected; forbidden field rejected; missing sidecar blocked ──

const V21 = "chapterflow-v21-authored";

/** A minimal slim package that is structurally valid enough to reach the
 *  sidecar/forbidden-field checks (deeper manifest checks are covered elsewhere). */
function slimPkg(extra: Record<string, unknown> = {}, chapterExtra: Record<string, unknown> = {}): unknown {
  return {
    schemaVersion: V21,
    packageId: "zz-verify-fixture-v21-1700000000000",
    createdAt: "2026-07-03T00:00:00.000Z",
    contentOwner: "chapterflow",
    book: { bookId: "zz-verify-fixture", title: "T", author: "A" },
    chapters: [{ chapterId: "zz-verify-fixture-ch01", number: 1, title: "One", ...chapterExtra }],
    ...extra,
  };
}

test("verifyProductionPackage HARD-rejects a package that still embeds a productionManifest (pre-v24 shape)", () => {
  const result = verifyProductionPackage({ packageData: slimPkg({ productionManifest: { schemaVersion: "x" } }), manifestData: { schemaVersion: "chapterflow-production-manifest-sidecar-v1", manifest: {} } });
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((f) => f.checkId === "PPKG.embedded_manifest_forbidden"), result.findings.map((f) => f.checkId).join("\n"));
});

test("verifyProductionPackage flags PPKG.forbidden_field for each forbidden deep/path-aware field", () => {
  const cases: Array<{ label: string; chapterExtra: Record<string, unknown>; extra?: Record<string, unknown> }> = [
    { label: "authoring", chapterExtra: { authoring: { x: 1 } } },
    { label: "planSpec", chapterExtra: { examples: [{ exampleId: "e1", planSpec: { domain: "d" } }] } },
    { label: "namedCaseIds", chapterExtra: { examples: [{ exampleId: "e1", namedCaseIds: ["n1"] }] } },
    { label: "sourceFactIds", chapterExtra: { examples: [{ exampleId: "e1", sourceFactIds: ["s1"] }] } },
    { label: "depthLevel", chapterExtra: { quiz: { questions: [{ questionId: "q1", depthLevel: 2 }] } } },
    { label: "SourceAnchorIds", chapterExtra: { hookSourceAnchorIds: ["a1"] } },
    { label: "per-chapter schemaVersion", chapterExtra: { schemaVersion: V21 } },
    { label: "implementationPlan.title", chapterExtra: { implementationPlan: { title: "skill" } } },
    { label: "memorableLines[].location", chapterExtra: { memorableLines: [{ text: "t", location: "hook" }] } },
    { label: "memorableLines[].why", chapterExtra: { memorableLines: [{ text: "t", why: "sticks" }] } },
  ];
  for (const c of cases) {
    const result = verifyProductionPackage({ packageData: slimPkg(c.extra ?? {}, c.chapterExtra), manifestData: { schemaVersion: "chapterflow-production-manifest-sidecar-v1", manifest: {} } });
    assert.equal(result.ok, false, `${c.label} should fail`);
    assert.ok(result.findings.some((f) => f.checkId === "PPKG.forbidden_field"), `${c.label}: expected PPKG.forbidden_field, got ${result.findings.map((f) => f.checkId).join(",")}`);
  }
});

test("verifyProductionPackage blocks when the manifest sidecar is missing (fail-closed, no throw)", () => {
  const sidecarPath = productionManifestSidecarPath("zz-verify-missing-sidecar");
  rmSync(sidecarPath, { force: true });
  const pkgPath = resolve(PIPELINE_DIR, "book-packages", "zz-verify-missing-sidecar.v21.json");
  try {
    mkdirSync(resolve(pkgPath, ".."), { recursive: true });
    const pkg = slimPkg() as Record<string, unknown>;
    pkg.packageId = "zz-verify-missing-sidecar-v21-1700000000000";
    pkg.book = { bookId: "zz-verify-missing-sidecar", title: "T", author: "A" };
    (pkg.chapters as any[])[0].chapterId = "zz-verify-missing-sidecar-ch01";
    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2), "utf8");
    let result: ReturnType<typeof verifyProductionPackage>;
    assert.doesNotThrow(() => { result = verifyProductionPackage({ packagePath: pkgPath }); });
    assert.equal(result!.ok, false);
    assert.ok(result!.findings.some((f) => f.checkId === "PPKG.sidecar_missing"), result!.findings.map((f) => f.checkId).join("\n"));
  } finally {
    rmSync(pkgPath, { force: true });
  }
});
