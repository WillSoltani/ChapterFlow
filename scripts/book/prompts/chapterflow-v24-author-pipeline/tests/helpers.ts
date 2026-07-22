/**
 * Shared fixtures and utilities for the pipeline test suite.
 *
 * FIXTURE POLICY: fixtures are SYNTHETIC. No copyrighted book text is
 * committed here. Corpus tests use deterministic generated chapters under
 * tests/.tmp/corpus so a clean checkout has the same coverage as an authoring
 * machine with private production state.
 */

import { execFileSync, spawnSync } from "child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "fs";
import { basename, dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { V21_SCHEMA_VERSION, type ChapterV21 } from "../src/types.js";
import {
  buildInitialResearchRunManifest,
  RESEARCH_RUN_CODE_VERSION,
  type ResearchRunOverallStatus,
} from "../src/lib/researchRunManifest.js";
import { sourceVerifyRecordPath } from "../src/critics/sourceVerify.js";
import { collectSourceVerifyItems } from "../src/qc/sourceRealityPolicy.js";
import { loadNameBank } from "../src/librarian/namePlan.js";
import { CHAPTERS_DIR } from "../src/lib/chapterPaths.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PIPELINE_DIR = resolve(__dirname, "..");
export const STATE_CHAPTERS = resolve(PIPELINE_DIR, "state", "chapters");
export const STATE_INDEXES = resolve(PIPELINE_DIR, "state", "indexes");
export const GATE_ATTEMPTS_FILE = resolve(PIPELINE_DIR, "state", "gate-attempts.json");
export const TMP_DIR = resolve(__dirname, ".tmp");

export type CorpusFixture = { bookId: string; files: string[]; stateDir: string };

// ── Deterministic varied vocabulary ─────────────────────────────────────────
// Each chapter draws from a disjoint word bank so similarity critics see
// genuinely different content unless a test plants a collision on purpose.

const BANKS: string[][] = [
  ["harbor", "lantern", "compass", "tide", "anchor", "mast", "ledger", "quay", "cargo", "beacon"],
  ["orchard", "trellis", "harvest", "cider", "graft", "bloom", "prairie", "furrow", "silo", "meadow"],
  ["circuit", "voltage", "resistor", "signal", "relay", "fuse", "dynamo", "cathode", "switch", "current"],
  ["glacier", "summit", "crampon", "ridge", "basecamp", "altitude", "crevasse", "icefall", "descent", "cairn"],
  ["sonata", "tempo", "cadence", "viola", "rehearsal", "podium", "overture", "encore", "score", "baton"],
  ["pottery", "kiln", "glaze", "wheel", "clay", "bisque", "studio", "trimming", "slip", "firing"],
  ["bakery", "proofing", "crumb", "starter", "oven", "scoring", "hydration", "loaf", "crust", "ferment"],
  ["archive", "microfilm", "catalog", "vault", "manuscript", "index", "provenance", "folio", "stacks", "binding"],
];

function bank(n: number): string[] {
  return BANKS[(n - 1) % BANKS.length];
}

// Structural variety: chapters use DIFFERENT sentence shapes, not one shape
// with nouns swapped — a shared skeleton with swapped nouns is precisely the
// templating defect AS5/AS7 are built to flag, so clean fixtures must not
// have it.

const QUIZ_PROMPT_SHAPES: Array<(a: string, b: string, c: string, d: string) => string> = [
  (a, b, c, d) => `What should a ${a} keeper do first when the ${b} record drifts past the ${c} line during a busy ${d} shift?`,
  (a, b, c, d) => `Midway through a ${d} review you discover the ${a} totals disagree with the ${b} notes — which response best protects the ${c}?`,
  (a, b, c, d) => `Your team inherited a backlog of unverified ${a} entries; the ${b} deadline is tomorrow. How should the ${c} owner sequence the ${d} work?`,
  (a, b, c, d) => `A colleague insists the ${a} step is optional because the ${b} rarely fails. What does the chapter's view of ${c} maintenance imply for the ${d} routine?`,
  (a, b, c, d) => `After two clean weeks, the ${a} check starts flagging the ${b} again. Which interpretation of the ${c} signal fits the ${d} pattern best?`,
  (a, b, c, d) => `If the ${a} budget only covers one inspection, where in the ${b}-to-${c} chain does the chapter argue the ${d} attention belongs?`,
  (a, b, c, d) => `The ${a} report looks perfect but the ${b} downstream keeps misfiring. What hidden ${c} problem should a careful ${d} reviewer suspect?`,
  (a, b, c, d) => `Why does fixing a ${a} mistake at the ${b} stage cost so much less than catching it after the ${c} ships to the ${d}?`,
];

const CHOICE_SHAPES: Array<Array<(a: string, b: string) => string>> = [
  [
    (a, b) => `Re-check the ${a} entry against the prior day before changing anything else.`,
    (a, b) => `Push the ${a} forward and plan to reconcile the records at the end of the week.`,
    (a, b) => `Ask whoever touched the ${a} last to confirm it from memory and move on.`,
  ],
  [
    (a, b) => `Stop new ${a} work until the earliest divergent ${b} record is found.`,
    (a, b) => `Average the two ${a} figures and note the discrepancy for the ${b} retro.`,
    (a, b) => `Trust the newer ${a} number since the ${b} system was recently patched.`,
  ],
  [
    (a, b) => `Verify a small sample of old ${a} entries first to size the ${b} problem.`,
    (a, b) => `Clear the newest ${a} items first because the ${b} deadline rewards visible progress.`,
    (a, b) => `Hand the whole ${a} backlog to the newest hire as ${b} training material.`,
  ],
  [
    (a, b) => `Treat the rare ${a} failure as exactly why the ${b} step exists, and keep it.`,
    (a, b) => `Drop the ${a} step for a month and watch whether the ${b} degrades.`,
    (a, b) => `Make the ${a} step optional for senior staff but required for ${b} juniors.`,
  ],
  [
    (a, b) => `Investigate what changed around the ${a} before trusting or silencing the ${b} alarm.`,
    (a, b) => `Re-calibrate the ${a} threshold upward so the ${b} noise stops.`,
    (a, b) => `Ignore the first week of ${a} flags as seasonal ${b} variation.`,
  ],
  [
    (a, b) => `Put the inspection where the ${a} is cheapest to fix and hardest to see: the ${b} handoff.`,
    (a, b) => `Spend it at the very end so the ${a} check covers the finished ${b}.`,
    (a, b) => `Rotate it randomly so every ${a} stage gets occasional ${b} coverage.`,
  ],
  [
    (a, b) => `Suspect the ${a} measurement itself — a perfect report over a failing ${b} usually means the gauge is broken.`,
    (a, b) => `Assume the ${a} downstream team is misusing an otherwise healthy ${b}.`,
    (a, b) => `Conclude the ${a} report needs more detail rather than different ${b} inputs.`,
  ],
  [
    (a, b) => `Because an early ${a} fix touches one record, while a late one means unwinding everything the bad ${b} fed.`,
    (a, b) => `Because ${a} reviewers get slower and more expensive near the ${b} deadline.`,
    (a, b) => `Because late ${a} fixes are usually assigned to whoever caused the ${b} issue.`,
  ],
];

const CARD_FRONT_SHAPES: Array<(a: string, b: string) => string> = [
  (a, b) => `What is the first move when the ${a} record drifts during a ${b} shift?`,
  (a, b) => `Name the check that protects the ${a} ledger before any new ${b} work starts.`,
  (a, b) => `Why does a slow ${a} audit beat a fast ${b} correction, in the chapter's terms?`,
  (a, b) => `Which daily habit keeps small ${a} drift from ever reaching the ${b} stage?`,
  (a, b) => `How do you isolate one bad ${a} entry without halting the whole ${b} line?`,
  (a, b) => `When is the right moment to reconcile the ${a} log against the ${b} notes?`,
  (a, b) => `What evidence tells you the ${a} routine is actually working in a normal ${b} week?`,
  (a, b) => `Where does the ${a} process usually break first when ${b} pressure rises?`,
];

const CARD_BACK_SHAPES: Array<(a: string, b: string) => string> = [
  (a, b) => `Re-check the ${a} entry against the prior day first, because the drift is cheapest to fix while it is still one record wide.`,
  (a, b) => `The opening comparison: yesterday's ${a} total against today's starting ${b} figure, done before any new entry is added.`,
  (a, b) => `A slow ${a} audit finds the cause; a fast ${b} correction only hides the symptom and guarantees a repeat.`,
  (a, b) => `Comparing the last ${a} entry with its source note at the start of every ${b} session, without exception.`,
  (a, b) => `Freeze new entries, bisect the ${a} history to the earliest divergence, fix that one ${b} record, then resume.`,
  (a, b) => `At the boundary between sessions — close the ${a} log against the ${b} notes before context disappears overnight.`,
  (a, b) => `Three straight days where the ${a} totals match the ${b} sources on the first comparison, with no corrections needed.`,
  (a, b) => `At the handoff: whoever receives the ${a} work trusts the label instead of opening the ${b} record itself.`,
];

function sentence(words: string[], i: number, pad: number): string {
  const w = (k: number) => words[(i + k) % words.length];
  let s =
    `The ${w(0)} review showed that the ${w(1)} step matters more than the ` +
    `${w(2)} count, because a rushed ${w(3)} check hides what the ${w(4)} ` +
    `actually needs before the next ${w(5)} pass.`;
  while (s.length < pad) {
    s += ` Watching the ${w(6)} closely keeps the ${w(7)} honest and makes the ${w(8)} easier to repeat.`;
  }
  return s;
}

export type MakeChapterOpts = {
  /** "plain" → q01..q09 (positional convention AS5 can see);
   *  "scoped" → <bookId>-chNN-q01.. (the dominant on-disk convention AS5 is blind to). */
  questionIdStyle?: "plain" | "scoped";
  overrides?: Partial<ChapterV21>;
};

/** A structurally complete, internally varied ChapterV21. Not gate-clean —
 *  built for unit-testing specific critics, not for passing the full gate. */
export function makeChapter(bookId: string, n: number, opts: MakeChapterOpts = {}): ChapterV21 {
  const words = bank(n);
  const nn = String(n).padStart(2, "0");
  const chapterId = `${bookId}-ch${nn}`;
  const qid = (i: number) =>
    opts.questionIdStyle === "scoped" ? `${chapterId}-q${String(i + 1).padStart(2, "0")}` : `q${String(i + 1).padStart(2, "0")}`;

  const chapter: ChapterV21 = {
    schemaVersion: V21_SCHEMA_VERSION,
    chapterId,
    number: n,
    title: `The ${words[0]} principle`,
    readingTimeMinutes: 7,
    hook: `Nobody checks the ${words[1]} until the ${words[2]} is already gone.`,
    counterintuition: `The slow ${words[3]} pass beats the fast one precisely because it feels wasteful.`,
    tryThisNow: `Before your next ${words[4]} task, write down the one ${words[5]} you expect to fail and check it first.`,
    keyTakeaway: `When the ${words[0]} matters, inspect the ${words[1]} before the ${words[2]}, because the early check is the only cheap one you will ever get.`,
    breakdown: {
      fastRead: sentence(words, 0, 420),
      deepRead: sentence(words, 1, 1250) + " " + sentence(words, 2, 0),
      fullRead: sentence(words, 3, 2550) + " " + sentence(words, 4, 0) + " " + sentence(words, 5, 0),
    },
    examples: Array.from({ length: 6 }, (_, i) => ({
      exampleId: `ex${String(i + 1).padStart(2, "0")}`,
      title: `A ${words[i % 10]} decision under pressure`,
      tags: [`${words[(i + 1) % 10]}`, "practice"],
      planSpec: {
        domain: `${words[(i + 2) % 10]} operations`,
        audience: "an early-career practitioner",
        stakes: `losing the ${words[(i + 3) % 10]} window`,
        format: "vignette",
        requiredBeat: `the moment the ${words[(i + 4) % 10]} check gets skipped`,
      },
      scenario:
        sentence(words, i, 290).slice(0, 500) +
        ` The ${words[(i + 5) % 10]} log told a different story than the morning report.`,
      whatToDo: `Pause the ${words[(i + 1) % 10]} work, re-run the ${words[(i + 2) % 10]} check, and compare it with yesterday's note before continuing.`,
      whyItMatters: `Skipping the ${words[(i + 3) % 10]} comparison is how small ${words[(i + 4) % 10]} drift becomes an expensive rework cycle later.`,
    })),
    quiz: {
      passingScorePercent: 70,
      questions: Array.from({ length: 9 }, (_, i) => {
        const shapeIdx = (n - 1 + i) % QUIZ_PROMPT_SHAPES.length;
        const w = (k: number) => words[(i + k) % words.length];
        return {
          questionId: qid(i),
          prompt: QUIZ_PROMPT_SHAPES[shapeIdx](w(0), w(1), w(2), w(3)),
          choices: CHOICE_SHAPES[shapeIdx].map((mk, ci) => mk(w(4 + ci), w(7 + ci))),
          correctIndex: i % 3,
          explanation: `Checking the ${w(4)} entry first isolates the drift while it is still one record wide, which is the cheapest moment to fix it and the only moment the cause is still visible.`,
          bloomsLevel: "apply" as const,
          depthLevel: "standard" as const,
        };
      }),
    },
    reviewCards: Array.from({ length: 6 }, (_, i) => {
      const shapeIdx = (n - 1 + i) % CARD_FRONT_SHAPES.length;
      return {
        cardId: `card${String(i + 1).padStart(2, "0")}`,
        front: CARD_FRONT_SHAPES[shapeIdx](words[i % 10], words[(i + 1) % 10]),
        back: CARD_BACK_SHAPES[shapeIdx](words[(i + 2) % 10], words[(i + 3) % 10]),
        difficulty: (["easy", "medium", "hard"] as const)[i % 3],
      };
    }),
    implementationPlan: {
      title: `Catch ${words[0]} drift early`,
      coreSkill: `Noticing ${words[1]} drift while it is still one record wide. The skill is comparing today's ${words[2]} entry with yesterday's before starting new work, every time, without negotiating with yourself about it.`,
      ifThenPlans: [
        { context: `starting a ${words[3]} shift`, plan: `If I open the ${words[4]} log, then I compare the last entry with the prior day before adding a new one.` },
        { context: `finding a mismatch`, plan: `If the ${words[5]} totals disagree, then I stop new entries and trace the earliest divergent record.` },
      ],
      // Opener clauses rotate by chapter number: a fixed opener across a 2-chapter
      // fixture book trips CHB7's scaffold-family cap (ceil(N/3)=1 at N=2) now that
      // the reader budgets also run at doAuthorReview entry (live fix 2026-07-03).
      // The fixture must be family-clean by construction, like a real book.
      twentyFourHourChallenge: `${[
        "Once today, before starting a task,",
        `Before your next ${words[8]} handoff,`,
        `Right after the first ${words[3]} check,`,
        `During today's ${words[9]} window,`,
      ][(n - 1) % 4]} write down which ${words[6]} record you expect to be wrong and check that one first.`,
      weeklyPractice: `${[
        "Each week, pick one",
        "Every Friday, audit one",
        "Once a week, pull one",
        "At the week's close, open one",
      ][(n - 1) % 4]} ${words[7]} log and check three days of entries against their source notes.`,
    },
    memorableLines: [
      { text: `Nobody checks the ${words[1]} until the ${words[2]} is already gone.`, location: "hook", why: "It names the failure everyone recognizes after the fact." },
      { text: `The early check is the only cheap one you will ever get.`, location: "keyTakeaway", why: "It compresses the cost asymmetry into one sentence." },
      { text: `Small ${words[4]} drift becomes expensive rework later.`, location: "example[0].whyItMatters", why: "It links the tiny cause to the big effect." },
    ],
  };

  return { ...chapter, ...(opts.overrides ?? {}) };
}

/** Deep-remove every occurrence of a key (test-local reimplementation so the
 *  test exercises the INVARIANT, not the production helper). */
export function deepStrip<T>(value: T, key: string): T {
  if (Array.isArray(value)) return value.map((v) => deepStrip(v, key)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === key) continue;
      out[k] = deepStrip(v, key);
    }
    return out as T;
  }
  return value;
}

/** Write a synthetic book's chapters as sibling files the CLI gate can load. */
export function writeFixtureBook(dir: string, chapters: ChapterV21[]): string[] {
  mkdirSync(dir, { recursive: true });
  return chapters.map((ch) => {
    const p = resolve(dir, `${ch.chapterId}.v21-native.chapter.json`);
    writeFileSync(p, JSON.stringify(ch, null, 2), "utf8");
    return p;
  });
}

export function cleanTmp(): void {
  rmSync(TMP_DIR, { recursive: true, force: true });
}

/** Run a pipeline CLI command; returns status + combined output. */
export function runCli(args: string[], env: Record<string, string | undefined> = {}): { status: number; out: string } {
  const childEnv: Record<string, string | undefined> = { ...process.env, ...env };
  for (const [key, value] of Object.entries(childEnv)) {
    if (value === undefined) delete childEnv[key];
  }
  const r = spawnSync("npx", ["tsx", "src/cli.ts", ...args], {
    cwd: PIPELINE_DIR,
    env: childEnv as NodeJS.ProcessEnv,
    encoding: "utf8",
    timeout: 180_000,
  });
  return { status: r.status ?? -1, out: `${r.stdout ?? ""}\n${r.stderr ?? ""}` };
}

/** Snapshot/restore the gate-attempts state so CLI tests don't pollute the
 *  circuit-breaker history (and repeated test runs don't trip it). */
export type GateAttemptsSnapshot =
  | { exists: false }
  | { exists: true; bytes: Buffer; atime: Date; mtime: Date };

export function snapshotGateAttempts(): GateAttemptsSnapshot {
  if (!existsSync(GATE_ATTEMPTS_FILE)) return { exists: false };
  const stat = statSync(GATE_ATTEMPTS_FILE);
  return {
    exists: true,
    bytes: readFileSync(GATE_ATTEMPTS_FILE),
    atime: stat.atime,
    mtime: stat.mtime,
  };
}

export function restoreGateAttempts(snapshot: GateAttemptsSnapshot): void {
  if (!snapshot.exists) {
    rmSync(GATE_ATTEMPTS_FILE, { force: true });
  } else {
    writeFileSync(GATE_ATTEMPTS_FILE, snapshot.bytes);
    utimesSync(GATE_ATTEMPTS_FILE, snapshot.atime, snapshot.mtime);
  }
}

export function goldChapterFiles(): CorpusFixture[] {
  return [
    syntheticCorpus("zz-gold-daring-greatly", 1),
    syntheticCorpus("zz-gold-start-with-why", 1),
  ];
}

/** The research run lives at the REPO ROOT, `.chapterflow/runs/<bookId>/` (anchored
 *  exactly like src/critics/sourceGrounding.ts's REPO). It is GENERATED, not committed,
 *  so it is absent in CI and most checkouts even when the committed gold chapter files
 *  ARE present. */
export const RUNS_DIR = resolve(PIPELINE_DIR, ".chapterflow/runs");

export function writeResearchRunManifestFixture(args: {
  runDir: string;
  bookId: string;
  chapters: Array<{ number: number; title: string }>;
  createdAt?: string;
  status?: ResearchRunOverallStatus;
}): void {
  const createdAt = args.createdAt ?? "2026-06-23T00:00:00.000Z";
  const runId = basename(args.runDir);
  const manifest = buildInitialResearchRunManifest({
    runId,
    bookId: args.bookId,
    createdAt,
    input: {
      title: args.bookId,
      author: "Fixture Author",
      bookIdHint: args.bookId,
      hash: `fixture-input-${args.bookId}`,
    },
    bibliographyHash: `fixture-bibliography-${args.bookId}`,
    bibliographyPath: "source-freeze/toc.json",
    expectedChapters: args.chapters,
    compatibility: {
      codeVersion: RESEARCH_RUN_CODE_VERSION,
      promptHash: "fixture-prompt",
      configHash: "fixture-config",
      provider: "fixture",
      model: "fixture-model",
    },
  });
  manifest.overallStatus = args.status ?? "complete";
  mkdirSync(args.runDir, { recursive: true });
  writeFileSync(resolve(args.runDir, "research-run.manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

export function writeCanonicalIndexFixture(
  bookId: string,
  chapters: Array<{ chapterId: string; number: number; title: string }>,
  indexDir = STATE_INDEXES,
): void {
  mkdirSync(indexDir, { recursive: true });
  writeFileSync(resolve(indexDir, `${bookId}.json`), `${JSON.stringify(chapters.map((chapter) => ({
    chapterId: chapter.chapterId,
    chapterNumber: chapter.number,
    chapterTitle: chapter.title,
  })), null, 2)}\n`, "utf8");
}

export function writeSourceEvidenceFixture(
  bookId: string,
  chapters: Array<{ number: number; title: string }>,
  runId = "20260623T000000Z-fixture",
  runsDir = RUNS_DIR,
): string {
  const runDir = resolve(runsDir, bookId, runId);
  writeResearchRunManifestFixture({ runDir, bookId, chapters });
  const sidecarDir = resolve(runDir, "sidecars/source");
  mkdirSync(sidecarDir, { recursive: true });
  for (const chapter of chapters) {
    const nn = String(chapter.number).padStart(2, "0");
    writeFileSync(
      resolve(sidecarDir, `ch${nn}.source.json`),
      `${JSON.stringify(makeSourceV2SidecarFixture({ chapterNumber: chapter.number, chapterTitle: chapter.title }), null, 2)}\n`,
      "utf8",
    );
  }
  return runDir;
}

/**
 * Write a genuinely VERIFIED source-verify record covering every verifiable item the book's
 * source-v2 sidecars expose, with DISTINCT per-item sources + notes (so it is not a rubber-stamp).
 * This is the required-and-verified path of the always-on source-reality production invariant: a
 * source-v2 book promotes/publishes only with a real record (or a content-bound legacy exemption).
 * Returns the canonical record path it wrote (clean it up in the test's finally).
 */
export function writeVerifiedSourceVerifyRecord(bookId: string): string {
  const items = collectSourceVerifyItems(bookId);
  const byChapter = new Map<number, Array<{ id: string; kind: string; verdict: string; sourceRef: string; note: string }>>();
  for (const it of items) {
    const arr = byChapter.get(it.chapterNumber) ?? [];
    arr.push({ id: it.id, kind: it.kind, verdict: "VERIFIED", sourceRef: `https://example.com/${bookId}/${it.id}`, note: `verified ${it.id} against its cited source` });
    byChapter.set(it.chapterNumber, arr);
  }
  const record = {
    schemaVersion: "source-verify-record-v1",
    bookId,
    chapters: [...byChapter.keys()].sort((a, b) => a - b).map((chapterNumber) => ({ chapterNumber, items: byChapter.get(chapterNumber)! })),
  };
  const recordPath = sourceVerifyRecordPath(bookId);
  mkdirSync(dirname(recordPath), { recursive: true });
  writeFileSync(recordPath, "```json\n" + JSON.stringify(record, null, 2) + "\n```\n", "utf8");
  return recordPath;
}

