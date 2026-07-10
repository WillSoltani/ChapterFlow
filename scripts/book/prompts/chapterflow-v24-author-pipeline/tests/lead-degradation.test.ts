/**
 * F-1 — bounded lead-thread degradation (fresh-gold blocker, 2026-07-08).
 *
 * Live failure pinned here: high-output-management ch14 was dealt an uncarriable
 * concept-label lead ("Task-focused interview questions"; the packet's three cases
 * are ALL concept labels with no named actors). 5/6 writer drafts across three
 * conductor entries failed the lead-thread write contract; every re-entry re-dealt
 * the identical lead → an unbreakable honest-halt cycle.
 *
 * The fix: when EVERY configured attempt fails the write contract on lead-thread
 * findings ALONE, ONE bounded extra attempt runs with a deterministically degraded
 * lead (next token-bearing owned case → invented only if proxy-cast is not banned
 * → honest halt). The contract enforces the degraded lead at FULL strength; a
 * landed degraded lead persists as a recompile-stable sidecar so future
 * regens/repairs verify the chapter's ACTUAL lead. Not book- or chapter-specific.
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chapterFileName } from "../src/lib/chapterPaths.js";

import { test } from "./harness.js";
import {
  AUTHOR_WRITE_GATE_RETRIES,
  AUTHOR_WRITE_LEAD_DEGRADE_RETRIES,
  authorWriteOneChapter,
  type AuthorIo,
} from "../src/orchestrator/authorRun.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import {
  applyLeadThreadOverride,
  degradedLeadCandidates,
  type LeadThreadOverrideV1,
} from "../src/compiler/chapterBrief.js";
import { dealContentDeviceBans } from "../src/compiler/contentDeviceDeal.js";
import { CHAPTER_BRIEF_SCHEMA_VERSION, type ChapterBriefV1, type SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import type { ChapterV21 } from "../src/types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const GOLDEN_PACKET = JSON.parse(
  readFileSync(resolve(HERE, "fixtures", "fact-ranking-legacy-packet.json"), "utf8"),
) as SourcePacketV1;

// Concept-label leads modeled on the live ch14 packet: token-bearing (the contract
// CAN key on them) but with no named actors. NOT the live book's labels — the fix
// must not be book-specific, so the fixture uses its own.
const LEAD_A = "Task-shaped review meetings";
const LEAD_B = "Monitoring-report cadence";
const TOKEN_A = "Task-shaped";
const TOKEN_B = "Monitoring-report";

// A 16-chapter book has both proxy-banned and proxy-allowed chapters in its
// content-device deal — pick one of each so the tests exercise the real rotation
// instead of hardcoding chapter numbers.
const TOTAL = 16;
const CH_PROXY_BANNED = Array.from({ length: TOTAL }, (_, i) => i + 1)
  .find((n) => dealContentDeviceBans(n, TOTAL).includes("proxy-cast"))!;
const CH_PROXY_ALLOWED = Array.from({ length: TOTAL }, (_, i) => i + 1)
  .find((n) => !dealContentDeviceBans(n, TOTAL).includes("proxy-cast"))!;
assert.ok(CH_PROXY_BANNED && CH_PROXY_ALLOWED, "the 16-chapter deal has both banned and allowed chapters");

function mkBrief(n: number, over: Partial<ChapterBriefV1> = {}): ChapterBriefV1 {
  return {
    schemaVersion: CHAPTER_BRIEF_SCHEMA_VERSION,
    chapterId: `zz-lead-degrade-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    title: `Fixture Chapter ${n}`,
    coreMove: "Anchor one small action to one fixed cue and run it without negotiation.",
    thesis: "Focused repetition on a fixed cue improves skill within two weeks.",
    readerPromise: "After this chapter, a reader can anchor one small action to one fixed cue.",
    ownedCases: [
      { id: `ch${n}.case.1`, label: LEAD_A },
      { id: `ch${n}.case.2`, label: LEAD_B },
    ],
    notYours: [],
    cast: ["Willow"],
    answerIndexPattern: [0, 1, 2, 0, 1, 2, 0, 1, 2],
    avoid: [],
    lengthBudget: { renderedChars: 16000, tolerance: 0.2 },
    flavor: [],
    openerType: "question",
    challengeFrame: "before-your-next-X",
    practiceShape: "single-imperative",
    leadThread: { kind: "owned-case", name: LEAD_A },
    ...over,
  };
}

/** A chapter that clears every write-contract check EXCEPT (possibly) the lead
 *  thread: whichever token it carries decides D7. No invented timers (D9), no
 *  label-prefixed example fields (W1), no dealt exampleCount (B15 skipped). */
