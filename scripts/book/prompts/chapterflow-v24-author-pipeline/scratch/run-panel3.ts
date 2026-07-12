/** Panel-3: blinded paired 3-reader × 2 chapters (ch01 for panel-2 comparability, ch09 as the
 *  heavy-family probe). OLD = shipped Jun-27 package bytes; NEW = current parked full-stack regen.
 *  Counterbalanced A/B per trio (r1 A=old, r2 A=new, r3 A=old). Readers are read-only codex
 *  sessions returning strict JSON; quotes are byte-verified in a separate adjudication step. */
import { copyFileSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { resolveDeps, type AutopilotDeps } from "../src/orchestrator/autopilot.js";

const SCRATCH = "/private/tmp/claude-501/-Users-radinsoltani-ChapterFlow-books/1296ba89-3dc9-4467-af44-01be776fc7c9/scratchpad";
const DOCS = `${SCRATCH}/panel3/docs`;
const OUT = `${SCRATCH}/panel3/outputs`;
const MAT = resolve(process.cwd(), "scratch/panel3");
type SpawnOptions = Parameters<AutopilotDeps["spawn"]>[0];
const log = (m: string) => console.log(`${new Date().toISOString()} ${m}`);

const SESSIONS = [
  { id: "ch01-r1", ch: "ch01", A: "old", B: "new" },
  { id: "ch01-r2", ch: "ch01", A: "new", B: "old" },
  { id: "ch01-r3", ch: "ch01", A: "old", B: "new" },
  { id: "ch09-r4", ch: "ch09", A: "old", B: "new" },
  { id: "ch09-r5", ch: "ch09", A: "new", B: "old" },
  { id: "ch09-r6", ch: "ch09", A: "old", B: "new" },
] as const;

const FACTORS = "retention, quizzes, transfer, practical, summaries, tone, limits, insight, density, beginner";

function task(dirRel: string): string {
  return `BLINDED PAIRED CHAPTER REVIEW — you are one of several independent readers. You do not know how either version was produced; judge only what is on the page.

Two versions (A and B) of the same chapter of a book-learning product are at:
- ${dirRel}/version-A.txt
- ${dirRel}/version-B.txt
Read ONLY these two files. Do not write any files.

PROCESS (strict order):
1. Read Version A top to bottom. Answer its quiz YOURSELF from the prose BEFORE looking at the ANSWER KEY at the document bottom. Record your answers, any disagreement with the key (key-soundness), and any tell that would let someone guess keys without reading (uniquely longest choice, hedging, giveaway phrasing).
2. Do the same for Version B.
3. Score EACH version 0-100 on each factor: ${FACTORS}.
   - retention: will a reader remember the core move in a week (memorable lines, concrete images, echoes)
   - quizzes: fair, derivable from prose, sound keys, no tells, distractors that teach
   - transfer: applies beyond the book's own examples (if-then quality, challenge quality)
   - practical: a real person would actually DO these actions (low-friction, concrete, not theater)
   - summaries: fast/deep/full reads layered, accurate, each standalone
   - tone: plain confident register; no corporate filler; no template/scaffold smell
   - limits: honest about boundaries and failure modes; no overselling
   - insight: explains WHY (mechanism), not just what
   - density: ideas per paragraph; no padding or repetition
   - beginner: approachable cold; jargon-free
4. GATE: for each version, would you ship it against a professional >=84/100 bar? true/false.
5. PREFERENCE: which version is the better learning product overall, and the margin (0-100 points).
6. EVIDENCE: for each version, 2-4 VERBATIM quotes (exact copy-paste substrings of that version's file, each <=200 chars): its strongest moment(s) and worst defect(s), each with a one-line why. Quotes are mechanically byte-verified — one altered character invalidates your review. Do not paraphrase inside quote fields.

FINAL MESSAGE: exactly one fenced \`\`\`json block, no prose outside it:
{
  "quizDerivation": {"A": {"answers": ["a|b|c", ...], "keyDisagreements": ["Q3: prose supports b, key says a — <why>"], "tells": ["..."]}, "B": {...}},
  "scores": {"A": {"retention": 0, "quizzes": 0, "transfer": 0, "practical": 0, "summaries": 0, "tone": 0, "limits": 0, "insight": 0, "density": 0, "beginner": 0}, "B": {...}},
  "gate84": {"A": false, "B": false},
  "preferred": "A",
  "preferenceMargin": 0,
  "quotes": {"A": [{"quote": "...", "why": "..."}], "B": [{"quote": "...", "why": "..."}]},
  "oneParagraphVerdict": "..."
}`;
}

async function main() {
  const deps = resolveDeps({ log });
  mkdirSync(OUT, { recursive: true });
  for (const s of SESSIONS) {
    const d = resolve(MAT, s.id);
    mkdirSync(d, { recursive: true });
    copyFileSync(`${DOCS}/${s.A}-${s.ch}.txt`, resolve(d, "version-A.txt"));
    copyFileSync(`${DOCS}/${s.B}-${s.ch}.txt`, resolve(d, "version-B.txt"));
  }
  log(`materials staged under scratch/panel3/ — spawning ${SESSIONS.length} blinded readers`);

  await Promise.all(SESSIONS.map(async (s) => {
    const sid = deps.mkSessionId(`panel3-${s.id}`);
    log(`${s.id}: reader spawned`);
    const r = await deps.spawn({
      task: task(`scratch/panel3/${s.id}`),
      sessionId: sid,
      cwd: process.cwd(),
      sandbox: "read-only",
      skipGitRepoCheck: true,
      reasoningEffort: "high",
      env: {},
    } as SpawnOptions);
    writeFileSync(`${OUT}/${s.id}.stdout.txt`, r.stdout ?? "");
    const m = /```json\s*([\s\S]*?)```/.exec(r.stdout ?? "");
    let ok = false;
    if (m) {
      try { JSON.parse(m[1]); writeFileSync(`${OUT}/${s.id}.json`, m[1]); ok = true; } catch { /* parse fail recorded below */ }
    }
    log(`${s.id}: reader exited ${r.exitCode} — json ${ok ? "PARSED" : "MISSING/INVALID"}`);
  }));
  log("PANEL3 READERS DONE — adjudicate next");
}
main().catch((e) => { console.error("DRIVER ERROR:", e); process.exit(1); });