export function makeSourceV2SidecarFixture(args: {
  chapterNumber: number;
  chapterTitle: string;
}): any {
  const chapterNumber = args.chapterNumber;
  const nn = String(chapterNumber).padStart(2, "0");
  const suffix = `ch${nn}`;
  const factClaims = [
    `Northstar Lab cut ${suffix} ticket reopenings from 37 to 12 after adding a May 2026 intake checkpoint.`,
    `Harbor Clinic found 18 missing ${suffix} consent forms before its Friday discharge review.`,
    `Atlas Foods delayed a June 2026 ${suffix} launch by 9 days after a cold-chain sensor failed.`,
    `Mira Shah's ${suffix} onboarding team reduced handoff errors by 41 percent after naming one owner.`,
    `The Cedar ${suffix} pilot caught 6 duplicate invoices before the quarterly close on March 31.`,
    `Riverton Library moved ${suffix} archive requests from 5 inboxes into one Tuesday queue.`,
    `Apex Transit's ${suffix} depot trial found that 14 late buses shared the same fueling bottleneck.`,
    `The 2026 Mesa ${suffix} study separated habit reminders from reward messages across 220 participants.`,
    `Beacon Works kept a 24-hour ${suffix} repair log so overnight defects kept their original context.`,
  ];
  const mechanisms = [
    `Because the ${suffix} support checkpoint captures the first failed ticket before reassignment, the team can correct the original record instead of reconstructing it later.`,
    `Because the ${suffix} clinic review happens before discharge paperwork leaves the floor, missing consent forms can be fixed while staff still remember the visit.`,
    `Because the ${suffix} launch delay keeps sensor evidence attached to the cold-chain batch, Atlas Foods can isolate the failed device before product ships.`,
    `Because Mira Shah names one ${suffix} onboarding owner before the handoff, new hires know which record is authoritative when instructions conflict.`,
    `Because the Cedar ${suffix} invoice check runs before quarterly close, duplicate bills are removed while the vendor context is still visible.`,
    `Because Riverton Library uses one ${suffix} Tuesday queue, archive requests stop splitting across inboxes that no one can audit together.`,
    `Because Apex Transit compares late buses by ${suffix} depot routine, the fueling bottleneck becomes visible instead of looking like separate driver delays.`,
    `Because the Mesa ${suffix} study separates reminder and reward messages, the habit result can be traced to the correct intervention.`,
    `Because Beacon Works logs ${suffix} repairs within 24 hours, overnight defects keep enough context for the morning team to act.`,
  ];
  const errors = [
    `Treat the ${suffix} reopened tickets as a coaching issue after reassignment.`,
    `Assume the ${suffix} discharge review will catch missing consent forms later.`,
    `Ship the ${suffix} product on schedule and inspect the cold-chain sensor after launch.`,
    `Let every ${suffix} onboarding helper keep a private version of the handoff.`,
    `Wait until the ${suffix} quarterly close to search for duplicate invoices.`,
    `Keep ${suffix} archive requests in whichever inbox first received the question.`,
    `Treat each ${suffix} late bus as an isolated driver problem.`,
    `Blend ${suffix} reminders and rewards because both are habit supports.`,
    `Let the ${suffix} morning team infer what happened without a repair log.`,
  ];

  return {
    schemaVersion: "source-v2",
    chapterNumber,
    chapterTitle: args.chapterTitle,
    centralConcept: {
      id: `ch${nn}.concept.intake-checkpoint`,
      name: `${args.chapterTitle} intake checkpoint`,
      plainDefinition: `A ${suffix} checkpoint is the first verifiable moment where the operator can catch drift before it spreads.`,
      whyItMatters: `It gives ${args.chapterTitle} a concrete decision point instead of a generic call to be careful.`,
    },
    keyClaims: [
      `${args.chapterTitle} uses early checkpoints to preserve context.`,
      `${args.chapterTitle} names accountable owners before handoffs split.`,
      `${args.chapterTitle} treats visible logs as cheaper than late reconstruction.`,
    ],
    namedExamples: [
      {
        id: `ch${nn}.ex.northstar-lab`,
        label: `${suffix} Northstar Lab ticket audit`,
        summary: `Northstar Lab used a May 2026 ${suffix} intake checkpoint to cut reopened support tickets from 37 to 12.`,
        teachesWhat: "Specific intake checks keep defects from traveling downstream.",
        hardSpecifics: ["Northstar Lab", "May 2026", "37 to 12"],
        realWorld: false,
      },
      {
        id: `ch${nn}.ex.harbor-clinic`,
        label: `${suffix} Harbor Clinic consent review`,
        summary: `Harbor Clinic found 18 missing ${suffix} consent forms before its Friday discharge review.`,
        teachesWhat: "A visible checkpoint protects the next team from inherited ambiguity.",
        hardSpecifics: ["Harbor Clinic", "18 forms", "Friday discharge"],
        realWorld: false,
      },
      {
        id: `ch${nn}.ex.atlas-foods`,
        label: `${suffix} Atlas Foods cold-chain delay`,
        summary: `Atlas Foods delayed a June 2026 ${suffix} launch by 9 days after a cold-chain sensor failed.`,
        teachesWhat: "A single failed signal can be cheap if it is caught before launch.",
        hardSpecifics: ["Atlas Foods", "June 2026", "9 days"],
        realWorld: false,
      },
    ],
    hardEdge: `The wrong lesson in ${args.chapterTitle} is to add paperwork everywhere; the useful lesson is to put the check where evidence is still local and cheap to verify.`,
    paraphraseNotes: `${args.chapterTitle} uses Northstar Lab, Harbor Clinic, and Atlas Foods as synthetic source data, not provider instructions.`,
    testableFacts: factClaims.map((claim, i) => ({
      id: `ch${nn}.fact.${i + 1}`,
      claim,
      becauseMechanism: mechanisms[i],
      commonError: errors[i],
      errorIsWhy: `That misses the ${suffix} timing advantage in fact ${i + 1}: the check matters because the relevant context is still available.`,
      derivedFrom: i < 3 ? [`ch${nn}.ex.northstar-lab`, `ch${nn}.ex.harbor-clinic`, `ch${nn}.ex.atlas-foods`][i] : `ch${nn}.concept.intake-checkpoint`,
    })),
  };
}

