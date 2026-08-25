import assert from "node:assert/strict";

import { createBookWriteLock } from "../../src/books/bookLease.js";
import {
  createFileSectionPackCache,
  type SectionPackCacheKey,
} from "../../src/books/sectionPackCache.js";
import { createFileSectionAvoidStore } from "../../src/books/sectionAvoidStore.js";
import {
  applyAssemblyEvictionPlan,
  assemblyBlockDetail,
  planAssemblyEvictions,
  ASSEMBLY_AVOID_MAX_ROUNDS,
  CROSS_CHAPTER_EVICTION_POLICIES,
  CROSS_CHAPTER_SATURATION_EVICTION_EXEMPTIONS,
} from "../../src/app/compilerApplicationPort.js";
import { structureAssemblyBlockers } from "../../src/sections/assembleSections.js";
import { checkSectionGate, type SectionFinding } from "../../src/sections/sectionGate.js";
import { buildSectionTaskMarkdown } from "../../src/sections/sectionTasks.js";
import { compileCreditFixture } from "../fixtures/creditBookFixture.js";
import type { SectionKind, SummaryPackV1 } from "../../src/artifacts/artifactTypes.js";
import { finishV25Tests, requiredTest } from "./harness.js";

// ===========================================================================
// The REGENERATION livelock, one level above the 11aa cache livelock.
//
// Live evidence (canary run book-run-089ada24, "how-to-live-on-24-hours-a-day",
// 13 chapters, cold): rounds 18-24 emitted COMPILER_ASSEMBLY_BLOCKED naming the
// SAME SEC83 cross-chapter 5-gram in ch01/ch08/ch11 with ZERO
// EVICT_ON_ASSEMBLY_BLOCK lines and 52/52 REUSE_SECTION_PACK — every pack in the
// book served from cache, nothing re-drafted, byte-identical failure forever.
//
// Cause: SEC83.summary_cross_chapter_ngram emitted its finding with NO
// `signature`, so structureAssemblyBlockers dropped it, planAssemblyEvictions saw
// [], and #applyAssemblyEvictions returned before touching the cache. The gate was
// neither STAMPED (evicted) nor listed in the documented-exemption registry — the
// "silently omitted" third state the 11ae registry comment says must not exist.
// The evictions seen in rounds 11-12 belonged to SEC96/SEC114/SEC93 (stamped
// gates that converged); SEC83 never entered the machinery at all.
// ===========================================================================

const BOOK = "regen-livelock-book";
const SEC83 = "SEC83.summary_cross_chapter_ngram";
const SEC89 = "SEC89.example_cross_chapter_literal_ngram";

/** The live colliding window, verbatim from bn-r24.log. Five whitespace tokens,
 *  two of them content tokens, so it registers as a literal n-gram window. */
const LIVE_PHRASE = "It does not matter how";

function chapterId(chapterNumber: number): string {
  return `${BOOK}-ch${String(chapterNumber).padStart(2, "0")}`;
}

/**
 * Chapter-unique tier prose. Every token is tagged with the chapter and tier, so no
 * 5-token window can collide across chapters BY ACCIDENT — the only shared window in
 * the whole book is the one deliberately spliced in. That isolation is what makes the
 * round driver meaningful: a re-draft that gives up the phrase actually converges,
 * instead of tripping the same gate on unrelated shared fixture prose.
 */
function tierText(chapterNumber: number, tier: string, phrase: string | null): string {
  const words: string[] = [];
  for (let index = 0; index < 40; index += 1) words.push(`w${chapterNumber}${tier}q${index}`);
  if (phrase !== null) words.splice(20, 0, phrase);
  return `${words.join(" ")}.`;
}

/** A summary pack whose fullRead tier carries `phrase` verbatim and whose every
 *  other word is chapter-unique. */
function summaryWithPhrase(base: SummaryPackV1, chapterNumber: number, phrase: string | null): SummaryPackV1 {
  return {
    ...base,
    chapterId: chapterId(chapterNumber),
    breakdown: {
      ...base.breakdown,
      fastRead: tierText(chapterNumber, "fast", null),
      deepRead: tierText(chapterNumber, "deep", null),
      fullRead: tierText(chapterNumber, "full", phrase),
    },
  };
}

