import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { createBookWriteLock } from "../../src/books/bookLease.js";
import {
  createFileSectionPackCache,
  sectionPackCacheDir,
  type SectionPackCacheKey,
} from "../../src/books/sectionPackCache.js";
import {
  createFileSectionAvoidStore,
  type SectionAvoidEntry,
} from "../../src/books/sectionAvoidStore.js";
import {
  planAssemblyEvictions,
  mergeSectionAvoidEntries,
  SEC93_MAX_VENUE_CHAPTERS,
  CROSS_CHAPTER_EVICTION_POLICIES,
  CROSS_CHAPTER_SATURATION_EVICTION_EXEMPTIONS,
} from "../../src/app/compilerApplicationPort.js";
import {
  structureAssemblyBlockers,
  type AssemblyBlocker,
} from "../../src/sections/assembleSections.js";
import { checkSectionGate, type SectionFinding } from "../../src/sections/sectionGate.js";
import { buildSectionTaskMarkdown } from "../../src/sections/sectionTasks.js";
import { compileCreditFixture } from "../fixtures/creditBookFixture.js";
import type { ExamplePackV1, LearningPackV1, SectionKind } from "../../src/artifacts/artifactTypes.js";
import { finishV25Tests, requiredTest } from "./harness.js";

const BOOK = "assembly-avoid-book";