/** True iff a gold book's research run exists on disk. The committed chapter files are
 *  NOT sufficient for `book-gate`: it auto-derives brief/plan artifacts from the research
 *  run and aborts ("No research run … derive-artifacts failed") without it. Book-LEVEL
 *  gold tests must gate on THIS (not just chapter-file presence), so they skip cleanly
 *  where the run is absent instead of failing a required CI job on a missing dependency. */
export function goldBookHasResearchRun(bookId: string): boolean {
  const dir = resolve(RUNS_DIR, bookId);
  try { return existsSync(dir) && readdirSync(dir).length > 0; } catch { return false; }
}

/** Shipped books used to calibrate the NEW book-gate cross-chapter detectors
 *  (BP28 callback-frame, BP29 timing-stamp) to ZERO. These are kept SEPARATE
 *  from goldChapterFiles() — they are not pinned ship-gate-clean against the
 *  current per-chapter gate, but they must stay clean of the new detectors.
 *  (daring-greatly + start-with-why are already covered via the gold book-gate
 *  major-pin in book-repetition.test.ts.) */
export function cleanCorpusChapterFiles(): CorpusFixture[] {
  return [
    syntheticCorpus("zz-clean-stillness", 8),
    syntheticCorpus("zz-clean-year-less", 8),
    syntheticCorpus("zz-clean-gifts", 8),
  ];
}