type ChapterPacks = ReturnType<typeof selectedChapter>;

function selectedChapter(
  base: ReturnType<typeof compileCreditFixture>,
  chapterNumber: number,
  summary: SummaryPackV1,
) {
  const id = chapterId(chapterNumber);
  return {
    chapterNumber,
    blueprint: { ...base.blueprint, chapterNumber, chapterId: id },
    sourcePacket: base.packet,
    sourceSidecar: undefined,
    packs: {
      "summary-pack": summary,
      "example-pack": { ...base.examples, chapterId: id },
      "learning-pack": { ...base.learning, chapterId: id },
      "action-pack": { ...base.action, chapterId: id },
    },
  };
}

function sec83Findings(chapters: readonly ChapterPacks[]): SectionFinding[] {
  const report = checkSectionGate(BOOK, {}, { selectedChapters: [...chapters] });
  return report.findings.filter((finding) => finding.checkId === SEC83 && finding.severity === "blocker");
}

// ---------------------------------------------------------------------------
// (reproduction) The live gate fires on three chapters sharing one 5-gram.
// ---------------------------------------------------------------------------

requiredTest("regen-livelock — the live SEC83 gate fires on the canary's 3-chapter 5-gram collision", () => {
  const base = compileCreditFixture(BOOK);
  const chapters = [1, 8, 11].map((n) => selectedChapter(base, n, summaryWithPhrase(base.summary, n, LIVE_PHRASE)));
  const findings = sec83Findings(chapters);
  assert.ok(findings.length >= 3, `expected SEC83 across ch01/ch08/ch11, saw ${findings.length}`);
  const blockedChapters = [...new Set(findings.map((finding) => finding.chapterNumber ?? 0))].sort((a, b) => a - b);
  assert.deepEqual(blockedChapters, [1, 8, 11]);
  // The live message shape, so this is the same gate the canary tripped.
  assert.ok(findings.every((finding) => finding.message.includes(LIVE_PHRASE)), "the finding must name the colliding phrase");
});

requiredTest("regen-livelock — TWO overlapping phrases each get their own finding and full chapter set, so the plan is never empty (single-stamp residual)", () => {
  // Adversarial review's residual: with one finding per FIELD stamped only with
  // that chapter's WIDEST hit, different chapters could stamp DIFFERENT phrases,
  // splitting every phrase's eviction group below the keep count — zero
  // evictions planned while the gate still blocks, and the round bound never
  // engages. Per-phrase emission makes each phrase's group carry ALL chapters.
  const base = compileCreditFixture(BOOK);
  const second = "guard the evening hours jealously";
  const chapters = [1, 8, 11].map((n) => {
    const withFirst = summaryWithPhrase(base.summary, n, LIVE_PHRASE);
    // summaryWithPhrase rebuilds every tier from tierText, so the second phrase
    // must be appended AFTER it, into the same fullRead tier the gate scans.
    const withBoth = {
      ...withFirst,
      breakdown: { ...withFirst.breakdown, fullRead: `${withFirst.breakdown.fullRead} Readers ${second} after supper ends.` },
    };
    return selectedChapter(base, n, withBoth);
  });
  const findings = sec83Findings(chapters);
  const signatures = new Set(findings.map((finding) => finding.signature));
  assert.ok(signatures.has(`summaryNgram:${LIVE_PHRASE}`), `first phrase stamped: ${[...signatures].join(" | ")}`);
  assert.ok([...signatures].some((sig) => sig !== undefined && sig !== `summaryNgram:${LIVE_PHRASE}`), "the SECOND colliding phrase gets its own signature too");
  // Every stamped phrase's blocker group carries the full chapter set, so the
  // planner keeps the earliest 2 and evicts the surplus for EACH phrase.
  const blockers = structureAssemblyBlockers(findings);
  const byPhrase = new Map();
  for (const blocker of blockers) {
    const group = byPhrase.get(blocker.phrase) ?? new Set();
    group.add(blocker.chapterNumber);
    byPhrase.set(blocker.phrase, group);
  }
  for (const [phrase, group] of byPhrase) {
    assert.equal(group.size, 3, `phrase "${phrase}" must carry all three chapters, saw ${[...group].join(",")}`);
  }
  const plan = planAssemblyEvictions(blockers, new Map([[1, "ch01"], [8, "ch08"], [11, "ch11"]]));
  assert.ok(plan.length > 0, "a multi-phrase collision must still plan evictions");
});

