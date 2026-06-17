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
import { buildSourceVerificationPacket, verifiableItems } from "../src/critics/sourceVerify.js";

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
