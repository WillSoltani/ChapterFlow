import assert from "node:assert/strict";

import { createBookWriteLock } from "../../src/books/bookLease.js";
import {
  createFileSectionPackCache,
  type SectionPackCacheKey,
} from "../../src/books/sectionPackCache.js";
import {
  createFileSectionAvoidStore,
  type SectionAvoidEntry,
} from "../../src/books/sectionAvoidStore.js";
import {
  planAssemblyEvictions,
  SEC93_MAX_VENUE_CHAPTERS,
} from "../../src/app/compilerApplicationPort.js";
import {
  structureAssemblyBlockers,
  type AssemblyBlocker,
} from "../../src/sections/assembleSections.js";
import { checkSectionGate, type SectionFinding } from "../../src/sections/sectionGate.js";
import { buildSectionTaskMarkdown } from "../../src/sections/sectionTasks.js";
import { compileCreditFixture } from "../fixtures/creditBookFixture.js";
import type { ExamplePackV1, SectionKind } from "../../src/artifacts/artifactTypes.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const BOOK = "assembly-avoid-book";

function packKey(chapterNumber: number, kind: SectionKind): SectionPackCacheKey {
  return {
    bookId: BOOK,
    chapterId: `${BOOK}-ch${String(chapterNumber).padStart(2, "0")}`,
    kind,
    blueprintDigest: `bp-${chapterNumber}-${kind}`,
    packetDigest: `pk-${chapterNumber}-${kind}`,
  };
}

function venueBlocker(chapterNumber: number, phrase = "kitchen table"): AssemblyBlocker {
  return {
    chapterNumber,
    kind: "example-pack",
    checkId: "SEC93.example_venue_stamping",
    signature: `venue:${phrase}`,
    phrase,
    message: `example pack repeats venue "${phrase}" already used by multiple chapters; appears in 3 chapters`,
  };
}

// ---------------------------------------------------------------------------
// (policy) The eviction plan pins the SEC93 threshold: keep the earliest allowed
// offenders, evict only the surplus.
// ---------------------------------------------------------------------------

requiredTest("11aa policy — a 3-chapter venue collision evicts EXACTLY the surplus chapter, keeping the earliest two", () => {
  // Gate: a venue may appear in <= SEC93_MAX_VENUE_CHAPTERS chapters; a blocker
  // fires only above that. Pin the constant to the gate's threshold of 2.
  assert.equal(SEC93_MAX_VENUE_CHAPTERS, 2);

  const chapterIds = new Map<number, string>([
    [1, `${BOOK}-ch01`],
    [5, `${BOOK}-ch05`],
    [6, `${BOOK}-ch06`],
  ]);
  const blockers = [venueBlocker(1), venueBlocker(5), venueBlocker(6)];
  const plan = planAssemblyEvictions(blockers, chapterIds);

  // Minimal set: ch01 and ch05 (earliest two) keep "kitchen table" and together
  // still satisfy the gate; only ch06 is evicted.
  assert.equal(plan.length, 1);
  assert.equal(plan[0].chapterNumber, 6);
  assert.equal(plan[0].chapterId, `${BOOK}-ch06`);
  assert.equal(plan[0].kind, "example-pack");
  assert.deepEqual(plan[0].avoid.keptByChapters, [1, 5]);
  assert.equal(plan[0].avoid.phrase, "kitchen table");
  assert.equal(plan[0].avoid.checkId, "SEC93.example_venue_stamping");
  assert.match(plan[0].avoid.message, /kitchen table/);
  assert.match(plan[0].avoid.message, /ch01/);
  assert.match(plan[0].avoid.message, /ch05/);
});

requiredTest("11aa policy — a 4-chapter collision evicts the two surplus chapters; an unmappable chapter is skipped, never guessed", () => {
  const chapterIds = new Map<number, string>([
    [2, `${BOOK}-ch02`],
    [3, `${BOOK}-ch03`],
    [4, `${BOOK}-ch04`],
    // ch07 deliberately absent from the map — must be skipped, not guessed.
  ]);
  const blockers = [venueBlocker(2), venueBlocker(3), venueBlocker(4), venueBlocker(7)];
  const plan = planAssemblyEvictions(blockers, chapterIds);
  const evicted = plan.map((entry) => entry.chapterNumber).sort((a, b) => a - b);
  // Keep ch02+ch03 (earliest two); ch04 evictable; ch07 unmappable → skipped.
  assert.deepEqual(evicted, [4]);
  assert.deepEqual(plan[0].avoid.keptByChapters, [2, 3]);
});