/** Verified-clean corpus for the BP31 quiz-choice-label detector. DELIBERATELY
 *  EXCLUDES stillness-is-the-key and pmbok-guide: "clean" is per-family —
 *  stillness is clean for BP28/29/30 (cleanCorpusChapterFiles above) but is a
 *  DEFECT book for uniform Title-Case quiz labels (78 of 288 questions), so it
 *  cannot anchor the label detector's zero-on-clean pin. These ten books were
 *  measured at ZERO all-Title-Case-labelled questions on disk; the defect book
 *  (the-daily-stoic) fires on 54/108. */
export function labelCleanCorpusChapterFiles(): CorpusFixture[] {
  return [
    syntheticCorpus("zz-label-clean-year-less", 8),
    syntheticCorpus("zz-label-clean-gifts", 8),
    syntheticCorpus("zz-label-clean-drive", 8),
    syntheticCorpus("zz-label-clean-range", 8),
  ];
}

function syntheticCorpus(bookId: string, count: number): CorpusFixture {
  const chapters = Array.from({ length: count }, (_, i) => makeGateCleanChapter(bookId, i + 1));
  const files = syntheticCorpusFiles(bookId, chapters);
  const stateDir = syntheticCorpusState(bookId, chapters);
  return { bookId, files, stateDir };
}

