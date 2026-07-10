/**
 * A4 (v24) — writerPacketProjection: the card diet.
 *
 * The v24 whole-chapter writer gets a slim STRICT-ALLOWLIST projection of the
 * source packet instead of the full ~28.6k-char packet JSON. These tests pin:
 * the exact projected bytes for the tracked legacy packet fixture (golden — future
 * drift must be deliberate), the size diet (<= 0.6x of the packet), the allowlist
 * (ranking/dealing metadata like teachingPriority/coreMoveFactId can NEVER leak
 * into the projection), array-order preservation, and purity (no input mutation,
 * no shared array references).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

import { test } from "./harness.js";
import {
  WRITER_PACKET_PROJECTION_SCHEMA_VERSION,
  writerPacketProjection,
} from "../src/compiler/sourcePacketProjection.js";
import type { SourcePacketV1 } from "../src/artifacts/artifactTypes.js";

// ── fixtures ──────────────────────────────────────────────────────────────────────

/** Fresh parse per test so mutation in one test can never leak into another. */
function loadLegacyPacket(): SourcePacketV1 {
  return JSON.parse(
    readFileSync(resolve(HERE, "fixtures", "fact-ranking-legacy-packet.json"), "utf8"),
  ) as SourcePacketV1;
}

/** The legacy fixture predates P13, so it carries none of the ranking metadata.
 *  For the allowlist test we want a packet that HAS every field the projection
 *  must drop, so we decorate the fixture with the P13/P14-era fields. */
function loadDecoratedPacket(): SourcePacketV1 {
  const packet = loadLegacyPacket();
  packet.coreMoveFactId = packet.facts[0].id;
  packet.facts.forEach((fact, i) => {
    fact.teachingPriority = i + 1;
    fact.bookWideDuplicate = i === 0;
  });
  return packet;
}

/** Collect every object key reachable from `value` (recursive, arrays included). */
function collectKeys(value: unknown, into = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, into);
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      into.add(key);
      collectKeys(child, into);
    }
  }
  return into;
}

// ── golden ─────────────────────────────────────────────────────────────────────────

test("GOLDEN: legacy fixture packet projects byte-identically to the committed golden", () => {
  const packet = loadLegacyPacket();
  const golden = JSON.parse(
    readFileSync(resolve(HERE, "fixtures", "writer-projection-legacy.golden.json"), "utf8"),
  );
  const projection = writerPacketProjection(packet);
  assert.equal(projection.schemaVersion, WRITER_PACKET_PROJECTION_SCHEMA_VERSION);
  assert.deepEqual(
    JSON.parse(JSON.stringify(projection)),
    golden,
    "projection of the legacy fixture drifted from the committed golden — if the change is deliberate, regenerate the golden in the same commit",
  );
});

// ── size diet ──────────────────────────────────────────────────────────────────────

test("size: projection is <= 0.6x the full packet JSON on the legacy fixture", () => {
  const packet = loadLegacyPacket();
  const packetLen = JSON.stringify(packet).length;
  const projectionLen = JSON.stringify(writerPacketProjection(packet)).length;
  assert.ok(
    projectionLen <= 0.6 * packetLen,
    `projection is ${projectionLen} chars vs packet ${packetLen} (ratio ${(projectionLen / packetLen).toFixed(3)}) — must be <= 0.6`,
  );
});

// ── strict allowlist ───────────────────────────────────────────────────────────────

test("allowlist: no teachingPriority/coreMoveFactId key anywhere in the projection (recursive)", () => {
  const packet = loadDecoratedPacket();
  // Preconditions: the input really carries the fields we claim to strip.
  assert.equal(typeof packet.coreMoveFactId, "string");
  assert.equal(packet.facts[0].teachingPriority, 1);
  assert.equal(packet.facts[0].bookWideDuplicate, true);

  const keys = collectKeys(JSON.parse(JSON.stringify(writerPacketProjection(packet))));
  for (const forbidden of ["teachingPriority", "coreMoveFactId", "bookWideDuplicate"]) {
    assert.ok(!keys.has(forbidden), `forbidden key "${forbidden}" leaked into the writer projection`);
  }
});

test("allowlist: projection carries ONLY the allowlisted keys (any new packet field is dropped by default)", () => {
  const packet = loadDecoratedPacket();
  // Simulate a future packet field the allowlist has never heard of.
  (packet as unknown as Record<string, unknown>).futureRankingBlob = { secret: "must not leak" };
  const keys = collectKeys(JSON.parse(JSON.stringify(writerPacketProjection(packet))));
  const allowed = new Set([
    "schemaVersion", "bookId", "chapterId", "chapterNumber",
    "facts", "id", "claim", "mechanism", "commonError", "whyWrong",
    "namedCases", "label", "realWorld", "summary", "hardSpecifics",
    "allowedAnchors", "sourceQualityStatus",
  ]);
  const leaked = [...keys].filter((k) => !allowed.has(k)).sort();
  assert.deepEqual(leaked, [], `non-allowlisted key(s) leaked into the writer projection: ${leaked.join(", ")}`);
});

// ── order preservation ─────────────────────────────────────────────────────────────