// ---------------------------------------------------------------------------
// (the defect) SEC83 must reach the eviction machinery instead of being dropped.
// Before the fix this test FAILS at the signature assertion: the finding carried
// no signature, structureAssemblyBlockers returned [], and the plan was empty —
// exactly the zero-eviction wedge in bn-r18..r24.
// ---------------------------------------------------------------------------

requiredTest("regen-livelock — SEC83 stamps a signature, projects blockers, and plans a non-empty eviction (was: dropped, zero evictions forever)", () => {
  const base = compileCreditFixture(BOOK);
  const chapters = [1, 8, 11].map((n) => selectedChapter(base, n, summaryWithPhrase(base.summary, n, LIVE_PHRASE)));
  const findings = sec83Findings(chapters);

  assert.ok(
    findings.every((finding) => typeof finding.signature === "string" && finding.signature.startsWith("summaryNgram:")),
    "every SEC83 finding must carry a summaryNgram signature or the port can never evict it",
  );

  const blockers = structureAssemblyBlockers(findings);
  assert.ok(blockers.length >= 3, `SEC83 must project assembly blockers, saw ${blockers.length}`);
  assert.ok(blockers.every((blocker) => blocker.kind === "summary-pack"));
  assert.ok(blockers.every((blocker) => blocker.phrase === LIVE_PHRASE), "the phrase must survive the signature round-trip");

  // keep-earliest-2 mirrors the gate (a finding needs >= 2 OTHER chapters, so two
  // chapters carrying the phrase is below the firing threshold): ch01+ch08 keep it,
  // ch11 alone is evicted and re-drafts.
  const ids = new Map<number, string>([1, 8, 11].map((n) => [n, chapterId(n)] as const));
  const plan = planAssemblyEvictions(blockers, ids);
  assert.equal(plan.length, 1, "exactly the surplus chapter is evicted");
  assert.equal(plan[0].chapterNumber, 11);
  assert.equal(plan[0].kind, "summary-pack");
  assert.deepEqual(plan[0].avoid.keptByChapters, [1, 8]);
  assert.equal(plan[0].avoid.phrase, LIVE_PHRASE);
});

requiredTest("regen-livelock — SEC83/SEC89 are registered evictable gates, and neither is silently omitted from both registries", () => {
  for (const checkId of [SEC83, SEC89]) {
    const policy = CROSS_CHAPTER_EVICTION_POLICIES.get(checkId);
    assert.ok(policy, `${checkId} must carry an eviction policy`);
    assert.equal(policy.maxKeptChapters, 2, `${checkId} keeps two chapters (the gate needs >= 2 OTHER chapters to fire)`);
    assert.equal(CROSS_CHAPTER_SATURATION_EVICTION_EXEMPTIONS.has(checkId), false);
  }
  assert.equal(CROSS_CHAPTER_EVICTION_POLICIES.get(SEC83)?.kind, "summary-pack");
  assert.equal(CROSS_CHAPTER_EVICTION_POLICIES.get(SEC89)?.kind, "example-pack");
});

// ---------------------------------------------------------------------------
// (round driver) Compose the REAL production units — checkSectionGate →
// structureAssemblyBlockers → planAssemblyEvictions → applyAssemblyEvictionPlan —
// against the real file cache and real avoid store, with a fake writer standing in
// for the model. This is the compile loop's cross-chapter half, hermetic.
// ---------------------------------------------------------------------------

/** Stands in for the section model. It is handed the SAME task-card markdown the
 *  live writer receives — built by the real buildSectionTaskMarkdown from the real
 *  avoid-context — so "the writer honoured the escalation" means the escalation
 *  actually reached the prompt, not merely that a field was set on an entry. */
type Writer = (chapterNumber: number, taskCard: string) => SummaryPackV1;

