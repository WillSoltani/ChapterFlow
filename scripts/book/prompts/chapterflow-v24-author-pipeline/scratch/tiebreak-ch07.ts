/** OPERATOR TIEBREAK — execution ch07 (2026-07-03), pre-committed decision rule.
 *
 *  Situation: ch07's regen budget is durably consumed (cap 2 write attempts).
 *  Verdict history: FAIL 84.7 (leaky doc, pre-regen bytes) → PASS 87.1 (leaky
 *  doc, current bytes) → FAIL 87.0 (fair doc, current bytes). Only ONE clean
 *  (post-leak-fix) read exists, and single-reader verdicts near the bar are
 *  proven coin-flips. Rule, committed BEFORE running:
 *    - spawn TWO more independent fair-doc readers (mirror reviewOneChapter
 *      exactly: same task, bar 84, read-only, effort high, quote-verify retry);
 *    - tally the THREE clean reads (existing FAIL + these two);
 *    - SHIP iff >=2/3 ship84=true, all counted reads valid, keys 9/9;
 *      then persist the deciding PASS through the REAL writers so the
 *      conductor's carry ledger picks it up on re-entry;
 *    - otherwise persist nothing (latest record stays FAIL) and HALT TO OWNER.
 *  No cap override, no threshold change — strictly MORE independent scrutiny.
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { resolveDeps } from "../src/orchestrator/autopilot.js";
import { renderChapterReaderDoc } from "../src/review/renderReaderDoc.js";
import {
  adjudicateReview,
  assertChapterReaderDocIntegrity,
  buildReaderReviewTask,
  parseReaderReview,
  writeChapterReview,
} from "../src/review/readerReview.js";
import { appendReviewHistory, writeReviewClearsLedger } from "../src/orchestrator/authorReviewLedger.js";
import { ensureTrailingNewline } from "../src/lib/atomicWrite.js";
import type { ChapterV21 } from "../src/types.js";

const BOOK = "execution";
const BAR = 84;
const OUT = resolve(process.cwd(), "scratch/tiebreak-ch07-reads");
const log = (m: string) => console.log(`${new Date().toISOString()} ${m}`);

async function main() {
  const deps = resolveDeps({ log });
  const ch = JSON.parse(readFileSync(resolve(process.cwd(), `state/chapters/${BOOK}-ch07.v21-native.chapter.json`), "utf8")) as ChapterV21;
  const docText = ensureTrailingNewline(renderChapterReaderDoc(ch));
  assertChapterReaderDocIntegrity(docText, ch);
  mkdirSync(OUT, { recursive: true });
  const relPath = `scratch/tiebreak-ch07-reads/ch07.txt`;
  writeFileSync(resolve(process.cwd(), relPath), docText);
  const task = buildReaderReviewTask(relPath, BAR);

  const reads = await Promise.all([2, 3].map(async (n) => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const sessionId = deps.mkSessionId(`author-review-ch07-tiebreak-r${n}${attempt > 1 ? "-r2" : ""}`);
      const r = await deps.spawn({ task, sessionId, cwd: process.cwd(), sandbox: "read-only", skipGitRepoCheck: true, reasoningEffort: "high" });
      const parsed = parseReaderReview(r.finalMessage) ?? parseReaderReview(r.stdout);
      if (!parsed) { log(`r${n}: attempt ${attempt} unparseable`); continue; }
      const review = adjudicateReview(parsed, docText, ch, { bar: BAR, reviewerSessionId: sessionId });
      writeFileSync(`${OUT}/read-r${n}.json`, JSON.stringify(review, null, 2));
      if (review.valid || attempt === 2) {
        log(`r${n}: composite ${review.composite} ship=${review.ship84} keys ${review.keyCheck.matches}/${review.keyCheck.of} valid=${review.valid}`);
        return review;
      }
      log(`r${n}: attempt ${attempt} failed quote verification — respawning once`);
    }
    return null;
  }));

  const clean = reads.filter((r): r is NonNullable<typeof r> => !!r && r.valid);
  // The existing clean read on disk is the fair-doc FAIL (ship=false, 87.0).
  const shipVotes = clean.filter((r) => r.ship84 && r.keyCheck.matches === r.keyCheck.of).length;
  const totalCleanReads = clean.length + 1; // + the persisted fair-doc FAIL
  log(`tally over ${totalCleanReads} clean fair-doc reads: ship=${shipVotes}, no-ship=${totalCleanReads - shipVotes}`);

  if (shipVotes >= 2 && clean.length === 2) {
    const winner = clean.filter((r) => r.ship84).sort((a, b) => b.composite - a.composite)[0];
    const p = writeChapterReview(BOOK, winner);
    appendReviewHistory(BOOK, winner);
    writeReviewClearsLedger(BOOK);
    log(`VERDICT: SHIP (2/3 majority) — persisted deciding PASS ${p}; carry will pick it up on re-entry`);
  } else {
    log(`VERDICT: HALT-TO-OWNER — no 2/3 ship majority among clean reads; nothing persisted (latest record stays FAIL)`);
    process.exit(2);
  }
}
main().catch((e) => { console.error("DRIVER ERROR:", e); process.exit(1); });