requiredTest("11aa policy — no structured blockers evicts nothing (unknown assembly failure is not guessed)", () => {
  assert.deepEqual(planAssemblyEvictions([], new Map()), []);
});

// ---------------------------------------------------------------------------
// (structure) structureAssemblyBlockers projects only fully-identified
// cross-chapter findings; unstructured findings are dropped so the port fails loud.
// ---------------------------------------------------------------------------

requiredTest("11aa structure — a signature-bearing cross-chapter finding becomes a blocker; a per-chapter finding without a signature does not", () => {
  const findings: SectionFinding[] = [
    {
      checkId: "SEC93.example_venue_stamping",
      severity: "blocker",
      chapterNumber: 6,
      section: "example-pack",
      path: "/examples/0/scenario",
      message: `example pack repeats venue "kitchen table" already used by multiple chapters; appears in 3 chapters`,
      signature: "venue:kitchen table",
    },
    // No signature (an ordinary per-chapter gate blocker) — must be dropped.
    { checkId: "SEC3.hook_length", severity: "blocker", chapterNumber: 6, section: "summary-pack", message: "hook too short" },
    // A cross-chapter-shaped finding missing chapterNumber — must be dropped.
    { checkId: "SEC93.example_venue_stamping", severity: "blocker", section: "example-pack", message: "x", signature: "venue:break room" },
    // Advisory severity — must be dropped.
    { checkId: "SEC93.example_venue_stamping", severity: "advisory", chapterNumber: 2, section: "example-pack", message: "x", signature: "venue:conference room" },
  ];
  const blockers = structureAssemblyBlockers(findings);
  assert.equal(blockers.length, 1);
  assert.deepEqual(blockers[0], {
    chapterNumber: 6,
    kind: "example-pack",
    checkId: "SEC93.example_venue_stamping",
    signature: "venue:kitchen table",
    phrase: "kitchen table",
    message: `example pack repeats venue "kitchen table" already used by multiple chapters; appears in 3 chapters`,
  });
});

requiredTest("11aa structure — the live SEC93 gate stamps a signature that survives into an AssemblyBlocker", () => {
  // Three chapters whose example packs all narrate the SAME venue ("kitchen
  // table", already present in scenario 0 of the credit fixture) trip SEC93. The
  // finding must now carry a signature so the port can group + evict by it.
  const base = compileCreditFixture(BOOK);
  const selectedChapters = [1, 5, 6].map((chapterNumber) => {
    const blueprint = { ...base.blueprint, chapterNumber, chapterId: `${BOOK}-ch${String(chapterNumber).padStart(2, "0")}` };
    const examples: ExamplePackV1 = { ...base.examples, chapterId: blueprint.chapterId };
    return {
      chapterNumber,
      blueprint,
      sourcePacket: base.packet,
      sourceSidecar: undefined,
      packs: {
        "summary-pack": { ...base.summary, chapterId: blueprint.chapterId },
        "example-pack": examples,
        "learning-pack": { ...base.learning, chapterId: blueprint.chapterId },
        "action-pack": { ...base.action, chapterId: blueprint.chapterId },
      },
    };
  });
  const report = checkSectionGate(BOOK, {}, { selectedChapters });
  const sec93 = report.findings.filter((finding) => finding.checkId === "SEC93.example_venue_stamping");
  assert.ok(sec93.length >= 3, `expected SEC93 findings across 3 chapters, saw ${sec93.length}`);
  const kitchen = sec93.find((finding) => finding.signature === "venue:kitchen table");
  assert.ok(kitchen, "SEC93 venue finding must carry a 'venue:kitchen table' signature");

  const blockers = structureAssemblyBlockers(report.findings);
  const venueBlockers = blockers.filter((blocker) => blocker.signature === "venue:kitchen table");
  assert.equal(new Set(venueBlockers.map((blocker) => blocker.chapterNumber)).size, 3);
  assert.ok(venueBlockers.every((blocker) => blocker.kind === "example-pack" && blocker.phrase === "kitchen table"));
});

// ---------------------------------------------------------------------------
// (durability) FileSectionPackCache.evict and FileSectionAvoidStore both persist
// to disk and survive a fresh store instance (a new process).
// ---------------------------------------------------------------------------