function syntheticCorpusFiles(bookId: string, chapters: ChapterV21[]): string[] {
  const dir = resolve(TMP_DIR, "corpus", bookId);
  mkdirSync(dir, { recursive: true });
  return chapters.map((chapter) => {
    const path = resolve(dir, `${chapter.chapterId}.v21-native.chapter.json`);
    const bytes = `${JSON.stringify(chapter, null, 2)}\n`;
    if (!existsSync(path) || readFileSync(path, "utf8") !== bytes) {
      writeFileSync(path, bytes, "utf8");
    }
    return path;
  });
}

function syntheticCorpusState(bookId: string, chapters: ChapterV21[]): string {
  const stateDir = resolve(TMP_DIR, "corpus-state", bookId);
  const briefDir = resolve(stateDir, "briefs");
  const plansDir = resolve(stateDir, "plans");
  mkdirSync(briefDir, { recursive: true });
  mkdirSync(plansDir, { recursive: true });
  writeFileSync(resolve(briefDir, `${bookId}.manual-brief.json`), `${JSON.stringify({
    schemaVersion: "manual-book-brief-v1",
    bookId,
    title: `Synthetic ${bookId}`,
    audience: "pipeline regression tests",
    corePromise: "Verify decisions against visible source notes before handoff.",
  }, null, 2)}\n`, "utf8");
  for (const chapter of chapters) {
    writeFileSync(resolve(plansDir, `${chapter.chapterId}.manual-plan.json`), `${JSON.stringify({
      schemaVersion: "manual-chapter-plan-v1",
      bookId,
      chapterId: chapter.chapterId,
      chapterNumber: chapter.number,
      title: chapter.title,
      coreMove: `Compare the active ${chapter.title.toLowerCase()} record with its source note before the next handoff.`,
    }, null, 2)}\n`, "utf8");
  }
  return stateDir;
}

function phraseBank(bookId: string, n: number): string[] {
  const base = bank(n);
  const slug = bookId.replace(/^zz-(gold|clean|label)-/, "").replace(/[^a-z0-9]+/g, " ");
  return [
    ...base,
    ...slug.split(/\s+/).filter(Boolean),
    `unit${n}`,
    `marker${n}`,
    `signal${n}`,
    `handoff${n}`,
    `checkpoint${n}`,
    `review${n}`,
  ];
}

