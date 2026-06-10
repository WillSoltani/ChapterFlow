/**
 * Shared fixtures and utilities for the pipeline test suite.
 *
 * FIXTURE POLICY: fixtures are SYNTHETIC. No copyrighted book text is
 * committed here. Gold-corpus tests read real chapters from state/chapters/
 * at runtime and skip (loudly) when absent.
 */

import { execFileSync, spawnSync } from "child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import type { ChapterV21 } from "../src/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PIPELINE_DIR = resolve(__dirname, "..");
export const STATE_CHAPTERS = resolve(PIPELINE_DIR, "state", "chapters");
export const GATE_ATTEMPTS_FILE = resolve(PIPELINE_DIR, "state", "gate-attempts.json");
export const TMP_DIR = resolve(__dirname, ".tmp");

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
      twentyFourHourChallenge: `Once today, before starting a task, write down which ${words[6]} record you expect to be wrong and check that one first.`,
      weeklyPractice: `Each week, pick one ${words[7]} log and audit three days of entries against their source notes.`,
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
export function runCli(args: string[]): { status: number; out: string } {
  const r = spawnSync("npx", ["tsx", "src/cli.ts", ...args], {
    cwd: PIPELINE_DIR,
    encoding: "utf8",
    timeout: 180_000,
  });
  return { status: r.status ?? -1, out: `${r.stdout ?? ""}\n${r.stderr ?? ""}` };
}

/** Snapshot/restore the gate-attempts state so CLI tests don't pollute the
 *  circuit-breaker history (and repeated test runs don't trip it). */
export function snapshotGateAttempts(): string | null {
  return existsSync(GATE_ATTEMPTS_FILE) ? readFileSync(GATE_ATTEMPTS_FILE, "utf8") : null;
}

export function restoreGateAttempts(snapshot: string | null): void {
  if (snapshot === null) {
    rmSync(GATE_ATTEMPTS_FILE, { force: true });
  } else {
    writeFileSync(GATE_ATTEMPTS_FILE, snapshot, "utf8");
  }
}

export function goldChapterFiles(): { bookId: string; files: string[] }[] {
  const GOLD = [
    { bookId: "daring-greatly", count: 7 },
    { bookId: "start-with-why", count: 14 },
  ];
  return GOLD.map((g) => ({
    bookId: g.bookId,
    files: Array.from({ length: g.count }, (_, i) =>
      resolve(STATE_CHAPTERS, `${g.bookId}-ch${String(i + 1).padStart(2, "0")}.v21-native.chapter.json`),
    ).filter((p) => existsSync(p)),
  }));
}
