/** Same-instrument control: run the book-level acceptance read on the SHIPPED
 *  POM package (repo-root bytes), sampling the SAME seeded chapters (2,3,4,5)
 *  the v24 acceptance sampled, with 3 readers. Direct paired comparison for the
 *  80.3-vs-bar-84 calibration decision. */
import { readFileSync, mkdirSync } from "fs";
import { dirname, resolve } from "path";
import { resolveDeps, type AutopilotDeps } from "../src/orchestrator/autopilot.js";
import { selectSeededChapters, renderBookSampleDoc, buildBookReviewTask, parseBookReview, adjudicateBookReview, composeBookVerdict } from "../src/review/evalBookProxy.js";
import { writeFileAtomic } from "../src/lib/atomicWrite.js";
import type { BookPackageV21 } from "../src/types.js";

const BOOK = "the-power-of-moments";
const SHIPPED_PKG = "/Users/radinsoltani/ChapterFlow-books/book-packages/the-power-of-moments.v21.json";
type SpawnOptions = Parameters<AutopilotDeps["spawn"]>[0];
const log = (m: string) => console.log(`${new Date().toISOString()} ${m}`);

async function main() {
  const deps = resolveDeps({ log });
  const pkg = JSON.parse(readFileSync(SHIPPED_PKG, "utf8")) as BookPackageV21;
  const sampled = selectSeededChapters(BOOK, pkg.chapters, 4);
  log(`shipped POM: sampled ch ${sampled.map((c) => c.number).join(", ")} (must be 2,3,4,5 to pair with the v24 acceptance)`);
  const docText = renderBookSampleDoc(sampled);
  const docRel = "scratch/eval-proxy/pom-shipped-control/book-sample.txt";
  const docAbs = resolve(process.cwd(), docRel);
  mkdirSync(dirname(docAbs), { recursive: true });
  writeFileAtomic(docAbs, docText);
  log(`doc ${docText.length} chars — spawning 3 readers`);

  const task = buildBookReviewTask(docRel);
  const readers = await Promise.all([1, 2, 3].map(async (i) => {
    const sessionId = `pom-shipped-control-r${i}-${Date.now()}`;
    const r = await deps.spawn({ task, sessionId, cwd: process.cwd(), sandbox: "read-only", skipGitRepoCheck: true, reasoningEffort: "high", env: {} } as SpawnOptions);
    const stdout = (r as { stdout?: string }).stdout ?? "";
    const finalMessage = (r as { finalMessage?: string }).finalMessage ?? "";
    const parsed = parseBookReview(finalMessage) ?? parseBookReview(stdout);
    if (!parsed) { log(`r${i}: unparseable`); return null; }
    const adj = adjudicateBookReview(parsed, docText, sampled, sessionId);
    log(`r${i}: comp=${adj.composite} gate=${adj.gateVerdict} churn=${adj.churn} keys=${adj.keyCheck.matches}/${adj.keyCheck.of} valid=${adj.valid ? "yes" : `NO (${adj.invalidReason})`}`);
    return adj;
  }));
  const verdict = composeBookVerdict(BOOK, sampled.map((c) => c.number), readers.filter((x): x is NonNullable<typeof x> => x !== null));
  log(`SHIPPED POM book-read: composite ${verdict.medianComposite} gate ${verdict.gate} (${verdict.gateVotes}) churn ${verdict.churn} — v24 scored 80.3 on the same instrument/chapters`);
}
main().catch((e) => { console.error("DRIVER ERROR:", e); process.exit(1); });