function titleCaseWord(value: string): string {
  return value.slice(0, 1).toUpperCase() + value.slice(1).replace(/\d+$/, "");
}

function proseBlock(words: string[], n: number, tier: "fast" | "deep" | "full", lines: string[]): string {
  if (tier === "fast") {
    return [
      lines[0],
      `The useful response is modest: stop the next handoff, identify the trusted ${words[2]} note, and let the person closest to the work compare the two versions.`,
      `That pause keeps the ${words[3]} issue small, because only one decision has leaned on the faulty entry.`,
      `The team does not need a meeting or a new policy; it needs one visible owner, one timestamp, and one repaired source.`,
      `Once the ${words[4]} queue restarts, the next person can see why the fix happened and which evidence now governs the work.`,
    ].join(" ");
  }
  if (tier === "deep") {
    return [
      lines[1],
      `The hidden advantage is timing: a mismatch found at the ${words[5]} boundary still has witnesses, context, and a narrow blast radius.`,
      `If the team waits until the ${words[6]} report travels downstream, every later reader must reconstruct the original choice from scraps.`,
      `A good checkpoint therefore feels slower only at the moment of use; across the whole workflow it removes argument, rework, and defensive storytelling.`,
      `The owner writes the corrected ${words[7]} trail in ordinary language so the repair is understandable without private memory.`,
      `That habit turns verification into shared infrastructure instead of personal heroics.`,
      `It also changes the emotional tone of the work. People stop treating a mismatch as an accusation and start treating it as a signal that arrived early enough to be useful.`,
      `The ${words[8]} owner can say what is known, what is still uncertain, and which choice is blocked until the evidence is checked.`,
      `That clarity protects trust because nobody has to guess whether speed, rank, or confidence won the argument.`,
      `By the time the ${words[9]} queue moves again, the fix has a reason attached to it and the next operator can repeat the same judgment.`,
    ].join(" ");
  }
  return [
    lines[2],
    `Picture the ${words[8]} handoff as a chain of small permissions. Each person trusts the prior entry enough to act, and that trust compounds quickly.`,
    `A single stale note can become a purchasing choice, a customer promise, or a training instruction if nobody checks it near the source.`,
    `The mature move is to make evidence visible before speed becomes tempting. The team names the owner, opens the original note, repairs the active trail, and records the reason in a place the next worker will actually read.`,
    `This is not bureaucracy. It is an agreement about where reality enters the workflow and who has authority to correct it.`,
    `When the next ${words[9]} signal arrives, the group has a repeatable pattern: stop, compare, assign, repair, then resume with the decision trail intact.`,
    `The same pattern scales beyond one desk. A finance team can use it before approving a vendor, a clinic can use it before discharge, and a product group can use it before a launch review.`,
    `The details differ, but the discipline stays stable: find the earliest live record, compare it with the closest source, and keep the correction visible.`,
    `Without that discipline, every later decision inherits a little fog. People may work hard, but their effort lands on a record nobody has re-opened.`,
    `With it, the ${words[0]} owner has a short script for pressure. I will not pass along a value I cannot connect to evidence.`,
    `That sentence is powerful because it does not require blame. It asks only for a pause long enough to protect everyone downstream.`,
    `A healthy workflow makes that pause normal. It gives the newest teammate permission to ask for the source and gives the busiest manager a reason to wait.`,
    `Over time, the visible trail becomes a shared memory that is better than any individual's recall.`,
    `People can see which facts changed, which assumptions survived, and which decision was reopened before it became expensive.`,
    `The cost is a few minutes at the point of uncertainty. The payoff is a team that can move quickly without pretending uncertainty has disappeared.`,
    `That is why the first comparison matters. It turns a private suspicion into public evidence while the repair is still small.`,
    `The next time pressure rises, nobody needs a heroic memory or a louder opinion. They need the same modest ritual, one source, one owner, one visible correction, and then a restart that everyone can trust.`,
  ].join(" ");
}

