/**
 * Shared fixtures for the model-bakeoff test files (not a .test.ts — never
 * auto-run). Everything writes ONLY under caller-supplied tmp roots.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import type { AutopilotDeps, VerbResult } from "../src/orchestrator/autopilot.js";
import type { CodexAgentResult, SpawnCodexAgentOptions } from "../src/orchestrator/codexAgent.js";
import type { ChapterV21 } from "../src/types.js";
import type { SourcePacketV1 } from "../src/artifacts/artifactTypes.js";
import type { BakeoffDeps } from "../src/bakeoff/runBakeoff.js";

export function tmpRoot(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function fixturePacket(bookId: string, n: number): SourcePacketV1 {
  return {
    schemaVersion: "source-packet-v1",
    bookId,
    chapterId: `${bookId}-ch${String(n).padStart(2, "0")}`,
    chapterNumber: n,
    chapterTitle: `Chapter ${n}`,
    sourceSidecarPath: null,
    sourceHash: null,
    facts: [{ id: `ch${String(n).padStart(2, "0")}-f1`, claim: "People remember what they retrieve." } as SourcePacketV1["facts"][number]],
    namedCases: [],
    frameworks: [],
    allowedAnchors: [],
    allowedNumbers: [],
    allowedEntities: [],
    allowedPlaces: [],
    forbiddenClaims: [],
    forbiddenLeakage: [],
    sourceQuality: { status: "adequate", risks: [] },
  } as SourcePacketV1;
}

export function fixtureChapter(bookId: string, n: number, seed = ""): ChapterV21 {
  const nn = String(n).padStart(2, "0");
  return {
    schemaVersion: "chapterflow-v21-authored",
    chapterId: `${bookId}-ch${nn}`,
    number: n,
    title: `Chapter ${n}${seed ? ` ${seed}` : ""}`,
    readingTimeMinutes: 7,
    hook: `A short hook about chapter ${n}. It costs someone something real.${seed}`,
    keyTakeaway: `The takeaway for chapter ${n}: retrieve, do not reread. It sticks when you pull it out yourself, on purpose, at spaced moments.`,
    tryThisNow: `Write one fact from memory, then check it against the page. Takes 60 seconds.${seed}`,
    breakdown: {
      fastRead: `A fast read for chapter ${n}. One idea per sentence. ${seed}`,
      deepRead: `A deep read for chapter ${n}. It adds mechanism and one more scene. ${seed}`,
      fullRead: `A full read for chapter ${n}. It adds limits and a third angle. ${seed}`,
    },
    examples: [],
    quiz: { passingScorePercent: 70, questions: [] },
    reviewCards: [],
    implementationPlan: {
      title: "Test the Recall",
      coreSkill: "Test the Recall. Pull the idea from memory before rereading it.",
      ifThenPlans: [],
      twentyFourHourChallenge: "Recall three ideas from today before bed.",
      weeklyPractice: "Do one blank-page recall of the week's reading.",
    },
  } as unknown as ChapterV21;
}

/** A fake writer spawn: parses the OUTPUT file from the author card and writes
 *  a fixture chapter there (what the real codex agent would do).
 *
 *  IMP-01: the card's OUTPUT path is now the candidate FILE NAME and the spawn
 *  cwd is the isolated attempt workspace — the fixture chapter lands there (the
 *  conductor imports/validates/commits it into the slot). `resolveAbs` remains
 *  as the pre-IMP-01 fallback for any caller without a cwd. The spawn opts are
 *  passed to `chapterFor` so callers can derive the slot from the session id. */
export function writerSpawn(
  record: SpawnCodexAgentOptions[],
  chapterFor: (relPath: string, task: string, opts: SpawnCodexAgentOptions) => string,
  resolveAbs: (relPath: string) => string,
): (opts: SpawnCodexAgentOptions) => Promise<CodexAgentResult> {
  return async (opts) => {
    record.push(opts);
    if (opts.task === "Reply with exactly: MODEL-OK") {
      return { ok: true, exitCode: 0, finalMessage: "MODEL-OK", stdout: "MODEL-OK", stderr: "", durationMs: 5, sessionId: opts.sessionId };
    }
    const m = opts.task.match(/Write EXACTLY one file: (\S+),/);
    if (m) {
      const abs = opts.cwd ? resolve(opts.cwd, m[1]) : resolveAbs(m[1]);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, chapterFor(m[1], opts.task, opts));
    }
    return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 10, sessionId: opts.sessionId };
  };
}

/** Minimal deps for bakeoff units/conductor: every verb succeeds; spawns are
 *  recorded; nothing touches real state. */
export function fakeBakeoffDeps(over?: Partial<BakeoffDeps>): {
  deps: Partial<BakeoffDeps>;
  verbs: string[][];
  spawns: SpawnCodexAgentOptions[];
  delegations: Array<{ args: string[]; env: Record<string, string> }>;
} {
  const verbs: string[][] = [];
  const spawns: SpawnCodexAgentOptions[] = [];
  const delegations: Array<{ args: string[]; env: Record<string, string> }> = [];
  let n = 0;
  const deps: Partial<BakeoffDeps> = {
    runVerb: async (args): Promise<VerbResult> => {
      verbs.push(args);
      return { code: 0, stdout: "", stderr: "" };
    },
    spawn: (async (opts: SpawnCodexAgentOptions): Promise<CodexAgentResult> => {
      spawns.push(opts);
      const ok = opts.task === "Reply with exactly: MODEL-OK";
      return { ok: true, exitCode: 0, finalMessage: ok ? "MODEL-OK" : "done", stdout: "", stderr: "", durationMs: 3, sessionId: opts.sessionId };
    }) as BakeoffDeps["spawn"],
    delegate: async (args, env) => {
      delegations.push({ args, env });
      return { code: 0, stdout: "outcome: READY — publishable, publication withheld", stderr: "" };
    },
    expectedChapterNumbers: () => [1],
    mkSessionId: (label: string) => `${label}#${++n}`,
    logSession: () => {},
    researchFreshness: () => null,
    readTask: () => "RESEARCH PROMPT",
    rng: () => 0.42,
    codexVersion: () => "codex-cli 9.9.9 (test)",
    log: () => {},
    acquireLock: () => ({ ok: true, release: () => {} }),
    ...over,
  };
  return { deps, verbs, spawns, delegations };
}

export type DepsBundle = ReturnType<typeof fakeBakeoffDeps>;

export function fakeAutopilotDeps(over?: Partial<AutopilotDeps>): Partial<AutopilotDeps> {
  let n = 0;
  return {
    runVerb: async () => ({ code: 0, stdout: "", stderr: "" }),
    mkSessionId: (label: string) => `${label}#${++n}`,
    logSession: () => {},
    expectedChapterNumbers: () => [1],
    log: () => {},
    ...over,
  };
}