function mkDraft(n: number, carriedToken: string): ChapterV21 {
  return {
    schemaVersion: "chapterflow-v21-authored",
    chapterId: `zz-lead-degrade-ch${String(n).padStart(2, "0")}`,
    number: n,
    title: `Fixture Chapter ${n}`,
    hook: "A plain opening scene.",
    breakdown: {
      fastRead: `${carriedToken} work shows the move in one pass.`,
      deepRead: `${carriedToken} work shows the move in one pass, and the mechanism holds.`,
      fullRead: `${carriedToken} work shows the move in one pass, and the mechanism holds across a week.`,
    },
    examples: [
      { title: `${carriedToken} first pass`, scenario: `${carriedToken} in a weekly setting.`, whatToDo: "Run the smallest version once.", whyItMatters: "It proves the mechanism." },
      { title: `${carriedToken} second pass`, scenario: `${carriedToken} again the next week.`, whatToDo: "Repeat it on the same cue.", whyItMatters: "Repetition locks the cue." },
      { title: "A supporting scene", scenario: "A different setting entirely.", whatToDo: "Watch for the same cue.", whyItMatters: "Transfer is the point." },
    ],
    quiz: { questions: [] },
    reviewCards: [],
    implementationPlan: { title: "Plan", coreSkill: "Do the small thing.", ifThenPlans: [], twentyFourHourChallenge: "Run one pass before tomorrow.", weeklyPractice: "Repeat weekly." },
    memorableLines: [],
  } as unknown as ChapterV21;
}

type Rig = {
  deps: AutopilotDeps;
  spawns: Array<{ sessionId: string; task: string }>;
  logs: string[];
  io: Partial<AuthorIo>;
  files: Map<number, string>;
  overrides: LeadThreadOverrideV1[];
  removed: number[];
};

const RIG_TMP = mkdtempSync(join(tmpdir(), "lead-degradation-"));
let rigSeq = 0;

/** In-memory rig. IMP-01: the writer stub LANDS its draft as the CANDIDATE in
 *  the attempt WORKSPACE (the spawn's cwd) — exactly like the real session,
 *  which has no path to canonical at all. The old gate/rubric runVerb scripts
 *  are routed through the io candidate-validation seam UNCHANGED (same args
 *  shape, same call counter), so per-test scripts keep working verbatim.
 *  Contract runs REAL. */
