/**
 * Stage 0b — live E-audit calibration drill (owner-authorized 2026-07-17, ≤24
 * codex sessions; V25_OWNER_DECISIONS.md D-3 amendment; protocol
 * docs/v25/implementation/V25_CHAPTER_EXPERIMENT_PROTOCOL.md §4).
 *
 * Runs the ultra-acceptance probe once, then N anchor E-audits (dual-blind
 * raters + adjudicator, real Sol-ultra codex sessions via ultraSession) over
 * the two pre-registered anchor chapters:
 *   A_high = difficult-conversations, chapter ⌈12/2⌉ = 6
 *   A_mid  = multipliers,            chapter ⌈9/2⌉  = 5
 * (`prior`-profile books; deterministic ⌈n/2⌉ rule — protocol §4.2.)
 *
 * FAIL-CLOSED: refuses without --execute-live; halts on a rejected/invalid
 * probe; hard session cap (default 24) counted per real spawn; rater-model
 * uniformity enforced across the drill. Every attempt is preserved by the
 * runner (attempt-numbered dirs); this driver never deletes anything.
 *
 * After the audits it computes the drill gates (protocol §4.3):
 *   SD_retest (pooled per-anchor repeat SD) → W = max(2×SD, 2.0);
 *   2×SD > 4.0 → NOISE STOP; first-attempt validity ≥ 6/8 rater sessions.
 * The D7-lite drill (3 sessions, both bands) is a SEPARATE follow-up step and
 * is not run here.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { runChapterDiagnostic, type ChapterDiagnosticRunResult } from "../../src/evaluation/chapterDiagnosticRun.js";
import { runUltraAcceptanceProbe } from "../../src/exec/ultraSession.js";
import { resolveD7RaterRoute } from "../../src/orchestrator/modelPolicy.js";
import { PIPELINE_DIR } from "../../src/bakeoff/paths.js";

const REPO_ROOT = resolve(PIPELINE_DIR, "..", "..", "..", "..");
const SESSION_CAP = 24;
const SESSION_TIMEOUT_MS = 45 * 60 * 1000;
const PROBE_DIR = resolve(PIPELINE_DIR, "state", "model-bakeoffs", "_campaign", "ultra-acceptance");
const OUT_DIR = resolve(PIPELINE_DIR, "state", "model-bakeoffs", "_campaign", "stage0b");

type AnchorSpec = {
  key: "ah" | "am";
  packageFile: string;
  chapterIndex1: number; // 1-based ⌈n/2⌉ position in the package chapter array
  blockCode: string;
};

const ANCHORS: AnchorSpec[] = [
  { key: "ah", packageFile: "difficult-conversations.v21.json", chapterIndex1: 6, blockCode: "ah06" },
  { key: "am", packageFile: "multipliers.v21.json", chapterIndex1: 5, blockCode: "am05" },
];

function loadAnchorChapter(spec: AnchorSpec): { chapter: Record<string, unknown>; title: string; categories: string[]; tags: string[]; chapterCount: number } {
  const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, "book-packages", spec.packageFile), "utf8")) as {
    book?: { title?: string; categories?: string[]; tags?: string[] };
    title?: string;
    categories?: string[];
    chapters?: Array<Record<string, unknown>>;
    content?: { chapters?: Array<Record<string, unknown>> };
  };
  const chapters = pkg.chapters ?? pkg.content?.chapters ?? [];
  if (chapters.length === 0) throw new Error(`${spec.packageFile}: no chapters array`);
  const expected = Math.ceil(chapters.length / 2);
  if (expected !== spec.chapterIndex1) {
    throw new Error(
      `${spec.packageFile}: ⌈${chapters.length}/2⌉ = ${expected} but the registered anchor pick is ${spec.chapterIndex1} — refusing (protocol §4.2 is deterministic; fix the registration, not the pick)`,
    );
  }
  const chapter = chapters[spec.chapterIndex1 - 1];
  if (!chapter) throw new Error(`${spec.packageFile}: chapter position ${spec.chapterIndex1} missing`);
  const title = pkg.book?.title ?? pkg.title ?? spec.packageFile.replace(/\.v21\.json$/, "");
  return {
    chapter,
    title,
    categories: pkg.book?.categories ?? pkg.categories ?? [],
    tags: pkg.book?.tags ?? [],
  };
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const executeLive = argv.includes("--execute-live");
  const runHash = (argv.find((a) => a.startsWith("--run-hash=")) ?? "").split("=")[1] || "s0b1";
  const only = (argv.find((a) => a.startsWith("--only=")) ?? "").split("=")[1] || "";
  // audit cells: anchor × repeat (protocol §4.3: 2 repeats each)
  const cells = (only ? only.split(",") : ["ah:w1", "ah:w2", "am:w1", "am:w2"]).map((c) => {
    const [key, slot] = c.split(":");
    const spec = ANCHORS.find((a) => a.key === key);
    if (!spec || !slot) throw new Error(`bad --only cell ${JSON.stringify(c)} (want e.g. ah:w1)`);
    return { spec, slot };
  });

  console.log(`Stage 0b calibration drill — ${cells.length} E-audit(s), cap ${SESSION_CAP} sessions, route ${JSON.stringify(resolveD7RaterRoute())}`);
  if (!executeLive) {
    console.log("DRY (no --execute-live): would probe ultra acceptance, then run the cells above. No session spawned.");
    return 0;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  let sessionsSpent = 0;

  // 1. Ultra-acceptance probe (1 session; fail-closed).
  mkdirSync(PROBE_DIR, { recursive: true });
  const probe = await runUltraAcceptanceProbe({ route: resolveD7RaterRoute(), probeDir: PROBE_DIR });
  sessionsSpent += 1;
  console.log(`probe: accepted=${probe.accepted} detail=${probe.detail.slice(0, 200)}`);
  if (!probe.accepted) {
    console.error("ULTRA PROBE REJECTED — campaign fail-closed (protocol §3). No rating session spawned.");
    return 2;
  }

  // 2. Anchor E-audits.
  const results: Array<{ cell: string; res: ChapterDiagnosticRunResult }> = [];
  const raterModels = new Set<string>();
  const labels = ["A", "B", "C", "D", "E", "F"] as const;
  for (let i = 0; i < cells.length; i++) {
    const { spec, slot } = cells[i]!;
    const remaining = SESSION_CAP - sessionsSpent;
    if (remaining < 3) {
      console.error(`BUDGET HALT: ${sessionsSpent}/${SESSION_CAP} spent — a full 3-role audit no longer fits. Stopping before the offending spawn.`);
      break;
    }
    const anchor = loadAnchorChapter(spec);
    console.log(`\n[${spec.key}:${slot}] auditing ${anchor.title} chapter-pos ${spec.chapterIndex1} (sessions spent ${sessionsSpent}/${SESSION_CAP}) …`);
    const res = await runChapterDiagnostic({
      label: labels[i]!,
      runHash,
      blockCode: spec.blockCode,
      slot,
      runId: `stage0b-${runHash}-${spec.key}-${slot}`,
      chapter: anchor.chapter as never,
      book: { title: anchor.title, categories: anchor.categories, tags: anchor.tags },
      timeoutMs: SESSION_TIMEOUT_MS,
      repoRoot: REPO_ROOT,
    });
    const attempts =
      res.roles.primary.attempts.length + res.roles.verification.attempts.length + (res.roles.adjudicator?.attempts.length ?? 0);
    sessionsSpent += attempts;
    for (const role of [res.roles.primary, res.roles.verification, res.roles.adjudicator]) {
      if (role?.raterModel) raterModels.add(role.raterModel);
    }
    results.push({ cell: `${spec.key}:${slot}`, res });
    console.log(res.summaryLine);
    console.log(`  diagnostic=${res.diagnostic.chapterDiagnostic} confidence=${res.diagnostic.confidence} terminal=${res.diagnostic.terminalState} attempts=${attempts} raterModels=${[...raterModels].join(",")}`);
    if (raterModels.size > 1) {
      console.error("UNIFORMITY HALT: more than one resolved rater model in the drill — stratify + owner decision (protocol §10.2b).");
      break;
    }
  }

  // 3. Drill gates (over completed cells).
  const byAnchor = new Map<string, number[]>();
  let firstAttemptValid = 0;
  let raterSessions = 0;
  for (const { cell, res } of results) {
    const score = res.diagnostic.chapterDiagnostic;
    if (score !== null && res.diagnostic.terminalState === "judged") {
      const key = cell.split(":")[0]!;
      byAnchor.set(key, [...(byAnchor.get(key) ?? []), score]);
    }
    for (const role of [res.roles.primary, res.roles.verification]) {
      raterSessions += role.attempts.length > 0 ? 1 : 0;
      if (role.attempts[0]?.ok) firstAttemptValid += 1;
    }
  }
  const sds: number[] = [];
  for (const [, scores] of byAnchor) {
    if (scores.length >= 2) {
      const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
      sds.push(Math.sqrt(scores.reduce((a, b) => a + (b - mean) ** 2, 0) / (scores.length - 1)));
    }
  }
  const pooledSd = sds.length > 0 ? Math.sqrt(sds.reduce((a, b) => a + b * b, 0) / sds.length) : null;
  const twoSd = pooledSd === null ? null : 2 * pooledSd;
  const band = twoSd === null ? null : Math.max(twoSd, 2.0);
  const noiseStop = twoSd !== null && twoSd > 4.0;

  const summary = {
    schema: "v25-stage0b-drill-summary-v1",
    at: new Date().toISOString(),
    runHash,
    sessionsSpent,
    sessionCap: SESSION_CAP,
    probe: { accepted: probe.accepted, sidecarSha256: probe.sidecarSha256 },
    raterModels: [...raterModels],
    cells: results.map(({ cell, res }) => ({
      cell,
      blindBookId: res.blindBookId,
      diagnostic: res.diagnostic.chapterDiagnostic,
      confidence: res.diagnostic.confidence,
      terminalState: res.diagnostic.terminalState,
      runRoot: res.runRoot,
    })),
    gates: {
      pooledSdRetest: pooledSd,
      twoTimesSd: twoSd,
      bandW: noiseStop ? null : band,
      noiseStop,
      firstAttemptValidRaterSessions: `${firstAttemptValid}/${raterSessions}`,
      firstAttemptGatePass: raterSessions === 0 ? null : firstAttemptValid >= Math.ceil((raterSessions * 6) / 8),
    },
    note: "CHAPTER DIAGNOSTIC — NOT A BOOK SCORE. D7-lite drill (3 sessions, both bands) is a separate follow-up step.",
  };
  const outPath = resolve(OUT_DIR, `drill-summary-${runHash}.json`);
  writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`\ndrill summary → ${outPath}`);
  console.log(JSON.stringify(summary.gates, null, 2));
  if (noiseStop) {
    console.error("NOISE STOP: 2×SD_retest > 4.0 — instrument too noisy; campaign halts for instrument work (never band inflation).");
    return 3;
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