test("order: facts and namedCases keep exact packet order (also under a reshuffled input)", () => {
  const packet = loadLegacyPacket();
  const projection = writerPacketProjection(packet);
  assert.deepEqual(projection.facts.map((f) => f.id), packet.facts.map((f) => f.id));
  assert.deepEqual(projection.namedCases.map((c) => c.id), packet.namedCases.map((c) => c.id));
  assert.deepEqual(projection.allowedAnchors, packet.allowedAnchors.map((a) => a.id));

  // Order must come from the input, not from any internal sort: reverse and re-project.
  const reversed = loadLegacyPacket();
  reversed.facts.reverse();
  reversed.namedCases.reverse();
  const reprojected = writerPacketProjection(reversed);
  assert.deepEqual(reprojected.facts.map((f) => f.id), [...packet.facts.map((f) => f.id)].reverse());
  assert.deepEqual(reprojected.namedCases.map((c) => c.id), [...packet.namedCases.map((c) => c.id)].reverse());
});

// ── CF-J Task 4: page-citation mint-removal in the projection ─────────────────────

const PAGE_CITE = /\b(?:Ch(?:apter)?\.?\s*\d+\s*,?\s*)?pp?\.\s*\d+|\bon\s+pages?\s+\d+/i;

/** A packet decorated with the radical-candor-class research-minted page citations
 *  in every text field the projection copies. */
function loadCiteMintedPacket(): SourcePacketV1 {
  const packet = loadLegacyPacket();
  packet.facts[0].claim = "Growth Management is documented at Ch. 3 pp. 47-48 as supporting each person's trajectory.";
  packet.facts[0].mechanism = "The trajectory frame works because Ch. 3 pp. 47-48 separates role fit from talent labels.";
  packet.facts[1].commonError = "Treating the label as fixed, per Ch. 3 p. 49.";
  packet.facts[1].whyWrong = "On page 49, the modes are trajectories, not types.";
  packet.namedCases[0].label = "Rock Star Mode appears at Ch. 3 pp. 49-50 as gradual growth.";
  packet.namedCases[0].summary = "The official glossary locates Growth Management at Ch. 3 pp. 47-48. It shifts attention to trajectory.";
  packet.namedCases[0].hardSpecifics = ["gradual growth and mastery", "Ch. 3 pp. 49-50", "role fit over talent labels"];
  return packet;
}

test("CF-J: the projected text carries NO page citations; citation-only hardSpecifics are dropped", () => {
  const packet = loadCiteMintedPacket();
  const projection = writerPacketProjection(packet);
  const projected = JSON.stringify(projection);
  assert.ok(!PAGE_CITE.test(projected), `a page citation survived into the writer projection: ${projected.match(PAGE_CITE)?.[0]}`);
  // Spans stripped, content kept.
  assert.equal(projection.facts[0].claim, "Growth Management is documented as supporting each person's trajectory.");
  assert.equal(projection.facts[1].whyWrong, "the modes are trajectories, not types.");
  assert.equal(projection.namedCases[0].label, "Rock Star Mode appears as gradual growth.");
  // The citation-only hardSpecifics entry is DROPPED; the real specifics survive.
  assert.deepEqual(projection.namedCases[0].hardSpecifics, ["gradual growth and mastery", "role fit over talent labels"]);
});

test("CF-J: the RAW packet keeps its citations (mint-removal is projection-only) and anchor IDs are unchanged", () => {
  const packet = loadCiteMintedPacket();
  const before = JSON.stringify(packet);
  const projection = writerPacketProjection(packet);
  assert.equal(JSON.stringify(packet), before, "the raw packet must keep its page citations byte-for-byte");
  assert.ok(PAGE_CITE.test(before), "precondition: the raw packet really carries citations");
  assert.deepEqual(projection.allowedAnchors, packet.allowedAnchors.map((a) => a.id), "anchor IDs are untouched by the strip");
});

test("CF-J: the writer CARD renders without the packet's page citations (the faithful-quoting channel closed)", async () => {
  const { buildAuthorCard } = await import("../src/orchestrator/authorRun.js");
  const packet = loadCiteMintedPacket();
  const card = buildAuthorCard({
    bookId: packet.bookId,
    chapterNumber: packet.chapterNumber,
    briefMd: "# brief\n",
    packet,
    voice: null,
  });
  // Scope the assertion to the SOURCE PACKET section — the self-verify block
  // legitimately NAMES the citation forms ("Ch./p./pp.") as banned vocabulary.
  const packetSection = card.slice(card.indexOf("SOURCE PACKET"), card.indexOf("OUTPUT"));
  assert.ok(packetSection.length > 100, "precondition: the card carries the SOURCE PACKET section");
  assert.ok(!PAGE_CITE.test(packetSection), `a page citation reached the writer card: ${packetSection.match(PAGE_CITE)?.[0]}`);
});

// ── purity ─────────────────────────────────────────────────────────────────────────

test("purity: projecting never mutates the packet, and projection arrays are fresh", () => {
  const packet = loadLegacyPacket();
  const before = JSON.stringify(packet);
  const projection = writerPacketProjection(packet);
  assert.equal(JSON.stringify(packet), before, "writerPacketProjection mutated its input");

  // Mutating the projection must not reach back into the packet (no aliased arrays).
  projection.facts.pop();
  projection.allowedAnchors.pop();
  const firstCase = projection.namedCases[0];
  if (firstCase?.hardSpecifics) firstCase.hardSpecifics.push("tampered");
  assert.equal(JSON.stringify(packet), before, "projection shares mutable references with the packet");
});