function mkRig(opts: {
  n: number;
  brief: ChapterBriefV1;
  /** What the writer lands per attempt index (0-based); last entry repeats. */
  drafts: ChapterV21[];
  storedOverride?: LeadThreadOverrideV1 | null;
  runVerb?: (args: string[], call: number) => { code: number; stdout: string; stderr: string };
}): Rig {
  const spawns: Array<{ sessionId: string; task: string }> = [];
  const logs: string[] = [];
  const files = new Map<number, string>();
  const overrides: LeadThreadOverrideV1[] = [];
  const removed: number[] = [];
  let verbCalls = 0;
  let sid = 0;
  const deps = {
    runVerb: async (args: string[]) => opts.runVerb ? opts.runVerb(args, ++verbCalls) : { code: 0, stdout: "", stderr: "" },
    spawn: (async (o: { sessionId: string; task: string; cwd?: string }) => {
      spawns.push({ sessionId: o.sessionId, task: o.task });
      const draft = opts.drafts[Math.min(spawns.length - 1, opts.drafts.length - 1)];
      if (o.cwd) writeFileSync(join(o.cwd, chapterFileName(draft.chapterId)), JSON.stringify(draft));
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 1, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
    mkSessionId: (label: string) => `${label}#${++sid}`,
    expectedChapterNumbers: () => Array.from({ length: TOTAL }, (_, i) => i + 1),
    logSession: () => {},
    log: (m: string) => { logs.push(m); },
  } as unknown as AutopilotDeps;
  const io: Partial<AuthorIo> = {
    chapterExists: (_b, n) => files.has(n),
    readChapterFile: (_b, n) => files.get(n) ?? null,
    writeChapterFile: (_b, n, bytes) => { files.set(n, bytes); },
    removeChapterFile: (_b, n) => { removed.push(n); files.delete(n); },
    readBriefMd: () => "# brief\n\n## VARIETY\n(stripped when the machine brief is present)\n",
    readBrief: () => opts.brief,
    readPacket: () => GOLDEN_PACKET,
    loadChapters: () => [...files.values()].map((f) => JSON.parse(f) as ChapterV21),
    nameBankOk: () => true,
    voiceCard: () => null,
    authorSessionOf: () => undefined,
    recordProvenance: () => {},
    readLeadOverride: () => opts.storedOverride ?? null,
    writeLeadOverride: (_b, _n, o) => { overrides.push(o); },
    attemptsRoot: () => join(RIG_TMP, `attempts-${rigSeq++}`),
    gateCandidate: async (_c, _abs, attemptKey) =>
      opts.runVerb ? opts.runVerb(["gate-chapter", attemptKey], ++verbCalls) : { code: 0, stdout: "", stderr: "" },
    rubricWithCandidate: async (bookId) =>
      opts.runVerb ? opts.runVerb(["rubric-metrics", bookId], ++verbCalls) : { code: 0, stdout: "", stderr: "" },
  };
  return { deps, spawns, logs, io, files, overrides, removed };
}

const BASE_ATTEMPTS = 1 + AUTHOR_WRITE_GATE_RETRIES;

// ── unit: the pure candidate order ───────────────────────────────────────────

test("degradedLeadCandidates: next token-bearing owned case in packet order, minus failed", () => {
  const cases = [{ id: "1", label: LEAD_A }, { id: "2", label: LEAD_B }, { id: "3", label: "Cadence-audit walkthrough" }];
  const got = degradedLeadCandidates(cases, ["Willow"], false, [LEAD_A]);
  assert.deepEqual(got[0], { kind: "owned-case", name: LEAD_B }, "packet order, failed lead excluded");
  assert.deepEqual(got.map((c) => c.name), [LEAD_B, "Cadence-audit walkthrough", "Willow"], "cases first, invented last");
});

test("degradedLeadCandidates: all cases failed + proxy ALLOWED → invented cast[0]; proxy BANNED → empty (halt path)", () => {
  const cases = [{ id: "1", label: LEAD_A }];
  assert.deepEqual(degradedLeadCandidates(cases, ["Willow", "Preston"], false, [LEAD_A]), [{ kind: "invented", name: "Willow" }], "exactly one invented fallback (cast[0] semantics)");
  assert.deepEqual(degradedLeadCandidates(cases, ["Willow", "Preston"], true, [LEAD_A]), [], "proxy ban closes the invented door — honest halt");
});

test("degradedLeadCandidates: a token-less label is NEVER a candidate (the contract would pass it vacuously — gate-dodging)", () => {
  const cases = [{ id: "1", label: LEAD_A }, { id: "2", label: "the of and" }];
  assert.deepEqual(degradedLeadCandidates(cases, [], true, [LEAD_A]), [], "token-less case skipped even as the only fallback");
});

// ── unit: the override overlay ───────────────────────────────────────────────

test("applyLeadThreadOverride: applies while the brief still deals the failed lead; STALE (re-dealt) overrides are ignored; null-safe", () => {
  const brief = mkBrief(2);
  const override: LeadThreadOverrideV1 = {
    schemaVersion: "lead-thread-override-v1", bookId: "zz-lead-degrade", chapterNumber: 2,
    failedLead: LEAD_A, lead: { kind: "owned-case", name: LEAD_B }, cast: [],
    reason: "fixture", at: "2026-07-08T00:00:00.000Z",
  };
  const eff = applyLeadThreadOverride(brief, override);
  assert.equal(eff?.leadThread?.name, LEAD_B, "override applied");
  assert.deepEqual(eff?.cast, [], "override cast applied");
  const redealt = mkBrief(2, { leadThread: { kind: "owned-case", name: "A Fresh Redealt Lead" } });
  assert.equal(applyLeadThreadOverride(redealt, override), redealt, "stale override ignored — the re-deal supersedes it");
  assert.equal(applyLeadThreadOverride(null, override), null);
  assert.equal(applyLeadThreadOverride(brief, null), brief);
  assert.equal(applyLeadThreadOverride(brief, { ...override, lead: null }), brief, "pure failure MEMORY applies no overlay");
});

// ── integration: the degraded attempt ────────────────────────────────────────

test("F-1: lead-only contract failures on every attempt → ONE degraded attempt with the next case; contract enforces the NEW lead; override persisted", async () => {
  const n = CH_PROXY_ALLOWED;
  // The writer's drafts carry LEAD_B's token, never LEAD_A's: attempts 1..BASE fail
  // the contract on lead findings alone; the degraded attempt (same draft) passes
  // because the contract now verifies LEAD_B at full strength.
  const rig = mkRig({ n, brief: mkBrief(n), drafts: [mkDraft(n, TOKEN_B)] });
  const r = await authorWriteOneChapter("zz-lead-degrade", n, rig.deps, { io: rig.io, totalChapters: TOTAL });
  assert.ok(r.ok, `degradation converged: ${!r.ok ? r.reason : ""}`);
  assert.equal(rig.spawns.length, BASE_ATTEMPTS + 1, "exactly one extra spawn");
  assert.ok(rig.spawns[BASE_ATTEMPTS].sessionId.startsWith(`author-ch${String(n).padStart(2, "0")}-degraded`), "the extra attempt is labeled as the degraded one");
  const degradedCard = rig.spawns[BASE_ATTEMPTS].task;
  assert.ok(degradedCard.includes(`YOUR case "${LEAD_B}"`), "the degraded card's LEAD THREAD line deals the NEW lead");
  assert.ok(!degradedCard.includes(`YOUR case "${LEAD_A}"`), "the failed lead is gone from the degraded card");
  assert.ok(degradedCard.includes("LEAD CHANGE"), "the card says WHY the lead changed");
  assert.ok(rig.logs.some((l) => l.includes(`lead degraded: "${LEAD_A}" → "${LEAD_B}"`)), "loud degradation log");
  assert.equal(rig.overrides.length, 1, "override persisted on success");
  assert.equal(rig.overrides[0].failedLead, LEAD_A, "override keyed on the COMPILED brief's dealt lead (staleness guard)");
  assert.deepEqual(rig.overrides[0].lead, { kind: "owned-case", name: LEAD_B });
});

test("F-1: rubric failures do NOT trigger degradation (the writer, not the lead, is the problem)", async () => {
  const n = CH_PROXY_ALLOWED;
  const rig = mkRig({
    n,
    brief: mkBrief(n),
    drafts: [mkDraft(n, TOKEN_A)], // the lead is carried — rubric is the blocker
    runVerb: (args) => args[0] === "rubric-metrics"
      ? { code: 0, stdout: `ch${String(n).padStart(2, "0")}: FAIL ease=60`, stderr: "" }
      : { code: 0, stdout: "", stderr: "" },
  });
  const r = await authorWriteOneChapter("zz-lead-degrade", n, rig.deps, { io: rig.io, totalChapters: TOTAL });
  assert.ok(!r.ok, "fails closed");
  assert.equal(rig.spawns.length, BASE_ATTEMPTS, "NO degraded extra attempt");
  if (!r.ok) assert.match(r.reason, /rubric preflight FAIL/);
  assert.equal(rig.overrides.length, 0, "no override written");
});

test("F-1: MIXED failures (gate then lead-contract) do NOT trigger degradation", async () => {
  const n = CH_PROXY_ALLOWED;
  const rig = mkRig({
    n,
    brief: mkBrief(n),
    drafts: [mkDraft(n, TOKEN_B)], // would fail the lead contract when the gate passes
    runVerb: (args, call) => args[0] === "gate-chapter" && call === 1
      ? { code: 1, stdout: "[BLOCKER A12] lowercase boundary", stderr: "" }
      : { code: 0, stdout: "", stderr: "" },
  });
  const r = await authorWriteOneChapter("zz-lead-degrade", n, rig.deps, { io: rig.io, totalChapters: TOTAL });
  assert.ok(!r.ok, "fails closed");
  assert.equal(rig.spawns.length, BASE_ATTEMPTS, "a gate failure among the attempts closes the degradation door");
  assert.equal(rig.overrides.length, 0);
});

test("F-1: proxy-banned chapter whose ONLY owned case failed → honest halt naming the exhausted candidates; NO invented lead; orphan removed", async () => {
  const n = CH_PROXY_BANNED;
  const brief = mkBrief(n, { ownedCases: [{ id: "1", label: LEAD_A }], cast: ["Willow"] });
  const rig = mkRig({ n, brief, drafts: [mkDraft(n, "Zephyr")] }); // carries nothing dealt
  const r = await authorWriteOneChapter("zz-lead-degrade", n, rig.deps, { io: rig.io, totalChapters: TOTAL });
  assert.ok(!r.ok, "fails closed");
  assert.equal(rig.spawns.length, BASE_ATTEMPTS, "no degraded spawn — nothing carriable exists");
  if (!r.ok) {
    assert.match(r.reason, /NO degradation candidate remains/);
    assert.match(r.reason, /bans proxy-cast/);
    assert.match(r.reason, new RegExp(`"${LEAD_A}"`), "the exhausted lead is named");
  }
  assert.ok(!rig.spawns.some((s) => s.task.includes(`LEAD THREAD: Willow carries`)), "the banned invented lead was never dealt");
  // IMP-01: no orphan ever exists — the drafts lived and died in their attempt
  // workspaces; canonical was never written, so there is nothing to remove.
  assert.deepEqual(rig.removed, [], "nothing to remove — canonical untouched by construction");
  assert.equal(rig.files.has(n), false, "no failed draft ever reached the canonical store");
  assert.equal(rig.overrides.length, 0);
});

test("F-1: the degraded attempt ALSO failing → bounded halt naming BOTH leads; max spawns = 1 + gate retries + 1; orphan removed; failure MEMORY persisted", async () => {
  const n = CH_PROXY_ALLOWED;
  const rig = mkRig({ n, brief: mkBrief(n), drafts: [mkDraft(n, "Zephyr")] }); // carries neither lead
  const r = await authorWriteOneChapter("zz-lead-degrade", n, rig.deps, { io: rig.io, totalChapters: TOTAL });
  assert.ok(!r.ok, "fails closed");
  assert.equal(rig.spawns.length, 1 + AUTHOR_WRITE_GATE_RETRIES + AUTHOR_WRITE_LEAD_DEGRADE_RETRIES, "the hard spawn ceiling");
  if (!r.ok) {
    assert.match(r.reason, /lead degradation did not converge/);
    assert.match(r.reason, new RegExp(`"${LEAD_A}"`), "names the original lead");
    assert.match(r.reason, new RegExp(`"${LEAD_B}"`), "names the degraded lead");
  }
  // IMP-01: canonical untouched across the dealt AND degraded attempts alike.
  assert.deepEqual(rig.removed, [], "nothing to remove — canonical untouched by construction");
  assert.equal(rig.files.has(n), false, "no failed draft ever reached the canonical store");
  // Cross-entry convergence (live: the 2026-07-08 resume replayed the identical
  // dealt→degraded cycle): a FAILED degradation persists pure failure MEMORY —
  // no overlay (lead null), but every proven-uncarriable name recorded.
  assert.equal(rig.overrides.length, 1, "failure memory persisted");
  assert.equal(rig.overrides[0].lead, null, "no landed overlay");
  assert.deepEqual([...(rig.overrides[0].failedLeads ?? [])].sort(), [LEAD_B, LEAD_A].sort(), "BOTH proven-uncarriable leads recorded");
});

test("F-1: the NEXT entry advances PAST the persisted failure memory to the invented candidate (the cross-entry cycle terminates)", async () => {
  const n = CH_PROXY_ALLOWED;
  const memory: LeadThreadOverrideV1 = {
    schemaVersion: "lead-thread-override-v1", bookId: "zz-lead-degrade", chapterNumber: n,
    failedLead: LEAD_A, lead: null, cast: ["Willow"],
    failedLeads: [LEAD_A, LEAD_B],
    reason: "fixture: prior entry's failed degradation", at: "2026-07-08T00:00:00.000Z",
  };
  // The writer's drafts carry the invented "Willow" only: the dealt LEAD_A fails
  // 2×, degradation excludes {LEAD_A, LEAD_B} from memory → invented "Willow".
  const rig = mkRig({ n, brief: mkBrief(n), drafts: [mkDraft(n, "Willow")], storedOverride: memory });
  const r = await authorWriteOneChapter("zz-lead-degrade", n, rig.deps, { io: rig.io, totalChapters: TOTAL });
  assert.ok(r.ok, `advances to the invented lead and converges: ${!r.ok ? r.reason : ""}`);
  assert.equal(rig.spawns.length, BASE_ATTEMPTS + 1);
  assert.ok(rig.logs.some((l) => l.includes(`lead degraded: "${LEAD_A}" → "Willow"`)), "degraded PAST the remembered candidate to the invented one");
  assert.equal(rig.overrides.length, 1, "the landed override replaces the memory record");
  assert.deepEqual(rig.overrides[0].lead, { kind: "invented", name: "Willow" });
  assert.ok((rig.overrides[0].failedLeads ?? []).includes(LEAD_B), "history is carried forward");
});

test("F-1: a persisted override is honored on the next entry — the card deals the degraded lead directly, first attempt passes", async () => {
  const n = CH_PROXY_ALLOWED;
  const stored: LeadThreadOverrideV1 = {
    schemaVersion: "lead-thread-override-v1", bookId: "zz-lead-degrade", chapterNumber: n,
    failedLead: LEAD_A, lead: { kind: "owned-case", name: LEAD_B }, cast: ["Willow"],
    reason: "fixture: landed on a prior entry", at: "2026-07-08T00:00:00.000Z",
  };
  const rig = mkRig({ n, brief: mkBrief(n), drafts: [mkDraft(n, TOKEN_B)], storedOverride: stored });
  const r = await authorWriteOneChapter("zz-lead-degrade", n, rig.deps, { io: rig.io, totalChapters: TOTAL });
  assert.ok(r.ok, `override-resolved write passes first try: ${!r.ok ? r.reason : ""}`);
  assert.equal(rig.spawns.length, 1, "no wasted attempts on the proven-uncarriable lead");
  assert.ok(rig.spawns[0].task.includes(`YOUR case "${LEAD_B}"`), "the FIRST card already deals the degraded lead");
  assert.ok(rig.logs.some((l) => l.includes("persisted lead override active")), "override use is logged");
});

test("F-1: fresh-book determinism — same brief, same failures → same degradation choice", async () => {
  const n = CH_PROXY_ALLOWED;
  const run = async () => {
    const rig = mkRig({ n, brief: mkBrief(n), drafts: [mkDraft(n, TOKEN_B)] });
    const r = await authorWriteOneChapter("zz-lead-degrade", n, rig.deps, { io: rig.io, totalChapters: TOTAL });
    return { ok: r.ok, to: rig.overrides[0]?.lead?.name };
  };
  const a = await run();
  const b = await run();
  assert.deepEqual(a, b, "byte-equal decision across identical runs");
  assert.equal(a.to, LEAD_B);
});
