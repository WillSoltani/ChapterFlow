/**
 * WS-4 — the source reality-verification packet. check-source/SC10 prove a sidecar is
 * STRUCTURALLY grounded; this packet is the operator-driven sidecar-vs-reality step that
 * digital-minimalism skipped (its sidecars validated 0/0/0, then a writer invented a
 * real person's scene/quote). The packet must surface every real-world named case and
 * testable fact for claim-by-claim verification, skip clearly-fictional illustrations,
 * and carry a fillable record skeleton.
 */

import assert from "node:assert/strict";

import { test } from "./harness.js";
import {
  buildSourceVerificationPacket,
  verifiableItems,
  checkSourceVerifyRecord,
  parseSourceVerifyRecord,
  type SourceVerifyItem,
} from "../src/critics/sourceVerify.js";

const SIDECAR = {
  bookId: "zz-fixture-verify",
  chapterNumber: 1,
  namedExamples: [
    { id: "ch01.ex.real", label: "Steve Jobs at Macworld 2007", realWorld: true, hardSpecifics: ["Steve Jobs", "Macworld 2007", "iPhone"] },
    { id: "ch01.ex.fiction", label: "A composite manager named Cleo", realWorld: false, hardSpecifics: [] },
    { id: "ch01.ex.nospec", label: "An unnamed study", realWorld: true, hardSpecifics: [] },
  ],
  testableFacts: [
    { id: "ch01.f1", claim: "The iPhone fused three devices into one.", derivedFrom: "ch01.ex.real" },
    { id: "ch01.f2", claim: "Notifications are engineered to recapture attention.", derivedFrom: "" },
  ],
};

test("verifiableItems surfaces real-world cases + facts and SKIPS clearly-fictional illustrations", () => {
  const items = verifiableItems(SIDECAR);
  const ids = items.map((i) => i.id);
  assert.ok(ids.includes("ch01.ex.real"), "a real-world named case must be verified");
  assert.ok(ids.includes("ch01.ex.nospec"), "a real-world case with no hardSpecifics must be flagged for verification");
  assert.ok(!ids.includes("ch01.ex.fiction"), "a realWorld:false illustration is the writer's to invent — not a research-verification item");
  assert.ok(ids.includes("ch01.f1") && ids.includes("ch01.f2"), "every testable fact is verified against its source");
  // The missing-provenance / missing-specifics gaps are made explicit in the detail line.
  assert.match(items.find((i) => i.id === "ch01.f2")!.detail, /no provenance pointer/);
  assert.match(items.find((i) => i.id === "ch01.ex.nospec")!.detail, /none/);
});

// ── checkSourceVerifyRecord — the consumer that makes the gate REAL. Emitting a
// packet proves nothing; reading the FILLED record back and refusing a rubber-stamp
// is the gate. These cover the digital-minimalism failure (81 items bulk-VERIFIED with
// one identical note) plus the per-item correctness checks.
const EXP5: SourceVerifyItem[] = [1, 2, 3, 4, 5].map((i) => ({ chapterNumber: 1, kind: "testable_fact", id: `ch01.f${i}`, claim: `claim ${i}`, detail: "" }));
function rec(items: Array<{ id: string; verdict?: string; sourceRef?: string; note?: string }>): any {
  return { schemaVersion: "source-verify-record-v1", bookId: "zz", chapters: [{ chapterNumber: 1, items }] };
}
const verified = (i: number, note: string, ref: string) => ({ id: `ch01.f${i}`, kind: "testable_fact", verdict: "VERIFIED", sourceRef: ref, note });

test("checkSourceVerifyRecord PASSES a record where every item is VERIFIED with distinct, cited sources", () => {
  const r = rec(EXP5.map((_, idx) => verified(idx + 1, `checked item ${idx + 1} against its source`, `https://example.com/${idx + 1}`)));
  assert.deepEqual(checkSourceVerifyRecord(EXP5, r), []);
});

test("checkSourceVerifyRecord BLOCKS a bulk rubber-stamp: ONE identical note over REUSED sources (SV4)", () => {
  const stamp = "Resolved source(s) support the claim; no contradiction found during this pass.";
  // The real digital-minimalism shape: one identical note, sources reused across items.
  const r = rec(EXP5.map((_, idx) => verified(idx + 1, stamp, `https://example.com/${idx % 2}`)));
  const f = checkSourceVerifyRecord(EXP5, r);
  assert.ok(f.some((x) => x.checkId === "SV4" && x.severity === "blocker"), "uniform note over reused sources must be flagged SV4 blocker");
});

