/**
 * Source-packet gate reachability (R-027, R-028) and packet leakage (R-030).
 *
 * Two packet-gate checks were provably dead: their predicates could not be true
 * for any input the compiler produces. A gate that cannot fire is worse than no
 * gate, because the report says PASS on exactly the defect it was written for.
 *
 *  R-027 SP11 ("a hardSpecific floating free of its case") tested each specific
 *        against a support string that CONTAINED the specifics, so the predicate
 *        was always false.
 *  R-028 SP7 ("a fact must carry mechanism/commonError/whyWrong") tested for
 *        emptiness, but normalizedFact substitutes contract boilerplate for an
 *        empty field first — so the emptiness could never be observed and the
 *        boilerplate shipped to writers as a causal explanation.
 *  R-030 the compiler minted its own forbiddenLeakage from the case list and
 *        discarded the researcher's, which the model was prompted to produce.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import { validateSourcePacket } from "../src/compiler/sourcePacketGate.js";
import { compileSourcePacketFromSidecar } from "../src/compiler/sourcePacket.js";
import { MECHANISM_FALLBACK, factPedagogyPlaceholders, normalizedFact } from "../src/compiler/sourcePacketFacts.js";
import type { SourcePacketFact, SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import type { SourceSidecarV2 } from "../src/source/sidecarSchema.js";

function mkFact(id: string, over: Partial<SourcePacketFact> = {}): SourcePacketFact {
  return {
    id,
    claim: `${id} claim about rotating duty in a small club.`,
    mechanism: "A named successor inherits a visible record, so neglect cannot hide in a group average.",
    commonError: "Rotation exists to share the load evenly.",
    whyWrong: "Load-sharing is a side effect; single-owner accountability is the mechanism.",
    allowedClaimTypes: [],
    groundedNumbers: [],
    groundedEntities: [],
    groundedPlaces: [],
    verificationRefs: [],
    ...over,
  };
}

function mkCase(over: Partial<SourcePacketV1["namedCases"][number]> = {}): SourcePacketV1["namedCases"][number] {
  return {
    id: "ch01.ex.club",
    label: "Leather Apron Club",
    summary: "A dozen Philadelphia tradesmen met each Friday to answer one another's written queries.",
    realWorld: true,
    hardSpecifics: ["Philadelphia", "each Friday"],
    allowedUses: [],
    forbiddenUses: [],
    doNotRestamp: [],
    ...over,
  };
}

function mkPacket(over: Partial<SourcePacketV1> = {}): SourcePacketV1 {
  return {
    schemaVersion: "source-packet-v1",
    bookId: "zz-gate",
    chapterId: "zz-gate-ch01",
    chapterNumber: 1,
    chapterTitle: "Rotating Duty",
    sourceSidecarPath: null,
    sourceHash: null,
    facts: Array.from({ length: 9 }, (_, i) => mkFact(`ch01.fact.${i + 1}`)),
    namedCases: [mkCase()],
    frameworks: [],
    allowedAnchors: [{ id: "ch01.concept.core", kind: "concept", label: "core", text: "core", supportsClaimTypes: [] }],
    allowedNumbers: [],
    allowedEntities: [],
    allowedPlaces: [],
    forbiddenClaims: [],
    forbiddenLeakage: [],
    sourceQuality: { status: "adequate", risks: [] },
    ...over,
  };
}

const withCheck = (packet: SourcePacketV1, checkId: string) =>
  validateSourcePacket(packet).filter((f) => f.checkId === checkId);

// ── R-027: SP11 must be reachable ────────────────────────────────────────────

test("R-027: SP11 fires when a hardSpecific is absent from its case summary", () => {
  const packet = mkPacket({
    namedCases: [mkCase({ hardSpecifics: ["Philadelphia", "rotating duty"] })],
  });
  const found = withCheck(packet, "SP11.case_specifics_visible");
  assert.equal(found.length, 1, `expected SP11 to fire, got ${JSON.stringify(validateSourcePacket(packet))}`);
  assert.equal(found[0].severity, "advisory", "SP11 stays advisory");
});

test("R-027: SP11 stays silent when every hardSpecific is visible in the summary", () => {
  const packet = mkPacket({
    namedCases: [mkCase({
      summary: "A dozen Philadelphia tradesmen met each Friday to answer written queries.",
      hardSpecifics: ["Philadelphia", "each Friday"],
    })],
  });
  assert.deepEqual(withCheck(packet, "SP11.case_specifics_visible"), []);
});

test("R-027: SP11 does not judge a case the researcher marked as not real-world", () => {
  const packet = mkPacket({
    namedCases: [mkCase({ realWorld: false, hardSpecifics: ["Philadelphia", "rotating duty"] })],
  });
  assert.deepEqual(withCheck(packet, "SP11.case_specifics_visible"), []);
});

// ── R-028: SP7 must be reachable ─────────────────────────────────────────────

test("R-028: normalizedFact substitutes boilerplate for an omitted mechanism", () => {
  const fact = normalizedFact({ claim: "A rotating duty is inherited by name." }, "ch01.fact.1")!;
  assert.equal(fact.mechanism, MECHANISM_FALLBACK, "the substitution SP7 must see is still happening");
  assert.deepEqual(factPedagogyPlaceholders(fact), ["mechanism", "commonError", "whyWrong"]);
});

test("R-028: SP7 blocks a fact whose pedagogy fields are compiler boilerplate", () => {
  const boilerplate = normalizedFact({ claim: "A rotating duty is inherited by name." }, "ch01.fact.1")!;
  const packet = mkPacket({ facts: [boilerplate, ...Array.from({ length: 8 }, (_, i) => mkFact(`ch01.fact.${i + 2}`))] });
  const found = withCheck(packet, "SP7.fact_pedagogy");
  assert.equal(found.length, 1, `expected SP7 to fire on the boilerplate fact, got ${JSON.stringify(validateSourcePacket(packet))}`);
  assert.equal(found[0].severity, "blocker");
  assert.match(found[0].message, /ch01\.fact\.1/);
});

test("R-028: SP7 stays silent when every fact carries real source-grounded pedagogy", () => {
  assert.deepEqual(withCheck(mkPacket(), "SP7.fact_pedagogy"), []);
});

// ── R-030: the researcher's forbiddenLeakage reaches the packet ──────────────

test("R-030: the researcher's forbiddenLeakage is carried into the packet", () => {
  const sidecar = {
    schemaVersion: "source-v2",
    chapterNumber: 1,
    chapterTitle: "Rotating Duty",
    centralConcept: { name: "rotating duty", plainDefinition: "One named person owns a recurring obligation for a fixed term." },
    keyClaims: ["A rotating duty is inherited by name."],
    namedExamples: [{ id: "ch01.ex.club", label: "Leather Apron Club", summary: "A dozen tradesmen met each Friday.", hardSpecifics: ["Philadelphia", "each Friday"], realWorld: true }],
    hardEdge: "Rotation is accountability machinery, not fairness machinery.",
    testableFacts: [{ id: "ch01.fact.1", claim: "Each member produced a written query in turn.", becauseMechanism: "Turn-taking assigns one named owner per meeting.", commonError: "Rotation shares the load.", errorIsWhy: "Load-sharing is a side effect." }],
    forbiddenLeakage: ["the thirteen virtues chart"],
  } as unknown as SourceSidecarV2;
  const packet = compileSourcePacketFromSidecar({
    bookId: "zz-gate",
    chapter: { chapterNumber: 1, chapterId: "zz-gate-ch01", chapterTitle: "Rotating Duty" } as any,
    sidecar,
  });
  const warnings = packet.forbiddenLeakage.map((f) => f.warning);
  assert.ok(
    warnings.some((w) => w.includes("the thirteen virtues chart")),
    `expected the researcher's forbiddenLeakage in the packet, got ${JSON.stringify(warnings)}`,
  );
  assert.ok(
    warnings.some((w) => w.includes("Leather Apron Club")),
    "the case-derived leakage warnings must still be present",
  );
});

test("R-030: a sidecar without forbiddenLeakage keeps exactly the case-derived warnings", () => {
  const sidecar = {
    schemaVersion: "source-v2",
    chapterNumber: 1,
    chapterTitle: "Rotating Duty",
    centralConcept: { name: "rotating duty", plainDefinition: "One named person owns a recurring obligation." },
    keyClaims: ["A rotating duty is inherited by name."],
    namedExamples: [{ id: "ch01.ex.club", label: "Leather Apron Club", summary: "A dozen tradesmen met each Friday.", hardSpecifics: ["Philadelphia", "each Friday"], realWorld: true }],
    hardEdge: "Rotation is accountability machinery.",
    testableFacts: [],
  } as unknown as SourceSidecarV2;
  const packet = compileSourcePacketFromSidecar({
    bookId: "zz-gate",
    chapter: { chapterNumber: 1, chapterId: "zz-gate-ch01", chapterTitle: "Rotating Duty" } as any,
    sidecar,
  });
  assert.equal(packet.forbiddenLeakage.length, 1);
  assert.deepEqual(packet.forbiddenLeakage.map((f) => f.into), ["ch01.ex.club"]);
});