export function makeGateCleanChapter(bookId: string, n: number): ChapterV21 {
  const chapter = makeChapter(bookId, n);
  const words = phraseBank(bookId, n);
  const nn = String(n).padStart(2, "0");
  const chapterId = `${bookId}-ch${nn}`;
  const line1 = `When the ${words[0]} record drifts, the first honest move is to compare it with yesterday's ${words[1]} note.`;
  const line2 = `Early verification keeps the ${words[2]} problem small enough for one owner to repair.`;
  const line3 = `A visible owner turns scattered ${words[3]} signals into one decision trail.`;
  const hookShapes = [
    `At unit${n} opening, ${words[1]} evidence looks calm until Rina checks it against the signed note.`,
    `Quin expects a unit${n} ${words[2]} handoff, then sees the source value pointing somewhere else.`,
    `The unit${n} clue is small: one ${words[3]} timestamp sits outside the rest of the trail.`,
    `Before unit${n} shift warms up, Bria notices that the ${words[4]} summary and the original note disagree.`,
    `A quiet unit${n} ${words[5]} mismatch appears while the queue is still short enough to pause.`,
    `Soren catches unit${n} ${words[6]} drift because the source note is still open on the desk.`,
    `The unit${n} ${words[7]} problem starts as a single line that refuses to match yesterday's evidence.`,
    `Yara spots unit${n} ${words[8]} gap before anyone has built a second decision on top of it.`,
  ];

  chapter.title = `The ${words[0]} checkpoint`;
  chapter.hook = hookShapes[(n - 1) % hookShapes.length];
  chapter.counterintuition = [
    `The ${words[0]} unit${n} check looks slow until the source closes the dispute.`,
    `For ${words[0]}, unit${n} evidence beats confidence because repair is still local.`,
    `A unit${n} pause protects ${words[1]} speed by stopping the wrong value early.`,
    `The ${words[2]} unit${n} habit is faster than cleanup after the handoff spreads.`,
    `unit${n} restraint works because the original ${words[3]} context has not gone stale.`,
    `The surprising unit${n} shortcut is to inspect ${words[4]} before acting quickly.`,
    `A unit${n} source check saves time by keeping ${words[5]} disagreement narrow.`,
    `The ${words[6]} unit${n} delay is useful because it prevents a larger restart.`,
  ][(n - 1) % 8];
  chapter.tryThisNow = [
    `Before unit${n} intake starts, compare the ${words[4]} value with its signed note.`,
    `During unit${n} setup, ask which ${words[5]} record would hurt most if copied wrong.`,
    `At unit${n} handoff, pause until the ${words[6]} source and active trail agree.`,
    `For unit${n} review, write the ${words[7]} owner beside the evidence being trusted.`,
    `When unit${n} pressure rises, reopen the ${words[8]} note before adding a new entry.`,
    `In unit${n} cleanup, mark the ${words[9]} correction where the next worker will see it.`,
    `Before unit${n} approval, name the ${words[10]} fact that would change the decision.`,
    `At unit${n} close, record why the ${words[11]} mismatch was accepted or repaired.`,
  ][(n - 1) % 8];
  chapter.keyTakeaway = `Trust improves when the first decision is checked against visible evidence, not memory.`;
  chapter.breakdown = {
    fastRead: proseBlock(words, n, "fast", [line1, line2, line3]),
    deepRead: proseBlock(words, n, "deep", [line2, line3, line1]),
    fullRead: proseBlock(words, n, "full", [line3, line1, line2]),
  };
  chapter.examples = Array.from({ length: 6 }, (_, i) => {
    const a = words[(i * 2) % words.length];
    const b = words[(i * 2 + 1) % words.length];
    const c = words[(i * 2 + 2) % words.length];
    const d = words[(i * 2 + 3) % words.length];
    const place = ["intake desk", "billing queue", "release table", "training shift", "audit bench", "support lane"][i];
    const person = ["Rina", "Quin", "Bria", "Soren", "Ivo", "Yara"][i];
    const last = `${titleCaseWord(words[(n + i) % words.length])}${n}`;
    const scenarios = [
      `${person} ${last} opens the intake desk and spots a ${a} total that conflicts with the signed ${b} note. She pauses the next request, checks the timestamp, and finds the ${c} handoff that introduced the drift.`,
      `${person} ${last} reviews the billing queue after a client challenges a ${a} charge. He compares the invoice with the source note, marks the ${b} gap, and keeps the ${c} report from moving downstream.`,
      `At the release table, ${person} ${last} sees a ${a} label attached to the wrong batch. The team holds the shipment, traces the ${b} scan, and repairs the ${c} record before anyone reuses it.`,
      `${person} ${last} runs the training shift while a new teammate copies an old ${a} value. She asks for the source note, identifies the ${b} assumption, and turns the ${c} correction into a visible rule.`,
      `During the audit bench review, ${person} ${last} notices that a ${a} exception vanished from the summary. He reopens the source note, restores the ${b} context, and assigns the ${c} follow-up before close.`,
      `${person} ${last} watches the support lane when a ${a} ticket arrives with two histories. The group chooses the source note, links the ${b} evidence, and blocks the ${c} shortcut from becoming policy.`,
    ];
    return {
      exampleId: `ex${String(i + 1).padStart(2, "0")}`,
      title: `${titleCaseWord(place)} ${titleCaseWord(a)} check`,
      tags: [a, b],
      planSpec: {
        domain: `${place} operations`,
        audience: "a working team lead",
        stakes: `losing the ${c} trail`,
        format: (["vignette", "checklist", "dialogue", "case", "contrast", "walkthrough"] as const)[i],
        requiredBeat: `notice the ${d} mismatch before the handoff`,
      },
      scenario: scenarios[i],
      whatToDo: [
        `Hold the ${d} update, ask Rina for the signed note, and restart only after the intake desk has one trusted value.`,
        `Mark the ${d} discrepancy, let Quin compare invoice and source, and keep the billing queue idle until the reason is visible.`,
        `Stop the ${d} release, have Bria trace the scan, and attach the corrected batch note before the table opens again.`,
        `Pause the ${d} exercise, ask Soren to show the original value, and turn the correction into the next training prompt.`,
        `Reopen the ${d} summary, let Ivo restore the missing context, and assign the follow-up before the audit bench closes.`,
        `Separate the ${d} histories, have Yara link the evidence, and block the shortcut until support agrees on one source.`,
      ][i],
      whyItMatters: [
        `At intake, one wrong value can be repaired before another request depends on it.`,
        `In billing, a visible reason prevents the next reviewer from guessing why the amount changed.`,
        `At release, a held batch is cheaper than recalling work that already reached customers.`,
        `During training, the correction becomes a reusable habit instead of a private warning.`,
        `On the audit bench, restored context keeps a small exception from vanishing into the summary.`,
        `In support, linked evidence keeps two histories from becoming two competing policies.`,
      ][i],
    };
  });
  chapter.quiz = {
    passingScorePercent: 70,
    questions: Array.from({ length: 9 }, (_, i) => {
      const a = words[(i + 1) % words.length];
      const b = words[(i + 4) % words.length];
      const c = words[(i + 7) % words.length];
      const stems = [
        `A ${a} log stops matching the source note during intake. What should happen first?`,
        `The ${b} owner wants to keep moving after a mismatch. Which response protects the decision trail?`,
        `A downstream team questions the ${c} handoff. Which evidence should settle the issue?`,
        `The morning review finds one stale ${a} entry. How should the team avoid spreading it?`,
        `A teammate trusts memory over the ${b} source. What is the strongest reply?`,
        `The ${c} queue looks clean but the next handoff fails. Where should the audit start?`,
        `A manager can inspect only one ${a} step today. Which one gives the best leverage?`,
        `The ${b} check feels slow during a busy shift. Why keep it in place?`,
        `A fresh ${c} note contradicts yesterday's summary. What should the owner do?`,
      ];
      const correct = [
        `Pause intake and match the live ${a} entry against the signed note.`,
        `Hold the ${b} handoff until the owner verifies the original source.`,
        `Use the dated ${c} note, because it preserves the first decision.`,
        `Mark the stale ${a} entry and stop it from feeding the next queue.`,
        `Ask for the ${b} evidence instead of accepting anyone's memory.`,
        `Start with the last ${c} transfer that both teams touched.`,
        `Inspect the earliest ${a} step where a cheap repair is still possible.`,
        `Keep the ${b} check because skipped verification creates larger rework.`,
        `Update the ${c} summary only after the source note is reconciled.`,
      ];
      const wrongA = [
        `Let the intake line continue and revisit the ${a} concern at closing.`,
        `Move the ${b} record forward so the queue does not slow down.`,
        `Ask the downstream team to choose whichever ${c} version seems recent.`,
        `Hide the stale ${a} value in a comment and continue the batch.`,
        `Treat the ${b} memory as enough because the owner sounds confident.`,
        `Begin with the final ${c} report, since it is easiest to read.`,
        `Spend the inspection on a random ${a} step so coverage feels fair.`,
        `Drop the ${b} check during busy periods and restore it later.`,
        `Rewrite the ${c} summary from memory and file the note afterward.`,
      ];
      const wrongB = [
        `Blend the two ${a} numbers and publish the average for now.`,
        `Ask a new teammate to clean the ${b} discrepancy without context.`,
        `Delete the older ${c} note because disagreement is confusing.`,
        `Assume the next team can detect the ${a} problem if it matters.`,
        `Delay the ${b} review until enough mistakes prove the pattern.`,
        `Blame the receiving group for mishandling the ${c} packet.`,
        `Inspect the polished ${a} dashboard instead of the source moment.`,
        `Replace the ${b} check with a motivational reminder.`,
        `Keep both ${c} versions active until someone complains.`,
      ];
      const choices = [correct[i], wrongA[i], wrongB[i]];
      const slot = (i + n - 1) % 3;
      const orderedChoices = slot === 0 ? choices : slot === 1 ? [choices[1], choices[0], choices[2]] : [choices[1], choices[2], choices[0]];
      const explanationShapes = [
        `unit${n} intake pause catches ${a} drift while one note can still settle it.`,
        `A unit${n} verified ${b} handoff keeps the next team from inheriting a guess.`,
        `Dated unit${n} ${c} evidence beats memory because it preserves the original choice.`,
        `Stopping unit${n} stale ${a} entry prevents it from shaping another queue.`,
        `Visible unit${n} ${b} proof gives the team a reason instead of a recollection.`,
        `The unit${n} shared ${c} transfer is where responsibility can still be traced.`,
        `An early unit${n} ${a} inspection has the cheapest repair and the clearest context.`,
        `Keeping unit${n} ${b} check turns a small mismatch away from broad rework.`,
        `The unit${n} ${c} summary should follow the reconciled source rather than replace it.`,
        `Checking unit${n} ${a} now keeps the repair attached to the person who can explain it.`,
        `The unit${n} ${b} record becomes trustworthy only after the source conflict is named.`,
        `A live unit${n} ${c} note lets the owner fix the decision before it becomes policy.`,
      ];
      return {
        questionId: `${chapterId}-q${String(i + 1).padStart(2, "0")}`,
        prompt: stems[i],
        choices: orderedChoices,
        correctIndex: slot,
        explanation: explanationShapes[(i + n - 1) % explanationShapes.length],
        bloomsLevel: "apply",
        depthLevel: "standard",
      };
    }),
  };
  chapter.reviewCards = Array.from({ length: 6 }, (_, i) => ({
    cardId: `card${String(i + 1).padStart(2, "0")}`,
    front: `How does the ${words[i]} unit${n} ${words[i + 1]} check work?`,
    back: [
      `Compare the current record with the source note before any new work starts.`,
      `The person closest to the source note resolves it, because that context is still fresh.`,
      `Memory blurs under pressure, while the source note preserves the original decision.`,
      `Begin at the earliest entry that diverges from the trusted source.`,
      `It lets the next team see the reason for the choice instead of guessing.`,
      `Restart only after the mismatch is named, fixed, and assigned to an owner.`,
    ][i],
    difficulty: (["easy", "medium", "hard"] as const)[i % 3],
  }));
  chapter.implementationPlan = {
    title: `Protect the ${words[0]} handoff`,
    coreSkill: `Compare the active record with its source note before the next team depends on it.`,
    ifThenPlans: [
      { context: `starting ${words[1]} work`, plan: `If I open the record, then I check the source note before adding a new entry.` },
      { context: `finding a mismatch`, plan: `If two records disagree, then I stop the handoff and name the owner who can repair it.` },
    ],
    twentyFourHourChallenge: `Pick one live record today and compare it with the source note before using it.`,
    weeklyPractice: `Once this week, review three handoffs and write down where evidence became unclear.`,
  };
  chapter.memorableLines = [
    { text: line1, location: "fastRead", why: "It names the first observable move." },
    { text: line2, location: "deepRead", why: "It explains why early repair is cheaper." },
    { text: line3, location: "fullRead", why: "It ties ownership to evidence." },
  ];
  return chapter;
}