type RoundResult = {
  readonly round: number;
  readonly blocked: boolean;
  readonly evictedSections: number;
  readonly unconvergedPhrases: readonly string[];
  readonly detail: string;
};

async function driveRounds(
  booksRoot: string,
  chapterNumbers: readonly number[],
  writer: Writer,
  rounds: number,
): Promise<RoundResult[]> {
  const writeLock = createBookWriteLock({ booksRoot });
  const cache = createFileSectionPackCache({ booksRoot, writeLock });
  const avoidStore = createFileSectionAvoidStore({ booksRoot, writeLock });
  const base = compileCreditFixture(BOOK);

  const cacheKey = (chapterNumber: number): SectionPackCacheKey => ({
    bookId: BOOK,
    chapterId: chapterId(chapterNumber),
    kind: "summary-pack",
    blueprintDigest: "bp-fixed",
    packetDigest: "pk-fixed",
    scarsDigest: null,
  });
  const chapterCacheContext = new Map(
    chapterNumbers.map((n) => [n, Object.freeze({ chapterId: chapterId(n), blueprintDigest: "bp-fixed", packetDigest: "pk-fixed", scarsDigest: null })] as const),
  );

  const results: RoundResult[] = [];
  for (let round = 1; round <= rounds; round += 1) {
    // Draft phase: a cache HIT is reused verbatim (the 11y contract, and the exact
    // behaviour that made the live wedge permanent — 52/52 REUSE_SECTION_PACK); a
    // miss is re-drafted from a task card rendered by the real builder off the real
    // avoid-context, which is the only channel a section writer has.
    const selected: ChapterPacks[] = [];
    for (const chapterNumber of chapterNumbers) {
      const key = cacheKey(chapterNumber);
      const cached = (await cache.read(key)) as SummaryPackV1 | null;
      let pack: SummaryPackV1;
      if (cached !== null) {
        pack = cached;
      } else {
        const avoid = await avoidStore.read({ bookId: BOOK, chapterId: chapterId(chapterNumber), kind: "summary-pack" });
        const taskCard = buildSectionTaskMarkdown({
          bookId: BOOK,
          kind: "summary-pack",
          blueprint: { ...base.blueprint, chapterNumber, chapterId: chapterId(chapterNumber) },
          sourcePacket: base.packet,
          outputPath: `compiler/ch${String(chapterNumber).padStart(2, "0")}/summary-pack.json`,
          context: { voiceCard: null, bookScars: null },
          deliveryMode: "DIRECT_JSON",
          assemblyAvoid: avoid?.entries,
        });
        pack = writer(chapterNumber, taskCard);
        await cache.write(key, pack as unknown as Record<string, unknown>);
      }
      selected.push(selectedChapter(base, chapterNumber, pack));
    }

    // Assembly phase: the real cross-chapter gate, then the real eviction plan.
    const findings = sec83Findings(selected);
    if (findings.length === 0) {
      results.push({ round, blocked: false, evictedSections: 0, unconvergedPhrases: [], detail: "" });
      break;
    }
    const blockers = structureAssemblyBlockers(findings);
    const outcome = await applyAssemblyEvictionPlan({
      bookId: BOOK,
      cache,
      avoidStore,
      chapterCacheContext,
      blockers,
    });
    results.push({
      round,
      blocked: true,
      evictedSections: outcome.evictedSections,
      unconvergedPhrases: outcome.unconverged.map((entry) => entry.phrase),
      detail: assemblyBlockDetail(
        findings.map((finding) => `ch${String(finding.chapterNumber ?? 0).padStart(2, "0")}: [${finding.checkId}] ${finding.message}`),
        [SEC83],
        outcome,
      ),
    });
  }
  return results;
}

/** Always re-mints the banned phrase — the live failure mode (rounds 13-17
 *  re-drafted and the SAME phrase came back in the SAME chapters). */
function stubbornWriter(base: ReturnType<typeof compileCreditFixture>): Writer {
  return (chapterNumber) => summaryWithPhrase(base.summary, chapterNumber, LIVE_PHRASE);
}