function packKey(chapterNumber: number, kind: SectionKind): SectionPackCacheKey {
  return {
    bookId: BOOK,
    chapterId: `${BOOK}-ch${String(chapterNumber).padStart(2, "0")}`,
    kind,
    blueprintDigest: `bp-${chapterNumber}-${kind}`,
    packetDigest: `pk-${chapterNumber}-${kind}`,
    scarsDigest: null,
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
// (convergence) The avoid-context is a MONOTONE ban set. mergeSectionAvoidEntries
// is the single accumulation primitive: it unions WITHIN a round (a section that
// collides on multiple venues) and ACROSS rounds (a re-drafted section that
// collides on a new venue), deduping on (checkId, phrase) with existing bans
// retained. Without it the store's single-entry write clobbers prior bans and the
// assembly can oscillate without a convergence bound.
// ---------------------------------------------------------------------------

function avoidEntry(phrase: string, keptByChapters: number[], checkId = "SEC93.example_venue_stamping"): SectionAvoidEntry {
  return {
    checkId,
    phrase,
    keptByChapters,
    message: `venue "${phrase}" is already used by other chapters — choose a different concrete venue.`,
  };
}

requiredTest("11aa convergence — WITHIN a round, a section colliding on two venues yields two evictions for the SAME (chapter,kind) whose union bans BOTH", () => {
  // The finding's demonstrated case: kitchen-table across {1,5,6} and coffee-shop
  // across {2,4,6}. ch06 is the surplus offender in BOTH groups, so it receives two
  // evictions for (ch06, example-pack). The naive per-eviction write persisted only
  // the last phrase; the union must ban both.
  const chapterIds = new Map<number, string>([
    [1, `${BOOK}-ch01`], [2, `${BOOK}-ch02`], [4, `${BOOK}-ch04`],
    [5, `${BOOK}-ch05`], [6, `${BOOK}-ch06`],
  ]);
  const blockers = [
    venueBlocker(1, "kitchen table"), venueBlocker(5, "kitchen table"), venueBlocker(6, "kitchen table"),
    venueBlocker(2, "coffee shop"), venueBlocker(4, "coffee shop"), venueBlocker(6, "coffee shop"),
  ];
  const plan = planAssemblyEvictions(blockers, chapterIds);

  const ch06 = plan.filter((eviction) => eviction.chapterNumber === 6);
  assert.equal(ch06.length, 2, "ch06 is the surplus offender in both venue groups → two evictions");
  assert.deepEqual(new Set(ch06.map((eviction) => eviction.avoid.phrase)), new Set(["kitchen table", "coffee shop"]));

  // The port groups ch06's evictions by (chapter,kind) and writes the union. A
  // single-entry write would keep only one phrase; the union keeps both.
  const merged = mergeSectionAvoidEntries([], ch06.map((eviction) => eviction.avoid));
  assert.deepEqual(merged.map((entry) => entry.phrase).sort(), ["coffee shop", "kitchen table"]);
});

requiredTest("11aa convergence — ACROSS rounds, a new ban ACCUMULATES onto the prior ban instead of clobbering it", () => {
  // Round 1 banned "kitchen table"; ch06 re-drafts, picks "coffee shop", collides.
  // Round 2's write must retain "kitchen table" AND add "coffee shop" so the next
  // re-draft designs away from both — the shrinking-choice measure that bounds
  // convergence. A plain overwrite would forget "kitchen table" → oscillation.
  const round1 = [avoidEntry("kitchen table", [1, 5])];
  const round2 = mergeSectionAvoidEntries(round1, [avoidEntry("coffee shop", [2, 4])]);
  assert.deepEqual(round2.map((entry) => entry.phrase), ["kitchen table", "coffee shop"]);

  const round3 = mergeSectionAvoidEntries(round2, [avoidEntry("break room", [3, 7])]);
  assert.deepEqual(round3.map((entry) => entry.phrase), ["kitchen table", "coffee shop", "break room"]);
});

requiredTest("11aa convergence — a re-banned (checkId,phrase) dedups, existing entry retained (idempotent, order-stable)", () => {
  const existing = [avoidEntry("kitchen table", [1, 5]), avoidEntry("coffee shop", [2, 4])];
  // Re-adding an already-banned phrase (even with different kept-chapters) must not
  // duplicate or reorder — the ban set is stable, so repeated rounds converge.
  const merged = mergeSectionAvoidEntries(existing, [avoidEntry("kitchen table", [9]), avoidEntry("break room", [8])]);
  assert.deepEqual(merged.map((entry) => entry.phrase), ["kitchen table", "coffee shop", "break room"]);
  // The RETAINED "kitchen table" is the existing one (existing-first), not the re-add.
  assert.deepEqual(merged[0].keptByChapters, [1, 5]);
  // A different checkId with the same phrase is a distinct ban (not a dup).
  const cross = mergeSectionAvoidEntries([avoidEntry("kitchen table", [1])], [avoidEntry("kitchen table", [2], "SEC85.action_container")]);
  assert.equal(cross.length, 2);
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

requiredTest("a changed scarsDigest misses the cache, so a new SAFETY rule cannot be bypassed by a cache hit", async (context) => {
  // buildSectionTaskMarkdown — the only thing that renders a scar — is inside the
  // `!reusedFromCache` guard, and cachedSectionPackIsReusable re-runs the section
  // gate, which by design never sees scars. So without scarsDigest in the identity,
  // adding a panel-blocker SAFETY rule and running the documented repair loop would
  // hit cache on every pack, build no prompt, apply nothing, and report green.
  const writeLock = createBookWriteLock({ booksRoot: context.roots.booksRoot });
  const cache = createFileSectionPackCache({ booksRoot: context.roots.booksRoot, writeLock });

  const before = { ...packKey(1, "summary-pack"), scarsDigest: null };
  await cache.write(before, { artifactType: "summary-pack", body: "drafted with no scars" });
  assert.deepEqual(await cache.read(before), { artifactType: "summary-pack", body: "drafted with no scars" });

  // An operator adds a scar. Same chapter, same blueprint, same packet.
  const after = { ...packKey(1, "summary-pack"), scarsDigest: "sha256-of-the-new-safety-rule" };
  assert.equal(await cache.read(after), null, "a pack drafted without the scar must not be reused under it");

  // Redrafting under the scar caches separately, and reverting the scar still finds
  // the original entry rather than serving the scarred pack to a scar-less identity.
  await cache.write(after, { artifactType: "summary-pack", body: "drafted under the rule" });
  assert.deepEqual(await cache.read(after), { artifactType: "summary-pack", body: "drafted under the rule" });

  // Editing the scar again misses again — every distinct scar state is its own identity.
  const edited = { ...packKey(1, "summary-pack"), scarsDigest: "sha256-of-an-edited-rule" };
  assert.equal(await cache.read(edited), null);
});

requiredTest("a legacy cache entry with no scarsDigest still serves a book that has no scars", async (context) => {
  // The compatibility half. Most books have no scar file, so their identity digest
  // is null — and a pre-field entry reads as null, which is exactly what it was
  // drafted under. Keying the FILENAME on the digest would have orphaned all of
  // them; comparing it in identityMatches invalidates only books whose scars moved.
  const writeLock = createBookWriteLock({ booksRoot: context.roots.booksRoot });
  const cache = createFileSectionPackCache({ booksRoot: context.roots.booksRoot, writeLock });
  const key = { ...packKey(2, "action-pack"), scarsDigest: null };
  await cache.write(key, { artifactType: "action-pack" });

  // Strip the field on disk to simulate an entry written before it existed.
  const dir = sectionPackCacheDir(context.roots.booksRoot, key.bookId);
  const files = readdirSync(dir);
  assert.equal(files.length, 1, "one entry expected");
  const entryFile = resolve(dir, files[0]!);
  const envelope = JSON.parse(readFileSync(entryFile, "utf8")) as Record<string, unknown>;
  assert.ok("scarsDigest" in envelope, "new writes must record the field");
  delete envelope.scarsDigest;
  writeFileSync(entryFile, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");

  const nextCache = createFileSectionPackCache({ booksRoot: context.roots.booksRoot, writeLock });
  assert.deepEqual(await nextCache.read(key), { artifactType: "action-pack" }, "legacy entry must still hit for a scar-less book");
  // ...but must NOT satisfy an identity that now carries scars.
  assert.equal(await nextCache.read({ ...key, scarsDigest: "sha256-new" }), null);
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

// ===========================================================================
// Task 11ae — EVERY cross-chapter assembly gate emits an eviction signature, and
// planAssemblyEvictions applies each gate's OWN threshold from a per-checkId
// registry (not the single SEC93 constant). SEC94 (tryThisNow opener reuse) and
// SEC114 (24-hour challenge opener saturation) are the live livelock drivers:
// before 11ae they carried no signature, so structureAssemblyBlockers projected
// nothing, planAssemblyEvictions evicted nothing, and the cached packs replayed
// the identical collision forever (Finding 41).
// ===========================================================================

const SEC94 = "SEC94.action_try_this_now_opener_reuse";
const SEC114 = "SEC114.action_challenge_opener_saturation";
const SEC37 = "SEC37.example_synthetic_scene_shell";
const SEC86 = "SEC86.quiz_repeated_choice_tail";
const SEC95 = "SEC95.summary_hook_first_word_clustering";

function openerBlocker(checkId: string, signature: string, chapterNumber: number): AssemblyBlocker {
  const separator = signature.indexOf(":");
  const phrase = separator >= 0 ? signature.slice(separator + 1) : signature;
  return {
    chapterNumber,
    kind: "action-pack",
    checkId,
    signature,
    phrase,
    message: `${checkId}: opener "${phrase}" repeats across generated chapters`,
  };
}

requiredTest("11ae registry — SEC94 opener reuse evicts per its OWN threshold (keep the single earliest, evict the rest)", () => {
  // SEC94 fires at >= 2 chapters, so a venue-style keep-two would evict nothing;
  // its real threshold keeps exactly ONE chapter. The single SEC93 constant would
  // have kept two — this is the per-checkId threshold the registry restores.
  const chapterIds = new Map<number, string>([[2, `${BOOK}-ch02`], [3, `${BOOK}-ch03`]]);
  const blockers = [
    openerBlocker(SEC94, "tryThisNowOpener:open one card account find", 2),
    openerBlocker(SEC94, "tryThisNowOpener:open one card account find", 3),
  ];
  const plan = planAssemblyEvictions(blockers, chapterIds);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].chapterNumber, 3);
  assert.equal(plan[0].chapterId, `${BOOK}-ch03`);
  assert.equal(plan[0].kind, "action-pack");
  assert.deepEqual(plan[0].avoid.keptByChapters, [2]);
  assert.equal(plan[0].avoid.checkId, SEC94);
  assert.equal(plan[0].avoid.phrase, "open one card account find");
});

requiredTest("11ae registry — SEC114 across 4 chapters (threshold 3) evicts EXACTLY the surplus latest chapter", () => {
  const chapterIds = new Map<number, string>([
    [1, `${BOOK}-ch01`], [3, `${BOOK}-ch03`], [6, `${BOOK}-ch06`], [7, `${BOOK}-ch07`],
  ]);
  const signature = "twentyFourHourChallengeOpener:within the next";
  const blockers = [1, 3, 6, 7].map((chapterNumber) => openerBlocker(SEC114, signature, chapterNumber));
  const plan = planAssemblyEvictions(blockers, chapterIds);
  assert.equal(plan.length, 1, "keep the 3 earliest offenders; evict only the surplus latest");
  assert.equal(plan[0].chapterNumber, 7);
  assert.deepEqual(plan[0].avoid.keptByChapters, [1, 3, 6]);
  assert.equal(plan[0].avoid.checkId, SEC114);
});

requiredTest("11ae registry — a MIXED-gate assembly failure evicts the UNION with per-gate minimality", () => {
  const chapterIds = new Map<number, string>([
    [1, `${BOOK}-ch01`], [2, `${BOOK}-ch02`], [3, `${BOOK}-ch03`], [6, `${BOOK}-ch06`], [7, `${BOOK}-ch07`],
  ]);
  const blockers = [
    // SEC94 (keep 1) across ch02, ch03 → evict ch03.
    openerBlocker(SEC94, "tryThisNowOpener:open one card account find", 2),
    openerBlocker(SEC94, "tryThisNowOpener:open one card account find", 3),
    // SEC114 (keep 3) across ch01, ch03, ch06, ch07 → evict ch07.
    ...[1, 3, 6, 7].map((chapterNumber) => openerBlocker(SEC114, "twentyFourHourChallengeOpener:within the next", chapterNumber)),
  ];
  const plan = planAssemblyEvictions(blockers, chapterIds);
  const evicted = plan.map((eviction) => `ch${eviction.chapterNumber}:${eviction.avoid.checkId}`).sort();
  assert.deepEqual(evicted, [`ch3:${SEC94}`, `ch7:${SEC114}`]);
});

requiredTest("11ae registry — per-checkId avoid wording: venue speaks venue; openers speak openers and name the kept chapters", () => {
  const venuePlan = planAssemblyEvictions(
    [venueBlocker(1), venueBlocker(5), venueBlocker(6)],
    new Map<number, string>([[1, `${BOOK}-ch01`], [5, `${BOOK}-ch05`], [6, `${BOOK}-ch06`]]),
  );
  assert.match(venuePlan[0].avoid.message, /venue "kitchen table"/);
  assert.doesNotMatch(venuePlan[0].avoid.message, /opener/);

  const openerPlan = planAssemblyEvictions(
    [
      openerBlocker(SEC94, "tryThisNowOpener:open one card account find", 2),
      openerBlocker(SEC94, "tryThisNowOpener:open one card account find", 3),
    ],
    new Map<number, string>([[2, `${BOOK}-ch02`], [3, `${BOOK}-ch03`]]),
  );
  assert.match(openerPlan[0].avoid.message, /opener/);
  assert.match(openerPlan[0].avoid.message, /open one card account find/);
  assert.match(openerPlan[0].avoid.message, /ch02/);
  assert.doesNotMatch(openerPlan[0].avoid.message, /venue/);
});

requiredTest("11ae registry — a cross-chapter gate WITHOUT a registry entry evicts NOTHING and fails loud", () => {
  const rogue = (chapterNumber: number): AssemblyBlocker => ({
    chapterNumber,
    kind: "action-pack",
    checkId: "SEC999.unregistered_cross_chapter",
    signature: "rogue:phrase",
    phrase: "phrase",
    message: "unregistered cross-chapter gate",
  });
  const blockers = [rogue(1), rogue(2), rogue(3)];
  const chapterIds = new Map<number, string>([[1, "a"], [2, "b"], [3, "c"]]);
  // Loud: an unregistered stamped gate is a programming error (a signature was
  // emitted with no threshold/kind/wording), so the pure function throws rather
  // than silently applying some other gate's threshold — and evicts nothing.
  assert.throws(() => planAssemblyEvictions(blockers, chapterIds), /UNREGISTERED|registr/i);
});

requiredTest("11ae registry — SEC93/SEC94/SEC114 are all registered with the gate's own threshold and kind", () => {
  assert.equal(CROSS_CHAPTER_EVICTION_POLICIES.get("SEC93.example_venue_stamping")?.maxKeptChapters, SEC93_MAX_VENUE_CHAPTERS);
  assert.equal(CROSS_CHAPTER_EVICTION_POLICIES.get("SEC93.example_venue_stamping")?.kind, "example-pack");
  assert.equal(CROSS_CHAPTER_EVICTION_POLICIES.get(SEC94)?.maxKeptChapters, 1);
  assert.equal(CROSS_CHAPTER_EVICTION_POLICIES.get(SEC94)?.kind, "action-pack");
  assert.equal(CROSS_CHAPTER_EVICTION_POLICIES.get(SEC114)?.maxKeptChapters, 3);
  assert.equal(CROSS_CHAPTER_EVICTION_POLICIES.get(SEC114)?.kind, "action-pack");
  // Every registered policy has a sane threshold and a wording builder.
  for (const [checkId, policy] of CROSS_CHAPTER_EVICTION_POLICIES) {
    assert.ok(policy.maxKeptChapters >= 1, `${checkId} keeps at least one chapter`);
    assert.ok(policy.avoidMessage("x", "ch01").length > 0, `${checkId} builds an avoid message`);
  }
});

requiredTest("11ae registry — the live SEC94 and SEC114 gates stamp signatures that survive into AssemblyBlockers and drive eviction", () => {
  // Four chapters whose action packs share the same tryThisNow opener AND the same
  // 24-hour-challenge opener trip SEC94 (>=2 chapters) and SEC114 (>=4 chapters).
  const base = compileCreditFixture(BOOK);
  const selectedChapters = [1, 3, 6, 7].map((chapterNumber) => {
    const blueprint = { ...base.blueprint, chapterNumber, chapterId: `${BOOK}-ch${String(chapterNumber).padStart(2, "0")}` };
    return {
      chapterNumber,
      blueprint,
      sourcePacket: base.packet,
      sourceSidecar: undefined,
      packs: {
        "summary-pack": { ...base.summary, chapterId: blueprint.chapterId },
        "example-pack": { ...base.examples, chapterId: blueprint.chapterId },
        "learning-pack": { ...base.learning, chapterId: blueprint.chapterId },
        "action-pack": { ...base.action, chapterId: blueprint.chapterId },
      },
    };
  });
  const report = checkSectionGate(BOOK, {}, { selectedChapters });

  const sec94 = report.findings.filter((finding) => finding.checkId === SEC94);
  const sec114 = report.findings.filter((finding) => finding.checkId === SEC114);
  assert.ok(sec94.length >= 2, `expected SEC94 findings, saw ${sec94.length}`);
  assert.ok(sec114.length >= 4, `expected SEC114 findings across 4 chapters, saw ${sec114.length}`);
  assert.ok(
    sec94.every((finding) => typeof finding.signature === "string" && finding.signature.startsWith("tryThisNowOpener:")),
    "every SEC94 finding must carry a tryThisNowOpener signature",
  );
  assert.ok(
    sec114.every((finding) => typeof finding.signature === "string" && finding.signature.startsWith("twentyFourHourChallengeOpener:")),
    "every SEC114 finding must carry a twentyFourHourChallengeOpener signature",
  );

  const blockers = structureAssemblyBlockers(report.findings);
  assert.ok(blockers.some((blocker) => blocker.checkId === SEC94 && blocker.kind === "action-pack"));
  assert.ok(blockers.some((blocker) => blocker.checkId === SEC114 && blocker.kind === "action-pack"));

  // The registry converges the collision: SEC94 keeps 1, SEC114 keeps 3, so both
  // gates evict at least their surplus chapter — a non-empty, per-gate plan.
  const chapterIds = new Map<number, string>(selectedChapters.map((chapter) => [chapter.chapterNumber, chapter.blueprint.chapterId]));
  const plan = planAssemblyEvictions(blockers, chapterIds);
  assert.ok(plan.some((eviction) => eviction.avoid.checkId === SEC94), "SEC94 must produce an eviction");
  assert.ok(plan.some((eviction) => eviction.avoid.checkId === SEC114), "SEC114 must produce an eviction");
});

// ---------------------------------------------------------------------------
// Task 11ae review — SEC86 and SEC95 are cross-chapter SATURATION cluster gates
// that are structurally like the 16 stamped gates but whose firing conditions do
// not reduce to a static keep-earliest-N. They are DELIBERATELY unstamped and must
// be catalogued as documented exemptions so the decision is first-class, not a
// silent omission that would re-open the Finding-41 livelock unexamined.
// ---------------------------------------------------------------------------

requiredTest("11ae exemptions — every cross-chapter saturation gate is either evicted OR documented-exempt, never silently omitted", () => {
  // SEC37 (single-chapter ban), SEC86 (compound choice-count trigger), and SEC95
  // (batch-relative threshold) are the deliberately un-evicted saturation gates.
  for (const checkId of [SEC37, SEC86, SEC95]) {
    const rationale = CROSS_CHAPTER_SATURATION_EVICTION_EXEMPTIONS.get(checkId);
    assert.ok(rationale && rationale.length > 0, `${checkId} must carry a documented exemption rationale`);
    // Mutually exclusive: an exempt gate is NEVER also a stamped eviction policy —
    // otherwise planAssemblyEvictions could try to evict a gate that cannot converge.
    assert.equal(CROSS_CHAPTER_EVICTION_POLICIES.has(checkId), false, `${checkId} must not also be a stamped eviction policy`);
  }
  // The two registries are globally disjoint (the module-load guard enforces this;
  // the test pins it so a regression is caught in CI, not only at import time).
  for (const checkId of CROSS_CHAPTER_SATURATION_EVICTION_EXEMPTIONS.keys()) {
    assert.equal(CROSS_CHAPTER_EVICTION_POLICIES.has(checkId), false, `${checkId} is exempt and must not be stamped`);
  }
});

requiredTest("11ae exemptions — the live SEC95 gate fires yet stays unstamped, so it projects NO assembly blocker and never reaches planAssemblyEvictions", () => {
  // Five chapters whose summary hooks share the same first word saturate SEC95
  // (group 5 of 5 >= ceil(5 * cap) threshold).
  const base = compileCreditFixture(BOOK);
  const selectedChapters = [1, 2, 3, 4, 5].map((chapterNumber) => {
    const blueprint = { ...base.blueprint, chapterNumber, chapterId: `${BOOK}-ch${String(chapterNumber).padStart(2, "0")}` };
    return {
      chapterNumber,
      blueprint,
      sourcePacket: base.packet,
      sourceSidecar: undefined,
      packs: {
        "summary-pack": { ...base.summary, chapterId: blueprint.chapterId },
        "example-pack": { ...base.examples, chapterId: blueprint.chapterId },
        "learning-pack": { ...base.learning, chapterId: blueprint.chapterId },
        "action-pack": { ...base.action, chapterId: blueprint.chapterId },
      },
    };
  });
  const report = checkSectionGate(BOOK, {}, { selectedChapters });
  const sec95 = report.findings.filter((finding) => finding.checkId === SEC95);
  assert.ok(sec95.length >= 5, `expected SEC95 to fire across the batch, saw ${sec95.length}`);
  // Deliberately unstamped: no finding carries a signature, so structureAssemblyBlockers
  // drops every one and the eviction machinery is never engaged for SEC95.
  assert.ok(sec95.every((finding) => finding.signature === undefined), "SEC95 findings must stay unstamped");
  const blockers = structureAssemblyBlockers(report.findings);
  assert.equal(blockers.some((blocker) => blocker.checkId === SEC95), false, "SEC95 must not project an assembly blocker");
});

requiredTest("11ae exemptions — the live SEC86 gate fires yet stays unstamped, so it projects NO assembly blocker", () => {
  // Three chapters whose quiz choices share a generic mechanical tail trip SEC86
  // (chapters.size >= 3).
  const base = compileCreditFixture(BOOK);
  const tailedLearning = (chapterId: string): LearningPackV1 => {
    const questions = base.learning.quiz.questions.map((question, index) => {
      if (index !== 0) return question;
      const choices = [...(question.choices ?? [])];
      choices[0] = `${choices[0]} evaluated under the stated evidence test`;
      return { ...question, choices };
    });
    return { ...base.learning, chapterId, quiz: { ...base.learning.quiz, questions } };
  };
  const selectedChapters = [1, 2, 3].map((chapterNumber) => {
    const blueprint = { ...base.blueprint, chapterNumber, chapterId: `${BOOK}-ch${String(chapterNumber).padStart(2, "0")}` };
    return {
      chapterNumber,
      blueprint,
      sourcePacket: base.packet,
      sourceSidecar: undefined,
      packs: {
        "summary-pack": { ...base.summary, chapterId: blueprint.chapterId },
        "example-pack": { ...base.examples, chapterId: blueprint.chapterId },
        "learning-pack": tailedLearning(blueprint.chapterId),
        "action-pack": { ...base.action, chapterId: blueprint.chapterId },
      },
    };
  });
  const report = checkSectionGate(BOOK, {}, { selectedChapters });
  const sec86 = report.findings.filter((finding) => finding.checkId === SEC86);
  assert.ok(sec86.length >= 3, `expected SEC86 to fire across 3 chapters, saw ${sec86.length}`);
  assert.ok(sec86.every((finding) => finding.signature === undefined), "SEC86 findings must stay unstamped");
  const blockers = structureAssemblyBlockers(report.findings);
  assert.equal(blockers.some((blocker) => blocker.checkId === SEC86), false, "SEC86 must not project an assembly blocker");
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