/** A planted-corpus handle: the on-disk chapter files this fixture created in the REAL
 *  state/chapters/ dir, plus a cleanup() that removes ONLY those files (never a file the
 *  fixture found already present). */
export type PlantedCorpus = { files: string[]; bankNames: string[]; cleanup: () => void };

/** Plant a synthetic multi-book corpus directly into the canonical state/chapters/ dir —
 *  the SAME directory the catalog-audit CLI (loadCatalog) and namePlan
 *  (bankNamesUsedByOtherBooks / usedNamesByChapter) read. The real gold corpus is not in
 *  git (fixture policy) and is purged from bare worktrees, which turned these two audits'
 *  "runs on the real corpus" assertions into env-dependent ENOENT/empty failures. Planting
 *  a deterministic synthetic corpus makes them HERMETIC: the same fixture on every checkout.
 *
 *  Each planted book gets `chaptersPerBook` chapters. Across the corpus we distribute
 *  `distinctBankNames` DISTINCT name-bank members into example scenarios (so
 *  bankNamesUsedByOtherBooks sees > that many), plus the "The point is" house tic and a
 *  must-decide deadline scenario in ch01 of the first book so the fingerprint meters read
 *  non-empty. Files are written create-only: if a target path already exists (a real corpus
 *  IS present) it is left untouched and NOT scheduled for cleanup. */
export function plantSyntheticChapterCorpus(opts: {
  books: string[];
  chaptersPerBook?: number;
  distinctBankNames?: number;
} = { books: ["zz-fixture-corpus-alpha", "zz-fixture-corpus-beta"] }): PlantedCorpus {
  const books = opts.books;
  const chaptersPerBook = opts.chaptersPerBook ?? 2;
  const want = opts.distinctBankNames ?? 140;
  const bank = loadNameBank();
  const names = bank.slice(0, Math.min(want, bank.length));
  mkdirSync(CHAPTERS_DIR, { recursive: true });

  const created: string[] = [];
  // Round-robin the distinct bank names across every (book, chapter, example) scenario so
  // the whole set appears somewhere in the corpus.
  let nameCursor = 0;
  const nextName = (): string => names.length ? names[(nameCursor++) % names.length] : "Alex";

  books.forEach((bookId, bookIdx) => {
    for (let n = 1; n <= chaptersPerBook; n++) {
      const chapter = makeChapter(bookId, n);
      // Inject two distinct bank names into each example scenario, preserving the rest of
      // the (gate-agnostic — these files are only READ by the audit/name loaders, never
      // gated) synthetic prose.
      chapter.examples = chapter.examples.map((ex, i) => {
        const a = nextName();
        const b = nextName();
        return {
          ...ex,
          scenario: `${a} reviews the intake queue with ${b} while the record drifts, and ${a} must decide before the next arrival reaches the desk today. ${ex.scenario}`,
        };
      });
      // Plant the house tic + a deadline scenario in the very first chapter so the
      // catalog-audit fingerprint lines ("the point is", deadline tic) read non-zero.
      if (bookIdx === 0 && n === 1) {
        chapter.breakdown.fastRead += " The point is simple. The point is repeated so the meter has something to read.";
      }
      const path = resolve(CHAPTERS_DIR, `${chapter.chapterId}.v21-native.chapter.json`);
      if (!existsSync(path)) {
        writeFileSync(path, `${JSON.stringify(chapter, null, 2)}\n`, "utf8");
        created.push(path);
      }
    }
  });

  return {
    files: created,
    bankNames: names,
    cleanup: () => {
      for (const p of created) rmSync(p, { force: true });
    },
  };
}