requiredTest("regen-livelock — a writer that always re-mints the phrase is EVICTED every round and fails closed at the bound, never silently wedged", async (context) => {
  const base = compileCreditFixture(BOOK);
  const results = await driveRounds(context.roots.booksRoot, [1, 8, 11], stubbornWriter(base), ASSEMBLY_AVOID_MAX_ROUNDS + 3);

  // The wedge signature the canary showed — "blocked with zero evictions" — must
  // never occur while the bound has not been reached.
  for (const result of results.slice(0, ASSEMBLY_AVOID_MAX_ROUNDS)) {
    assert.equal(result.blocked, true, `round ${result.round} must still be blocked (the writer never changes)`);
    assert.equal(result.evictedSections, 1, `round ${result.round} must evict the surplus chapter, saw ${result.evictedSections}`);
    assert.deepEqual(result.unconvergedPhrases, [], `round ${result.round} is within the bound`);
  }

  // At the bound the run fails CLOSED with an operator message that names the
  // phrase, the chapters, and the fact that re-drafting did not converge — and it
  // stops burning re-drafts rather than evicting forever.
  const bounded = results[ASSEMBLY_AVOID_MAX_ROUNDS];
  assert.ok(bounded, "a round past the bound must exist");
  assert.deepEqual(bounded.unconvergedPhrases, [LIVE_PHRASE]);
  assert.equal(bounded.evictedSections, 0, "past the bound nothing is evicted — the next run fails fast, not expensively");
  assert.match(bounded.detail, /ASSEMBLY_REDRAFT_UNCONVERGED/);
  assert.match(bounded.detail, /It does not matter how/);
  assert.match(bounded.detail, /ch11/);
  assert.match(bounded.detail, /ch01, ch08/);
  assert.match(bounded.detail, new RegExp(`${ASSEMBLY_AVOID_MAX_ROUNDS} evict\\+re-draft round`));

  // Stable and idempotent: every later round repeats the SAME closed failure.
  for (const result of results.slice(ASSEMBLY_AVOID_MAX_ROUNDS)) {
    assert.equal(result.evictedSections, 0);
    assert.deepEqual(result.unconvergedPhrases, [LIVE_PHRASE]);
    assert.equal(result.detail, bounded.detail, "the bounded operator message is deterministic");
  }
});

requiredTest("regen-livelock — a writer that honours the ESCALATED avoid-context converges, and the ban is not needed again", async (context) => {
  const base = compileCreditFixture(BOOK);
  // Honours the ban only once it is escalated (round 2 wording) — the shape the
  // fix exists for: round 1's polite line was not enough in the live run.
  const writer: Writer = (chapterNumber, taskCard) => {
    const phrase = taskCard.includes("ESCALATED") ? "A different opening clause entirely" : LIVE_PHRASE;
    return summaryWithPhrase(base.summary, chapterNumber, phrase);
  };
  const results = await driveRounds(context.roots.booksRoot, [1, 8, 11], writer, ASSEMBLY_AVOID_MAX_ROUNDS + 2);

  assert.equal(results[0].blocked, true);
  assert.equal(results[0].evictedSections, 1);
  assert.equal(results[1].blocked, true, "round 2 re-drafts ch11 under the round-1 ban and re-mints, so it blocks again");
  assert.equal(results[1].evictedSections, 1);
  // Round 3's re-draft sees the ESCALATED wording and changes the sentence.
  const converged = results[2];
  assert.ok(converged, "a third round must exist");
  assert.equal(converged.blocked, false, "the escalated ban converges before the bound");
  assert.equal(results.length, 3, "the driver stops at the first clean assembly");
});

requiredTest("regen-livelock — CONTROL: a collision fixed on the FIRST re-draft keeps today's behaviour (one eviction, no escalation, no bound message)", async (context) => {
  const base = compileCreditFixture(BOOK);
  // Honours the round-1 avoid-context immediately, as the stamped gates already do.
  const writer: Writer = (chapterNumber, taskCard) =>
    summaryWithPhrase(
      base.summary,
      chapterNumber,
      taskCard.includes("CROSS-CHAPTER ASSEMBLY CONFLICT") ? "A different opening clause entirely" : LIVE_PHRASE,
    );
  const results = await driveRounds(context.roots.booksRoot, [1, 8, 11], writer, 4);

  assert.equal(results.length, 2, "blocked once, then clean");
  assert.equal(results[0].blocked, true);
  assert.equal(results[0].evictedSections, 1);
  assert.deepEqual(results[0].unconvergedPhrases, []);
  assert.doesNotMatch(results[0].detail, /ASSEMBLY_REDRAFT_UNCONVERGED/);
  assert.equal(results[1].blocked, false);
});

