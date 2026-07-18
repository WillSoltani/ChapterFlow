/** §16 CONFIRMATORY NO-MODEL DRY RUN (post-substitution reseal proof) — same
 *  method as dry-run-driver.mts (REAL conductor, injected zero-spawn stages)
 *  over the SUBSTITUTED confirmatory twin (start-with-why + radical-candor).
 *  Additionally proves the SCREENING → EXPANSION path: injected all-pass
 *  reviews make every SOL cell screen clean, so the frozen
 *  `expand-if-any-sol-cell-screens-clean` rule must fire, persist ONCE, and
 *  run exactly the 32 expansion entries (96 total).
 *  Usage (PIPE): npx tsx state/migration-experiments/_owner-inputs/confirmatory-dry-run-driver.mts
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { runMigrationExperiment } from "../../../src/bakeoff/migration/runExperiment.js";
import { rootedPath, rootedWrite, migrationRoots } from "../../../src/bakeoff/migration/guards.js";
import { sha256Hex } from "../../../src/bakeoff/paths.js";

const SPEC = "state/migration-experiments/_owner-inputs/confirmatory-dryrun.spec.json";
const ID = "confirmatory-dryrun-2026-07";

function treeFingerprint(dir: string): string {
  const h = createHash("sha256");
  const walk = (d: string): void => {
    if (!existsSync(d)) return;
    for (const n of readdirSync(d).sort()) {
      const p = join(d, n);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else h.update(`${p}:${st.size}:${st.mtimeMs}\n`);
    }
  };
  walk(dir);
  return h.digest("hex");
}
const canonicalBefore = { chapters: treeFingerprint("state/chapters"), books: treeFingerprint("state/books"), src: treeFingerprint("src") };

const roots = migrationRoots(ID);
const INDEX: Record<string, number[]> = {
  "start-with-why": Array.from({ length: 14 }, (_, i) => i + 1),
  "radical-candor": Array.from({ length: 9 }, (_, i) => i + 1),
};
let sampleCalls = 0, reviewCalls = 0, qualifyCalls = 0;

const out = await runMigrationExperiment({
  specPath: SPEC,
  corpusPath: "/Users/radinsoltani/ChapterFlow-books/docs/v25/reports/S16_OWNER_INPUTS/C1_STAGE_Q_LABELING_PACKET.seed.json",
  through: "report",
  maxParallel: 1,
  sealDeps: { expectedChapterNumbers: (b: string) => { const i = INDEX[b]; if (!i) throw new Error(`no index for ${b}`); return i; } },
  stages: {
    qualifyJudge: (async (args: { judge: { model: string; effort: string } }) => {
      qualifyCalls++;
      const q = { schema: "migration-judge-qualification-v1", judge: args.judge, corpusId: "dryrun", corpusSha256: "0".repeat(64), instrumentVersions: { readerRubricVersion: "reader-rubric-v3-phase1", reviewDocHashVersion: "v3" }, scoredAt: new Date().toISOString(), perClass: [], falsePositiveRate: 0, evidenceQuoteValidityRate: 1, schemaValidityRate: 1, injectionResistanceRate: 1, thresholds: {}, qualified: true, labelProvenance: { human: 0, synthetic: 9 }, dryRunOnly: true };
      rootedWrite(roots, rootedPath(roots, "qualification", `judge.${args.judge.model}@${args.judge.effort}.json`), JSON.stringify(q, null, 2));
      return q;
    }) as never,
    runSample: (async (args: { entry: { blindSampleId: string; cellId: string; bookId: string; chapterNumber: number; stratum: string; sampleIndex: number; executionOrder: number } }) => {
      sampleCalls++;
      const e = args.entry;
      const fakeChapter = { chapterId: `${e.bookId}-ch${String(e.chapterNumber).padStart(2, "0")}`, cell: e.cellId, sample: e.sampleIndex };
      const rec = {
        schema: "migration-sample-record-v1", experimentId: ID, stage: "confirmatory",
        blindSampleId: e.blindSampleId, cellId: e.cellId, bookId: e.bookId, chapterNumber: e.chapterNumber,
        stratum: e.stratum, sampleIndex: e.sampleIndex, executionOrder: e.executionOrder,
        outcome: { providerOutcome: "content_completed", replayed: false, firstWriteDeterministicPass: true, durationMs: 1000 + e.executionOrder, writerSessionIds: [`dry-${e.blindSampleId}`] },
        artifact: { contentSha256: sha256Hex(JSON.stringify(fakeChapter)).slice(0, 16), chapterRelPath: `samples/${e.blindSampleId}/chapter.json` },
        critics: { c37Overreach: 0, c37SceneCompletion: 0, c37GenericLeak: 0, registerAdvisories: 0, causalClaims: 1, diversity: {} },
        review: null, agreementReview: null, tokens: null,
        unavailableFields: ["tokens", "costPerAcceptedChapterUsd"],
      };
      rootedWrite(roots, rootedPath(roots, "records", `${e.blindSampleId}.json`), JSON.stringify(rec, null, 2));
      return rec as never;
    }) as never,
    reviewSample: (async (args: { record: { blindSampleId: string; sampleIndex: number } }) => {
      reviewCalls++;
      const p = rootedPath(roots, "records", `${args.record.blindSampleId}.json`);
      const rec = JSON.parse(readFileSync(p, "utf8"));
      rec.review = { composite: 85, ship84: true, keyCheck: { matches: 5, of: 5 }, keysClean: true, valid: true, pass: true, complaints: [], reviewerSessionId: `dry-rev-${rec.blindSampleId}` };
      if (rec.sampleIndex === 1) rec.agreementReview = { ...rec.review, composite: 84, reviewerSessionId: `dry-agree-${rec.blindSampleId}` };
      rootedWrite(roots, p, JSON.stringify(rec, null, 2));
      return rec as never;
    }) as never,
  },
  log: (m: string) => console.log(m),
});

const canonicalAfter = { chapters: treeFingerprint("state/chapters"), books: treeFingerprint("state/books"), src: treeFingerprint("src") };
const untouched = JSON.stringify(canonicalBefore) === JSON.stringify(canonicalAfter);
const stopping = JSON.parse(readFileSync(rootedPath(roots, "stopping-decision.json"), "utf8"));
console.log(JSON.stringify({
  outcome: out,
  stageCalls: { qualifyCalls, sampleCalls, reviewCalls },
  stoppingDecision: stopping.decision,
  liveModelCalls: 0,
  canonicalTreesUntouched: untouched,
}, null, 2));
if (!untouched) { console.error("DRY RUN FAILED: canonical tree fingerprints changed"); process.exit(1); }
