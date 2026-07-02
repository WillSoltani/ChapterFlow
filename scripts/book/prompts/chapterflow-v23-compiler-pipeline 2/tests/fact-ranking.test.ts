/**
 * P13 — pedagogical fact ranking.
 *
 * rankTeachingFacts() ranks a packet's facts by a deterministic pedagogical heuristic
 * (chapter-distinct + mechanism + case-linkage + misconception + numbers, minus meta), so a
 * chapter's coreMove is its BEST idea and the blueprint deals facts by role instead of
 * round-robin. These tests pin: ranking determinism + weight behavior, coreMoveFactId
 * selection, SP15's thin-research advisory, the pure assignFactsByRole helper's properties,
 * the blueprint's role structure (spine / quiz cap / card wrap), and — critically — that a
 * LEGACY packet (no teachingPriority/coreMoveFactId) compiles to a byte-identical blueprint
 * (fixture golden captured from the pre-P13 compiler).
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

import { test } from "./harness.js";
import {
  MECHANISM_FALLBACK,
  COMMON_ERROR_FALLBACK,
  WHY_WRONG_FALLBACK,
  WEAK_RANKING_MIN_SCORE,
  applyTeachingRanking,
  rankTeachingFacts,
} from "../src/compiler/sourcePacketFacts.js";
import { assignFactsByRole, compileChapterBlueprint } from "../src/compiler/chapterBlueprint.js";
import { validateSourcePacket } from "../src/compiler/sourcePacketGate.js";
import { SOURCE_PACKET_SCHEMA_VERSION, type SourcePacketFact, type SourcePacketCase, type SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import { sourcePacketPath, writeJsonFile } from "../src/artifacts/artifactStore.js";
import type { ChapterSpec } from "../src/generateChapter.js";

// ── fixtures ──────────────────────────────────────────────────────────────────────
function fact(id: string, over: Partial<SourcePacketFact> = {}): SourcePacketFact {
  return {
    id,
    claim: over.claim ?? `Claim for ${id}.`,
    mechanism: MECHANISM_FALLBACK,
    commonError: COMMON_ERROR_FALLBACK,
    whyWrong: WHY_WRONG_FALLBACK,
    allowedClaimTypes: [],
    groundedNumbers: [],
    groundedEntities: [],
    groundedPlaces: [],
    verificationRefs: [id],
    ...over,
  };
}

function packetOf(facts: SourcePacketFact[], namedCases: SourcePacketCase[] = []): SourcePacketV1 {
  return {
    schemaVersion: SOURCE_PACKET_SCHEMA_VERSION,
    bookId: "zz-fixture-fact-ranking",
    chapterId: "zz-fixture-fact-ranking-ch01",
    chapterNumber: 1,
    chapterTitle: "Test Chapter",
    sourceSidecarPath: null,
    sourceHash: null,
    facts,
    namedCases,
    frameworks: [],
    allowedAnchors: [{ id: "a1", kind: "fact", text: "anchor", sourceRef: "ref" } as any],
    allowedNumbers: [],
    allowedEntities: [],
    allowedPlaces: [],
    forbiddenClaims: [],
    forbiddenLeakage: [],
    sourceQuality: { status: "strong", risks: [] },
  };
}

function caseOf(id: string, label: string, summary: string, hardSpecifics: string[]): SourcePacketCase {
  return { id, label, summary, realWorld: true, hardSpecifics, allowedUses: [], forbiddenUses: [], doNotRestamp: [] };
}

// A distinct, cased, mechanism-bearing fact and its supporting case (keyword overlap >= 2).
const marshmallowCase = caseOf(
  "case.marshmallow",
  "Marshmallow experiment",
  "Children who delayed eating the marshmallow showed stronger self-control years later.",
  ["delayed gratification", "longitudinal study"],
);
function distinctCasedFact(id: string): SourcePacketFact {
  return fact(id, {
    claim: "Delayed gratification in the marshmallow experiment predicts later self-control.",
    mechanism: "Waiting trains the prefrontal cortex to override an immediate marshmallow reward.",
    commonError: "People read the marshmallow result as fixed willpower rather than a trainable skill.",
    whyWrong: "The delay strategy, not innate willpower, is what the marshmallow children actually varied.",
    groundedNumbers: ["15"],
  });
}

// ── determinism + weight behavior ───────────────────────────────────────────────────
test("rankTeachingFacts is deterministic (twice → identical)", () => {
  const packet = packetOf([distinctCasedFact("f.a"), fact("f.b"), fact("f.c", { mechanism: "Real mechanism here." })], [marshmallowCase]);
  assert.deepEqual(rankTeachingFacts(packet), rankTeachingFacts(packet));
});

test("a mechanism-less boilerplate fact never outranks a distinct cased fact", () => {
  const distinct = distinctCasedFact("f.distinct");
  const boiler = fact("f.boiler", { bookWideDuplicate: true }); // fallback mechanism, no case, no numbers, duplicate
  const ranked = rankTeachingFacts(packetOf([boiler, distinct], [marshmallowCase]));
  const posDistinct = ranked.findIndex((r) => r.id === "f.distinct");
  const posBoiler = ranked.findIndex((r) => r.id === "f.boiler");
  assert.ok(posDistinct < posBoiler, `distinct cased fact must rank above boilerplate (got distinct@${posDistinct}, boiler@${posBoiler})`);
  const distinctScore = ranked.find((r) => r.id === "f.distinct")!.score;
  const boilerScore = ranked.find((r) => r.id === "f.boiler")!.score;
  assert.ok(distinctScore >= 7, `distinct+mechanism+cased+misconception+numbers should score >=7, got ${distinctScore}`);
  assert.equal(boilerScore, 0, "a bookWideDuplicate fallback-mechanism fact should score 0");
});

test("meta facts are penalized and rank last", () => {
  const meta = fact("f.meta", { claim: "Each chapter uses at least 3 named cases to seed distractors.", mechanism: "Named people, places, dates, or numbers make the claim checkable." });
  const ranked = rankTeachingFacts(packetOf([distinctCasedFact("f.a"), meta]));
  assert.equal(ranked[ranked.length - 1].id, "f.meta", "meta fact must rank last");
  assert.ok(ranked.find((r) => r.id === "f.meta")!.reasons.includes("meta"));
});

test("stable tie-break by fact id ascending", () => {
  // Three identical-scoring plain facts → order must be id-ascending.
  const ranked = rankTeachingFacts(packetOf([fact("f.c"), fact("f.a"), fact("f.b")]));
  assert.deepEqual(ranked.map((r) => r.id), ["f.a", "f.b", "f.c"]);
});

// ── coreMoveFactId selection ────────────────────────────────────────────────────────
test("applyTeachingRanking picks the top-ranked MECHANISM fact as coreMoveFactId", () => {
  // f.high scores highest (distinct + cased + numbers + misconception) but has NO real mechanism.
  const high = fact("f.high", {
    claim: "Delayed gratification in the marshmallow experiment predicts self-control.",
    // mechanism left as fallback → not a real mechanism
    commonError: "People treat the marshmallow result as fixed willpower.",
    whyWrong: "The delay strategy, not willpower, is what varied.",
    groundedNumbers: ["15"],
  });
  const mech = fact("f.mech", { mechanism: "A real mechanism that explains the effect concretely." });
  const packet = packetOf([high, mech], [marshmallowCase]);
  applyTeachingRanking(packet);
  const ranked = rankTeachingFacts(packet);
  assert.equal(ranked[0].id, "f.high", "f.high should be the top-ranked fact overall");
  assert.equal(packet.coreMoveFactId, "f.mech", "coreMoveFactId must be the top-ranked fact WITH a real mechanism");
  // teachingPriority is 1-based and dense.
  assert.equal(packet.facts.find((f) => f.id === "f.high")!.teachingPriority, 1);
  assert.equal(packet.facts.find((f) => f.id === "f.mech")!.teachingPriority, 2);
});

test("applyTeachingRanking falls back to top-ranked when no fact has a real mechanism", () => {
  const packet = packetOf([fact("f.a"), fact("f.b")]);
  applyTeachingRanking(packet);
  assert.equal(packet.coreMoveFactId, rankTeachingFacts(packet)[0].id);
});

// ── assignFactsByRole (pure helper) ────────────────────────────────────────────────
test("assignFactsByRole: multiplicity cap is respected when the pool is large enough", () => {
  const ids = ["r1", "r2", "r3", "r4", "r5"];
  const out = assignFactsByRole(ids, Array.from({ length: 9 }, () => "any" as const), { maxPerFact: 2 });
  const counts = new Map<string, number>();
  for (const id of out) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, c] of counts) assert.ok(c <= 2, `${id} used ${c} times, cap was 2`);
  assert.equal(out.length, 9);
});

test("assignFactsByRole: cap 1 over N facts and N slots is a permutation", () => {
  const ids = ["a", "b", "c", "d"];
  const out = assignFactsByRole(ids, Array.from({ length: 4 }, () => "any" as const), { maxPerFact: 1 });
  assert.deepEqual([...out].sort(), [...ids].sort());
});

test("assignFactsByRole: mechanism slots prefer mechanism facts, definitional slots prefer the rest", () => {
  const ids = ["m1", "d1", "m2", "d2"];
  const mechanismIds = ["m1", "m2"];
  const out = assignFactsByRole(ids, ["mechanism", "definitional", "mechanism", "definitional"], { maxPerFact: 1, mechanismIds });
  assert.ok(mechanismIds.includes(out[0]), `first mechanism slot got ${out[0]}`);
  assert.ok(mechanismIds.includes(out[2]), `second mechanism slot got ${out[2]}`);
  assert.ok(!mechanismIds.includes(out[1]), `first definitional slot got mechanism fact ${out[1]}`);
  assert.ok(!mechanismIds.includes(out[3]), `second definitional slot got mechanism fact ${out[3]}`);
});

test("assignFactsByRole: empty pool → empty result", () => {
  assert.deepEqual(assignFactsByRole([], ["any", "any"], { maxPerFact: 1 }), []);
});

// ── blueprint role structure (ranked packet) ────────────────────────────────────────
function rankedPacketWithChapter(): { packet: SourcePacketV1; chapter: ChapterSpec } {
  const facts = [
    distinctCasedFact("f.01"),
    fact("f.02", { mechanism: "Second real mechanism explaining the effect.", groundedNumbers: ["3"] }),
    fact("f.03", { mechanism: "Third real mechanism.", commonError: "A real error.", whyWrong: "A real reason it is wrong." }),
    fact("f.04", { groundedNumbers: ["7"] }),
    fact("f.05", { mechanism: "Fifth real mechanism." }),
    fact("f.06"),
    fact("f.07"),
  ];
  const packet = packetOf(facts, [marshmallowCase]);
  applyTeachingRanking(packet);
  const chapter: ChapterSpec = { chapterId: "zz-fixture-fact-ranking-ch01", chapterNumber: 1, chapterTitle: "Test Chapter" };
  return { packet, chapter };
}

test("blueprint (ranked): summaries spine ⊆ top-3 ranked facts; action ⊆ mechanism facts; quiz cap holds", () => {
  const stateRoot = resolve(tmpdir(), `cf-p13-role-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  try {
    const { packet, chapter } = rankedPacketWithChapter();
    writeJsonFile(sourcePacketPath("zz-fixture-fact-ranking", 1, roots), packet);
    const bp = compileChapterBlueprint({ bookId: "zz-fixture-fact-ranking", chapter, packet, packetPath: sourcePacketPath("zz-fixture-fact-ranking", 1, roots), roots, totalChapters: 1 });

    // Teaching pool ordered by rank.
    const byPriority = [...packet.facts].sort((a, b) => (a.teachingPriority! - b.teachingPriority!)).map((f) => f.id);
    const top3 = new Set(byPriority.slice(0, 3));

    // spine ⊆ top-3
    assert.equal(bp.sections.summaries.requiredFactIds.length, 3, "ranked summaries use the top-3 spine");
    for (const id of bp.sections.summaries.requiredFactIds) assert.ok(top3.has(id), `summary fact ${id} not in top-3 spine`);

    // action ⊆ mechanism-bearing facts (all our mechanism facts exist)
    const mechIds = new Set(packet.facts.filter((f) => f.mechanism !== MECHANISM_FALLBACK).map((f) => f.id));
    assert.equal(bp.sections.action.requiredFactIds.length, 3);
    for (const id of bp.sections.action.requiredFactIds) assert.ok(mechIds.has(id), `action fact ${id} is not mechanism-bearing`);

    // quiz multiplicity cap = ceil(9 / distinctFacts)
    const distinct = byPriority.length;
    const cap = Math.ceil(9 / distinct);
    const counts = new Map<string, number>();
    for (const q of bp.sections.quiz) for (const id of q.requiredFactIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    for (const [id, c] of counts) assert.ok(c <= cap, `quiz fact ${id} used ${c}x, cap ${cap}`);

    // cards deal facts 1..7 by rank (wrap only when fewer)
    bp.sections.cards.forEach((c, i) => {
      assert.deepEqual(c.requiredFactIds, [byPriority[i % byPriority.length]], `card ${i} must be rank-order fact`);
    });

    // deep quiz slots (i>=6) should carry mechanism facts
    bp.sections.quiz.slice(6).forEach((q) => {
      assert.ok(q.requiredFactIds.every((id) => mechIds.has(id)), `deep quiz slot fact(s) ${q.requiredFactIds} should be mechanism-bearing`);
    });

    // coreMove statement is the coreMoveFactId's mechanism/claim
    const coreFact = packet.facts.find((f) => f.id === packet.coreMoveFactId)!;
    assert.equal(bp.coreMove.statement, coreFact.mechanism || coreFact.claim);
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

// ── legacy equivalence golden ──────────────────────────────────────────────────────
test("legacy packet (no ranking fields) compiles to a byte-identical blueprint (pre-P13 golden)", () => {
  const legacyPacket = JSON.parse(readFileSync(resolve(HERE, "fixtures", "fact-ranking-legacy-packet.json"), "utf8")) as SourcePacketV1;
  const golden = JSON.parse(readFileSync(resolve(HERE, "fixtures", "fact-ranking-legacy-blueprint.golden.json"), "utf8"));

  // Guard: the fixture packet must genuinely be legacy (no P13 fields) or this proves nothing.
  assert.ok(legacyPacket.coreMoveFactId === undefined, "fixture packet must not carry coreMoveFactId");
  assert.ok(legacyPacket.facts.every((f) => f.teachingPriority === undefined), "fixture packet facts must not carry teachingPriority");

  const stateRoot = resolve(tmpdir(), `cf-p13-legacy-${process.pid}-${Date.now()}`);
  const roots = { stateRoot };
  const chapter: ChapterSpec = { chapterId: legacyPacket.chapterId, chapterNumber: legacyPacket.chapterNumber, chapterTitle: legacyPacket.chapterTitle };
  try {
    mkdirSync(resolve(stateRoot, "indexes"), { recursive: true });
    writeJsonFile(resolve(stateRoot, "indexes", `${legacyPacket.bookId}.json`), [chapter]);
    const bp = compileChapterBlueprint({
      bookId: legacyPacket.bookId,
      chapter,
      packet: legacyPacket,
      packetPath: golden.sourcePacketPath, // reproduce the exact path baked into the golden
      roots,
      totalChapters: 1,
    });
    assert.deepEqual(JSON.parse(JSON.stringify(bp)), golden, "legacy packet must compile byte-identically to the pre-P13 golden");
  } finally {
    rmSync(stateRoot, { recursive: true, force: true });
  }
});

// ── SP15 advisory ───────────────────────────────────────────────────────────────────
test("SP15.weak_ranking fires (advisory, never blocking) on thin research", () => {
  // 6 facts that clear the SP3 floor but are all boilerplate: fallback mechanism, no cases,
  // no grounded numbers, most bookWideDuplicate → almost nothing scores as solid teaching material.
  const facts = Array.from({ length: 6 }, (_, i) => fact(`f.${i + 1}`, { bookWideDuplicate: i > 0 }));
  const packet = packetOf(facts);
  const findings = validateSourcePacket(packet);
  const sp15 = findings.find((f) => f.checkId === "SP15.weak_ranking");
  assert.ok(sp15, "SP15 should fire on thin research");
  assert.equal(sp15!.severity, "advisory", "SP15 must be advisory, never blocking");
});

test("SP15.weak_ranking does NOT fire on strong research", () => {
  const facts = [
    distinctCasedFact("f.1"),
    fact("f.2", { mechanism: "Real mechanism two.", groundedNumbers: ["3"], commonError: "Real error.", whyWrong: "Real reason." }),
    fact("f.3", { mechanism: "Real mechanism three.", groundedNumbers: ["5"] }),
    fact("f.4", { mechanism: "Real mechanism four.", commonError: "Real error four.", whyWrong: "Real reason four." }),
    fact("f.5", { mechanism: "Real mechanism five.", groundedNumbers: ["9"] }),
    fact("f.6", { mechanism: "Real mechanism six.", groundedNumbers: ["11"] }),
  ];
  const packet = packetOf(facts, [marshmallowCase]);
  const strong = rankTeachingFacts(packet).filter((r) => r.score >= WEAK_RANKING_MIN_SCORE).length;
  assert.ok(strong >= 4, `strong fixture should have >=4 solid facts, got ${strong}`);
  assert.ok(!validateSourcePacket(packet).some((f) => f.checkId === "SP15.weak_ranking"), "SP15 must not fire on strong research");
});