// ---------------------------------------------------------------------------
// (escalation) The re-draft prompt escalates with the round count.
// ---------------------------------------------------------------------------

requiredTest("regen-livelock — the task card escalates on re-ban and stays byte-identical for a first-round ban", () => {
  const fixture = compileCreditFixture(BOOK);
  const common = {
    bookId: BOOK,
    kind: "summary-pack" as SectionKind,
    blueprint: fixture.blueprint,
    sourcePacket: fixture.packet,
    outputPath: "compiler/ch11/summary-pack.json",
    context: { voiceCard: null, bookScars: null },
    deliveryMode: "DIRECT_JSON" as const,
  };
  const avoid = {
    checkId: SEC83,
    phrase: LIVE_PHRASE,
    keptByChapters: [1, 8],
    message: `summary tier repeats the verbatim phrase "${LIVE_PHRASE}" already used by ch01, ch08 — rewrite this tier's connective prose.`,
  };

  // A first-round ban (no `rounds`, or rounds: 1) renders exactly as before.
  const roundOne = buildSectionTaskMarkdown({ ...common, assemblyAvoid: [avoid] });
  const explicitRoundOne = buildSectionTaskMarkdown({ ...common, assemblyAvoid: [{ ...avoid, rounds: 1 }] });
  assert.equal(explicitRoundOne, roundOne, "an explicit round 1 must not change the card");
  assert.doesNotMatch(roundOne, /ESCALATED/);

  // A re-ban escalates: the exact banned wording, the gate, the keeping chapters,
  // and how many re-drafts already failed.
  const roundTwo = buildSectionTaskMarkdown({ ...common, assemblyAvoid: [{ ...avoid, rounds: 2 }] });
  assert.match(roundTwo, /ESCALATED/);
  assert.match(roundTwo, new RegExp(LIVE_PHRASE));
  assert.match(roundTwo, /SEC83\.summary_cross_chapter_ngram/);
  assert.match(roundTwo, /ch01, ch08/);
  assert.ok(roundTwo.length > roundOne.length, "escalation adds instruction, never removes it");
});

// ---------------------------------------------------------------------------
// (never silent) An assembly block that evicts NOTHING must say so in the error.
// ---------------------------------------------------------------------------

requiredTest("regen-livelock — a block with zero evictions names itself in the operator message instead of repeating byte-identically", () => {
  const findings = ["ch01: [SEC77.some_unstamped_gate] two chapters share a shape"];
  const wedged = assemblyBlockDetail(findings, ["SEC77.some_unstamped_gate"], { evictedSections: 0, unconverged: [] });
  assert.match(wedged, /ASSEMBLY_BLOCK_NOT_EVICTABLE/);
  assert.match(wedged, /SEC77\.some_unstamped_gate/);
  assert.match(wedged, /reuse identical cached packs/);
  assert.match(wedged, /two chapters share a shape/, "the underlying findings still reach the operator");

  // A block that DID evict keeps today's message exactly.
  const evicting = assemblyBlockDetail(findings, ["SEC77.some_unstamped_gate"], { evictedSections: 1, unconverged: [] });
  assert.equal(evicting, findings.join("; "));

  // An exempt gate is a KNOWN non-evicting gate, so it is named as such rather
  // than reported as an unexplained wedge.
  const exempt = assemblyBlockDetail(
    ["ch01: [SEC95.summary_hook_first_word_clustering] hooks cluster"],
    ["SEC95.summary_hook_first_word_clustering"],
    { evictedSections: 0, unconverged: [] },
  );
  assert.match(exempt, /ASSEMBLY_BLOCK_NOT_EVICTABLE/);
  assert.match(exempt, /documented-exempt/);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