requiredTest("11aa durability — eviction removes exactly the implicated pack and survives a fresh cache instance; non-implicated packs remain reusable", async (context) => {
  const writeLock = createBookWriteLock({ booksRoot: context.roots.booksRoot });
  const cache = createFileSectionPackCache({ booksRoot: context.roots.booksRoot, writeLock });

  // Seed three chapters' example packs (the venue collision) plus a non-implicated
  // summary pack that must never be touched.
  const implicated = [packKey(1, "example-pack"), packKey(5, "example-pack"), packKey(6, "example-pack")];
  const survivor = packKey(6, "summary-pack");
  for (const key of implicated) await cache.write(key, { artifactType: key.kind, venue: "kitchen table" });
  await cache.write(survivor, { artifactType: "summary-pack" });

  // Evict only the surplus chapter (ch06 example-pack), mirroring the plan.
  await cache.evict(packKey(6, "example-pack"));

  // A FRESH cache instance (simulating the next compile process) sees the eviction.
  const nextCache = createFileSectionPackCache({ booksRoot: context.roots.booksRoot, writeLock });
  assert.equal(await nextCache.read(packKey(6, "example-pack")), null);
  // The two kept chapters and the non-implicated summary remain reusable.
  assert.deepEqual(await nextCache.read(packKey(1, "example-pack")), { artifactType: "example-pack", venue: "kitchen table" });
  assert.deepEqual(await nextCache.read(packKey(5, "example-pack")), { artifactType: "example-pack", venue: "kitchen table" });
  assert.deepEqual(await nextCache.read(survivor), { artifactType: "summary-pack" });

  // Eviction is idempotent.
  await cache.evict(packKey(6, "example-pack"));
});

requiredTest("11aa durability — avoid-context is written, read back through a fresh store, and cleared", async (context) => {
  const writeLock = createBookWriteLock({ booksRoot: context.roots.booksRoot });
  const store = createFileSectionAvoidStore({ booksRoot: context.roots.booksRoot, writeLock });
  const key = { bookId: BOOK, chapterId: `${BOOK}-ch06`, kind: "example-pack" as SectionKind };
  const entry: SectionAvoidEntry = {
    checkId: "SEC93.example_venue_stamping",
    phrase: "kitchen table",
    keptByChapters: [1, 5],
    message: `venue "kitchen table" is already used by ch01, ch05 — choose a different concrete venue.`,
  };

  assert.equal(await store.read(key), null);
  await store.write(key, { entries: [entry] });

  // A fresh store instance reads the durable entry.
  const nextStore = createFileSectionAvoidStore({ booksRoot: context.roots.booksRoot, writeLock });
  const read = await nextStore.read(key);
  assert.ok(read);
  assert.deepEqual(read.entries, [entry]);
  // Identity is checked: a different (chapterId,kind) is a miss.
  assert.equal(await nextStore.read({ ...key, chapterId: `${BOOK}-ch01` }), null);

  // Clearing removes it durably.
  await nextStore.clear(key);
  assert.equal(await createFileSectionAvoidStore({ booksRoot: context.roots.booksRoot, writeLock }).read(key), null);
  // Clear is idempotent.
  await nextStore.clear(key);
});

// ---------------------------------------------------------------------------
// (task card) The re-draft task card renders the avoid block naming the colliding
// phrase + kept chapters; absent avoid-context leaves the card byte-identical.
// ---------------------------------------------------------------------------

requiredTest("11aa task card — avoid-context renders a cross-chapter conflict block; absence changes nothing", () => {
  const fixture = compileCreditFixture(BOOK);
  const common = {
    bookId: BOOK,
    kind: "example-pack" as SectionKind,
    blueprint: fixture.blueprint,
    sourcePacket: fixture.packet,
    outputPath: "compiler/ch06/example-pack.json",
    context: { voiceCard: null, bookScars: null },
    deliveryMode: "DIRECT_JSON" as const,
  };
  const withoutAvoid = buildSectionTaskMarkdown(common);
  const avoid: SectionAvoidEntry = {
    checkId: "SEC93.example_venue_stamping",
    phrase: "kitchen table",
    keptByChapters: [1],
    message: `venue "kitchen table" is already used by ch01 — choose a different concrete venue.`,
  };
  const withAvoid = buildSectionTaskMarkdown({ ...common, assemblyAvoid: [avoid] });

  assert.doesNotMatch(withoutAvoid, /CROSS-CHAPTER ASSEMBLY CONFLICT/);
  assert.match(withAvoid, /CROSS-CHAPTER ASSEMBLY CONFLICT/);
  assert.match(withAvoid, /venue "kitchen table" is already used by ch01/);
  // The avoid block is purely additive: the card without it is a prefix of the card with it.
  assert.ok(withAvoid.startsWith(withoutAvoid), "avoid-context must append, never rewrite the base card");
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