test("checkSourceVerifyRecord does NOT false-positive SV4 when a terse uniform note is backed by DISTINCT real sources", () => {
  // Honest-if-terse: one boilerplate note but a distinct cited source per item IS per-item work.
  const r = rec(EXP5.map((_, idx) => verified(idx + 1, "confirmed", `https://example.com/${idx + 1}`)));
  assert.deepEqual(checkSourceVerifyRecord(EXP5, r), [], "distinct per-item sources must not be flagged a rubber-stamp");
});

test("checkSourceVerifyRecord BLOCKS a single shared source across all items (SV5)", () => {
  const r = rec(EXP5.map((_, idx) => verified(idx + 1, `distinct note ${idx + 1}`, "https://example.com/one")));
  assert.ok(checkSourceVerifyRecord(EXP5, r).some((x) => x.checkId === "SV5" && x.severity === "blocker"), "single sourceRef must be flagged SV5");
});

test("checkSourceVerifyRecord BLOCKS non-VERIFIED verdicts (SV2) and VERIFIED-without-source (SV3)", () => {
  const items = [
    { id: "ch01.f1", verdict: "FILL_ME", sourceRef: "", note: "" },
    { id: "ch01.f2", verdict: "UNVERIFIABLE", sourceRef: "", note: "no source found" },
    { id: "ch01.f3", verdict: "VERIFIED", sourceRef: "", note: "checked" },
  ];
  const exp: SourceVerifyItem[] = items.map((it) => ({ chapterNumber: 1, kind: "testable_fact", id: it.id, claim: "", detail: "" }));
  const f = checkSourceVerifyRecord(exp, rec(items));
  assert.ok(f.some((x) => x.checkId === "SV2" && x.message.includes("ch01.f1")), "FILL_ME → SV2");
  assert.ok(f.some((x) => x.checkId === "SV2" && x.message.includes("ch01.f2")), "UNVERIFIABLE → SV2");
  assert.ok(f.some((x) => x.checkId === "SV3" && x.message.includes("ch01.f3")), "VERIFIED without sourceRef → SV3");
});

test("checkSourceVerifyRecord BLOCKS incomplete coverage — a verifiable item missing from the record (SV1)", () => {
  const r = rec([verified(1, "note one", "https://a")]); // record covers only f1, EXP5 needs f1..f5
  const f = checkSourceVerifyRecord(EXP5, r);
  assert.ok(f.some((x) => x.checkId === "SV1" && x.message.includes("ch01.f2")), "uncovered item → SV1");
});

test("parseSourceVerifyRecord extracts the record JSON from an emitted markdown packet", () => {
  const packet = buildSourceVerificationPacket("zz-fixture-verify", [SIDECAR]);
  const { record, error } = parseSourceVerifyRecord(packet);
  assert.equal(error, undefined);
  assert.equal(record?.schemaVersion, "source-verify-record-v1");
  assert.ok((record?.chapters?.[0].items?.length ?? 0) >= 1);
});

test("the packet carries the verification verdicts, the URL-liveness instruction, and a fillable record skeleton", () => {
  const packet = buildSourceVerificationPacket("zz-fixture-verify", [SIDECAR]);
  // The three operator verdicts the run never produced.
  assert.match(packet, /VERIFIED/);
  assert.match(packet, /UNVERIFIABLE/);
  assert.match(packet, /WRONG/);
  // RAGAS-style claim verification + Wayback-style URL liveness (the deep-research methods).
  assert.match(packet, /AGAINST A REAL SOURCE/);
  assert.match(packet, /RESOLVES|Wayback/);
  // A fillable record the operator submits, with the real case present and the fiction absent.
  const json = JSON.parse(packet.match(/```json\n([\s\S]*?)\n```/)![1]);
  assert.equal(json.schemaVersion, "source-verify-record-v1");
  const ids = json.chapters[0].items.map((i: { id: string }) => i.id);
  assert.ok(ids.includes("ch01.ex.real") && !ids.includes("ch01.ex.fiction"));
  assert.equal(json.chapters[0].items[0].verdict, "FILL_ME");
});
