/* eslint-disable @typescript-eslint/no-explicit-any -- operator tool; if copied under docs/ the repo's Lint Ratchet would count these */
// Model-free, read-only replay of the fresh-QC evaluator's DETERMINISTIC lane against a COPY of a candidate.
// No runner and no taskContext are passed, so the source-fidelity and answer-key model judges are skipped
// (candidateQcEvaluator.ts: judges run only when a runner AND taskContext exist). Any write throws.
//
// Usage (API keys stripped; never point the books root at ~/cf-canary itself; never use /tmp — macOS reaps it):
//   Q=~/cf-wt/v25-execution/scratch/qc-copy; mkdir -p $Q/books/the-autobiography-of-benjamin-franklin/candidates
//   cp -R ~/cf-canary/books/the-autobiography-of-benjamin-franklin/candidates/<candidateId> $Q/books/the-autobiography-of-benjamin-franklin/candidates/
//   cd <checkout-or-worktree>/scripts/book/prompts/chapterflow-v24-author-pipeline && PIPE_SRC=$PWD/src \
//   env -u OPENAI_API_KEY -u ANTHROPIC_API_KEY CHAPTERFLOW_NO_API_CODEX_QC=1 \
//     npx tsx ~/cf-wt/v25-execution/tools/detqc.mts $Q/books <candidateId>
// PIPE_SRC defaults to the canonical checkout. Run npx from inside a pipeline package dir so tsx resolves.
// Baseline (9f0117cb7, candidate review-repair-21-candidate-06d7596a…): outcome FAIL, 33 blockers
// {BP15:19, SC11.2:4, SC11.7:3, B1:3, EI1:2, EI2:1, F4:1}; UNLOCATED blockers: 1 ["F4"] (see assessment/data/detqc-rr21.out).
const P = process.env.PIPE_SRC
  ?? "/Users/radinsoltani/ChapterFlow-books-v25-completion/scripts/book/prompts/chapterflow-v24-author-pipeline/src";
const { createBookContentReader } = await import(`${P}/books/bookContentReader.ts`);
const { createCurrentPointerStore } = await import(`${P}/books/currentPointer.ts`);
const { CandidateQcEvaluator } = await import(`${P}/app/candidateQcEvaluator.ts`);
const booksRoot = process.argv[2];
const candidateId = process.argv[3];
if (!booksRoot || !candidateId) { console.log("usage: detqc.mts <booksRootCopy> <candidateId>"); process.exit(2); }
if (booksRoot.includes("/cf-canary/")) { console.log("REFUSED: booksRoot must be a COPY, not ~/cf-canary"); process.exit(2); }
const bookId = process.env.BOOK_ID ?? "the-autobiography-of-benjamin-franklin";
const writeLock = { run: async () => { throw new Error("WRITE_ATTEMPTED"); } };
const currentPointerStore = createCurrentPointerStore({ booksRoot, writeLock: writeLock as any });
const reader = createBookContentReader({ booksRoot, currentPointerStore });
const opened = await reader.open({ bookId, selector: { kind: "CANDIDATE", candidateId } });
if (!opened.ok) { console.log("OPEN_FAILED", JSON.stringify(opened.error)); process.exit(1); }
const cand = opened.value;
const ident = { candidateId: cand.manifest.candidateId, manifestDigest: cand.manifest.manifestDigest };
const review = { schemaVersion: "1", reviewId: "synthetic-pass", candidate: ident, outcome: "PASS", issues: [], completedAt: "2026-09-22T00:00:00.000Z" };
const ev = new CandidateQcEvaluator(reader);
const res = await ev.run({ candidate: cand, canonicalReview: review as any, roundId: "synthetic-round" });
if (!res.ok) { console.log("EVAL_FAILED", JSON.stringify(res.error)); process.exit(1); }
const v = res.value;
const blockers = v.issues.filter((i: any) => i.severity === "BLOCKER");
const warns = v.issues.filter((i: any) => i.severity === "WARN");
console.log("outcome", v.outcome, "issues", v.issues.length, "blockers", blockers.length, "warns", warns.length);
const byCode: Record<string, number> = {};
for (const b of blockers) byCode[b.code] = (byCode[b.code] ?? 0) + 1;
console.log("BLOCKER codes:", JSON.stringify(byCode));
const unlocated = blockers.filter((b: any) => !b.location);
console.log("UNLOCATED blockers:", unlocated.length, JSON.stringify(unlocated.map((b: any) => b.code)));
for (const b of blockers.slice(0, 80)) console.log("B", b.code, b.location ?? "<no location>", String(b.message).slice(0, 220));
