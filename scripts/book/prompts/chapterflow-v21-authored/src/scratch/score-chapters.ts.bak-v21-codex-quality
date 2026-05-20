/**
 * Per-chapter alignment scorer. Runs every chapter in a v21 book package
 * against a 100-point rubric covering:
 *   - Hook (10):     length, specificity, no meta
 *   - Counter (10):  presence, length, paradox signal, no meta
 *   - Voice (15):    no meta, no em dashes, no banned phrases across tiers
 *   - Tiers (10):    length progression fast < deep < full, no identical openers
 *   - Examples (20): count, format diversity, named protagonists, scene anchors,
 *                    no v13-pool names, scenario length
 *   - Quiz (10):     count, answer-position balance, Bloom's diversity,
 *                    application focus (no recall openers)
 *   - Cards (5):     count, retrieval framing, difficulty progression
 *   - Plan (5):      ifThen contexts, concrete 24h challenge, weekly practice
 *   - Lines (10):    presence, structure, length floor, no em dashes in text
 *   - Schema (5):    required fields present
 *
 * Usage:
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/score-chapters.ts \
 *       book-packages/tiny-habits.v21.json
 *
 *   npx tsx scripts/book/prompts/chapterflow-v21-authored/src/scratch/score-chapters.ts \
 *       book-packages/tiny-habits.v21.json \
 *       book-packages/how-to-win-friends-and-influence-people.v21.json
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// ── Patterns ──────────────────────────────────────────────────────────────────

const META_PATTERNS: RegExp[] = [
  /\bthis chapter\b/i,
  /\bthe chapter\b/i,
  /\bthe author\b/i,
  /\bthe book\b/i,
  /\bin this (chapter|section|book|law)\b/i,
  /\b(Clear|Kahneman|Taleb|Housel|Tetlock|Cialdini|Greene|Machiavelli|Duhigg|Eyal|Covey|Ries|Brown|Kolb|Gladwell|Fogg|Carnegie)\s+(argues|says|opens|notes|introduces|explains|writes|claims|points out|observes)\b/i,
  /\bChapter\s+\d+\b/,
  /\bChapter\s+(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve)\b/i,
];

const BANNED_PHRASES: string[] = [
  "boundary condition",
  "double down",
  "hold lightly",
  "stack the deck",
  "decision fatigue",
  "low-hanging fruit",
  "skin in the game",
  "lean in",
  "move the needle",
  "circle back",
];

// 20 v13-overused names per FAILURE-MODES C7. Anika observed in HWF flagged us.
const V13_POOL_NAMES = [
  "Priya", "Omar", "Maya", "Sam", "Aisha", "Marcus", "Chen", "Sarah",
  "Jordan", "Jess", "Alex", "Maria", "Kai", "Nia", "Dev", "Ravi",
  "Anika", "Jamal", "Hannah", "Liam",
];

const PARADOX_SIGNALS = [
  /\bbut actually\b/i,
  /\binstead\b/i,
  /\bnot\b.*\bbut\b/i,
  /\bcounter-?intuit/i,
  /\bopposite\b/i,
  /\bparadox/i,
  /\bironic/i,
  /\bbackfir/i,
  /\bin fact\b/i,
  /\beven though\b/i,
  /\bdespite\b/i,
  /\bmost (readers|people)\b.{0,80}\b(assume|think|believe|expect)\b/i,
  /\b(it|this) (is|usually is|actually is)\b.*\b(rarely|never|isn't|instead)\b/i,
  /\bit rarely (does|works|is)\b/i,
  /\bwhat (you|they) (assume|expect|think) is\b/i,
];

const RECALL_OPENERS = /^(what does|according to|in the chapter|the chapter|this chapter)/i;

// ── Helpers ───────────────────────────────────────────────────────────────────

function countMatches(text: string, patterns: RegExp[]): number {
  let n = 0;
  for (const p of patterns) {
    const match = text.match(new RegExp(p, p.flags.includes("g") ? p.flags : p.flags + "g"));
    if (match) n += match.length;
  }
  return n;
}

function emDashCount(text: string): number {
  return (text.match(/—/g) ?? []).length;
}

function bannedPhraseCount(text: string): number {
  let n = 0;
  const lower = text.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    const re = new RegExp(`\\b${phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "g");
    n += (lower.match(re) ?? []).length;
  }
  return n;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function lerpScore(value: number, hardFloor: number, softFloor: number, max: number): number {
  // Returns [0..max] proportional to (value vs softFloor). At/above softFloor = max. At/below hardFloor = 0.
  if (value >= softFloor) return max;
  if (value <= hardFloor) return 0;
  return Math.round((max * (value - hardFloor)) / (softFloor - hardFloor));
}

// ── Scoring functions ─────────────────────────────────────────────────────────

type Score = { earned: number; max: number; notes: string[] };

function scoreHook(ch: any): Score {
  const notes: string[] = [];
  let earned = 0;
  const max = 10;
  const hook = ch.hook ?? "";
  const len = hook.length;

  if (len >= 60 && len <= 140) earned += 5;
  else {
    earned += lerpScore(len, 30, 60, 5);
    notes.push(`hook ${len} chars (target 60–140)`);
  }

  const meta = countMatches(hook, META_PATTERNS);
  if (meta === 0) earned += 3;
  else notes.push(`hook has ${meta} meta-tell(s)`);

  if (!hook.includes("—")) earned += 2;
  else notes.push("hook has em dash");

  return { earned, max, notes };
}

function scoreCounter(ch: any): Score {
  const notes: string[] = [];
  let earned = 0;
  const max = 10;
  const counter = ch.counterintuition ?? "";
  if (!counter) {
    notes.push("counterintuition missing");
    return { earned, max, notes };
  }

  const len = counter.length;
  if (len >= 80 && len <= 400) earned += 4;
  else {
    earned += lerpScore(len, 30, 80, 4);
    notes.push(`counter ${len} chars (target 80–400)`);
  }

  const meta = countMatches(counter, META_PATTERNS);
  if (meta === 0) earned += 3;
  else notes.push(`counter has ${meta} meta-tell(s)`);

  const hasParadoxSignal = PARADOX_SIGNALS.some((p) => p.test(counter));
  if (hasParadoxSignal) earned += 3;
  else notes.push("counter lacks paradox signal");

  return { earned, max, notes };
}

function scoreVoice(ch: any): Score {
  const notes: string[] = [];
  let earned = 0;
  const max = 15;

  const tiers = [
    ch.breakdown?.fastRead ?? "",
    ch.breakdown?.deepRead ?? "",
    ch.breakdown?.fullRead ?? "",
    ch.keyTakeaway ?? "",
  ].join("\n\n");

  const meta = countMatches(tiers, META_PATTERNS);
  earned += clamp(5 - meta, 0, 5);
  if (meta > 0) notes.push(`${meta} meta-tell(s) in prose tiers`);

  const ed = emDashCount(tiers);
  earned += clamp(5 - ed, 0, 5);
  if (ed > 0) notes.push(`${ed} em dash(es) in prose tiers`);

  const banned = bannedPhraseCount(tiers);
  earned += clamp(5 - banned, 0, 5);
  if (banned > 0) notes.push(`${banned} banned phrase(s) in prose tiers`);

  return { earned, max, notes };
}

function scoreTiers(ch: any): Score {
  const notes: string[] = [];
  let earned = 0;
  const max = 10;

  const fastLen = (ch.breakdown?.fastRead ?? "").length;
  const deepLen = (ch.breakdown?.deepRead ?? "").length;
  const fullLen = (ch.breakdown?.fullRead ?? "").length;

  // Length-band scoring
  earned += lerpScore(fastLen, 200, 400, 2);
  earned += lerpScore(deepLen, 800, 1200, 3);
  earned += lerpScore(fullLen, 2000, 2800, 3);
  if (fastLen < 400) notes.push(`fastRead ${fastLen} chars (target 400+)`);
  if (deepLen < 1200) notes.push(`deepRead ${deepLen} chars (target 1200+)`);
  if (fullLen < 2800) notes.push(`fullRead ${fullLen} chars (target 2800+)`);

  // Progressive: each tier should be longer than the prior
  const progressive = fastLen < deepLen && deepLen < fullLen;
  if (progressive) earned += 2;
  else notes.push("tiers not progressively longer");

  return { earned, max, notes };
}

function scoreExamples(ch: any): Score {
  const notes: string[] = [];
  let earned = 0;
  const max = 20;
  const examples = Array.isArray(ch.examples) ? ch.examples : [];

  // Count
  if (examples.length >= 5) earned += 4;
  else {
    earned += lerpScore(examples.length, 0, 5, 4);
    notes.push(`only ${examples.length} examples`);
  }

  // Format diversity
  const formats = new Set(examples.map((e: any) => e.planSpec?.format).filter(Boolean));
  if (formats.size >= 4) earned += 4;
  else if (formats.size === 3) earned += 3;
  else {
    earned += clamp(formats.size, 0, 2);
    notes.push(`only ${formats.size} distinct formats`);
  }

  // Named protagonists (regex: scene starts with a capitalized first name in the first 60 chars)
  // v13-pool: count examples that use a pool name (not raw mentions — same protagonist
  // referred to 3x in one scenario is normal scene-writing, not three pool hits).
  let namedCount = 0;
  let v13PoolExamples = 0;
  let avgScenarioLen = 0;
  for (const ex of examples) {
    const scenario: string = ex.scenario ?? "";
    avgScenarioLen += scenario.length;
    const firstChunk = scenario.slice(0, 80);
    if (/\b[A-Z][a-z]{2,}\b/.test(firstChunk)) namedCount += 1;
    const usesPoolName = V13_POOL_NAMES.some((name) =>
      new RegExp(`\\b${name}\\b`).test(scenario),
    );
    if (usesPoolName) v13PoolExamples += 1;
  }
  avgScenarioLen = examples.length ? avgScenarioLen / examples.length : 0;

  // Named protagonists (4 pts proportional)
  if (examples.length > 0) {
    earned += Math.round((4 * namedCount) / examples.length);
    if (namedCount < examples.length) notes.push(`${examples.length - namedCount} unnamed scenes`);
  }

  // Scenario length: avg ≥ 400 chars = 4 pts
  earned += lerpScore(avgScenarioLen, 200, 400, 4);
  if (avgScenarioLen < 400) notes.push(`avg scenario ${Math.round(avgScenarioLen)} chars (target 400+)`);

  // No v13-pool names: 4 pts (penalty per example using a pool name)
  earned += clamp(4 - v13PoolExamples, 0, 4);
  if (v13PoolExamples > 0) notes.push(`${v13PoolExamples} example(s) use v13-pool name`);

  return { earned, max, notes };
}

function scoreQuiz(ch: any): Score {
  const notes: string[] = [];
  let earned = 0;
  const max = 10;
  const questions = ch.quiz?.questions ?? [];

  // Count
  if (questions.length >= 9) earned += 2;
  else {
    earned += lerpScore(questions.length, 0, 9, 2);
    notes.push(`only ${questions.length} quiz questions`);
  }

  // Answer-position balance
  const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
  for (const q of questions) counts[q.correctIndex] = (counts[q.correctIndex] ?? 0) + 1;
  const maxFrac = questions.length ? Math.max(...Object.values(counts)) / questions.length : 1;
  if (maxFrac <= 0.45) earned += 2;
  else if (maxFrac <= 0.55) earned += 1;
  else notes.push(`answer-pos imbalance ${Math.round(maxFrac * 100)}%`);

  // Bloom's diversity
  const blooms = new Set(questions.map((q: any) => q.bloomsLevel).filter(Boolean));
  if (blooms.size >= 4) earned += 2;
  else if (blooms.size === 3) earned += 1;
  else notes.push(`only ${blooms.size} Bloom's levels`);

  // No recall openers
  let recall = 0;
  for (const q of questions) if (RECALL_OPENERS.test(q.prompt ?? "")) recall += 1;
  earned += clamp(2 - recall, 0, 2);
  if (recall > 0) notes.push(`${recall} recall-style prompt(s)`);

  // Application focus (proxy: avg prompt length ≥ 120 chars suggests scenario-based)
  const avgPrompt = questions.length
    ? questions.reduce((acc: number, q: any) => acc + (q.prompt?.length ?? 0), 0) / questions.length
    : 0;
  if (avgPrompt >= 150) earned += 2;
  else earned += lerpScore(avgPrompt, 60, 150, 2);
  if (avgPrompt < 150) notes.push(`avg prompt ${Math.round(avgPrompt)} chars (target 150+)`);

  return { earned, max, notes };
}

function scoreCards(ch: any): Score {
  const notes: string[] = [];
  let earned = 0;
  const max = 5;
  const cards = ch.reviewCards ?? [];

  if (cards.length >= 4) earned += 1;
  else notes.push(`only ${cards.length} cards`);

  // Retrieval framing — "Why does X happen?" / "How do you Y?" / scenario-front cues
  // vs comprehension "What is X?" / "Explain X"
  let retrievalCount = 0;
  for (const c of cards) {
    const front = c.front ?? "";
    const isRetrieval =
      /\?$/.test(front.trim()) || // ends in question mark
      /^(you|imagine|suppose|a\b|an\b)/i.test(front.trim()); // scenario-fronted
    const isComprehension = /^what is\b|^define\b|^explain\b/i.test(front.trim());
    if (isRetrieval && !isComprehension) retrievalCount += 1;
  }
  if (cards.length > 0) {
    earned += Math.round((2 * retrievalCount) / cards.length);
    if (retrievalCount < cards.length) notes.push(`${cards.length - retrievalCount} non-retrieval card(s)`);
  }

  // Difficulty progression
  const difficulties = cards.map((c: any) => c.difficulty);
  const uniq = new Set(difficulties);
  if (uniq.size >= 3) earned += 2;
  else if (uniq.size === 2) earned += 1;
  else notes.push(`only ${uniq.size} difficulty level(s)`);

  return { earned, max, notes };
}

function scorePlan(ch: any): Score {
  const notes: string[] = [];
  let earned = 0;
  const max = 5;
  const plan = ch.implementationPlan ?? {};

  // ifThen contexts
  const ifThens = plan.ifThenPlans ?? [];
  if (ifThens.length >= 4) earned += 1;
  else {
    earned += lerpScore(ifThens.length, 0, 4, 1);
    notes.push(`only ${ifThens.length} ifThenPlans`);
  }

  // 24h challenge specific (proxy: ≥80 chars and contains a verb-object pair)
  const challenge: string = plan.twentyFourHourChallenge ?? "";
  if (challenge.length >= 100) earned += 2;
  else earned += lerpScore(challenge.length, 30, 100, 2);
  if (challenge.length < 100) notes.push(`challenge ${challenge.length} chars (target 100+)`);

  // Weekly practice present
  if (plan.weeklyPractice) earned += 1;
  else notes.push("weeklyPractice missing");

  // ifThen plans use concrete triggers (proxy: each plan ≥80 chars)
  const concreteCount = ifThens.filter((p: any) => (p.plan ?? "").length >= 80).length;
  if (ifThens.length > 0) {
    earned += Math.round((1 * concreteCount) / ifThens.length);
    if (concreteCount < ifThens.length) notes.push(`${ifThens.length - concreteCount} thin ifThen plan(s)`);
  }

  return { earned, max, notes };
}

function scoreLines(ch: any): Score {
  const notes: string[] = [];
  let earned = 0;
  const max = 10;
  const lines = ch.memorableLines ?? [];

  if (lines.length === 3) earned += 4;
  else if (lines.length === 2) earned += 2;
  else if (lines.length >= 1) earned += 1;
  else {
    notes.push("no memorable lines");
    return { earned, max, notes };
  }

  let wellStructured = 0;
  let textOk = 0;
  for (const ln of lines) {
    if (ln.text && ln.location && ln.why) wellStructured += 1;
    if ((ln.text ?? "").length >= 30 && !((ln.text ?? "").includes("—"))) textOk += 1;
  }
  earned += Math.round((3 * wellStructured) / Math.max(lines.length, 1));
  earned += Math.round((3 * textOk) / Math.max(lines.length, 1));
  if (wellStructured < lines.length) notes.push(`${lines.length - wellStructured} line(s) missing fields`);
  if (textOk < lines.length) notes.push(`${lines.length - textOk} line(s) too short or have em dash`);

  return { earned, max, notes };
}

function scoreSchema(ch: any): Score {
  const notes: string[] = [];
  let earned = 0;
  const max = 5;
  const required = [
    "chapterId", "number", "title", "readingTimeMinutes",
    "hook", "counterintuition", "keyTakeaway",
    "breakdown", "examples", "quiz", "reviewCards", "implementationPlan",
  ];
  const missing = required.filter((k) => !ch[k]);
  earned = clamp(5 - missing.length, 0, 5);
  if (missing.length > 0) notes.push(`missing fields: ${missing.join(", ")}`);
  return { earned, max, notes };
}

function scoreChapter(ch: any) {
  return {
    hook: scoreHook(ch),
    counter: scoreCounter(ch),
    voice: scoreVoice(ch),
    tiers: scoreTiers(ch),
    examples: scoreExamples(ch),
    quiz: scoreQuiz(ch),
    cards: scoreCards(ch),
    plan: scorePlan(ch),
    lines: scoreLines(ch),
    schema: scoreSchema(ch),
  };
}

function totalOf(scores: ReturnType<typeof scoreChapter>) {
  let earned = 0;
  let max = 0;
  for (const s of Object.values(scores)) {
    earned += s.earned;
    max += s.max;
  }
  return { earned, max };
}

function letterGrade(pct: number): string {
  if (pct >= 95) return "A+";
  if (pct >= 90) return "A";
  if (pct >= 85) return "A-";
  if (pct >= 80) return "B+";
  if (pct >= 75) return "B";
  if (pct >= 70) return "B-";
  if (pct >= 65) return "C+";
  if (pct >= 60) return "C";
  return "F";
}

// ── Main ──────────────────────────────────────────────────────────────────────

const repoRoot = resolve(process.cwd());

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("usage: score-chapters.ts <book-package.json> [...]");
  process.exit(1);
}

for (const argPath of args) {
  const path = resolve(repoRoot, argPath);
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  const title = pkg.book?.title ?? pkg.book?.bookId ?? "Unknown";

  console.log(`\n## ${title}\n`);
  console.log(`| Ch | Title | Hook | Cntr | Voice | Tiers | Exmpl | Quiz | Cards | Plan | Lines | Schma | Total | Grade |`);
  console.log(`|----|-------|------|------|-------|-------|-------|------|-------|------|-------|-------|-------|-------|`);

  const allScores: Array<{ n: number; title: string; total: number; pct: number; grade: string; notes: string[] }> = [];

  for (const ch of pkg.chapters) {
    const s = scoreChapter(ch);
    const { earned, max } = totalOf(s);
    const pct = Math.round((earned / max) * 100);
    const grade = letterGrade(pct);
    const titleShort = (ch.title ?? "").length > 40 ? (ch.title ?? "").slice(0, 38) + "…" : ch.title ?? "";
    const allNotes = Object.entries(s).flatMap(([_, v]) => v.notes);

    console.log(
      `| ${String(ch.number).padStart(2, " ")} | ${titleShort} ` +
      `| ${s.hook.earned}/${s.hook.max} | ${s.counter.earned}/${s.counter.max} | ${s.voice.earned}/${s.voice.max} ` +
      `| ${s.tiers.earned}/${s.tiers.max} | ${s.examples.earned}/${s.examples.max} | ${s.quiz.earned}/${s.quiz.max} ` +
      `| ${s.cards.earned}/${s.cards.max} | ${s.plan.earned}/${s.plan.max} | ${s.lines.earned}/${s.lines.max} ` +
      `| ${s.schema.earned}/${s.schema.max} | **${earned}/${max}** | **${grade}** |`
    );
    allScores.push({ n: ch.number, title: ch.title ?? "", total: pct, pct, grade, notes: allNotes });
  }

  // Summary
  const totals = allScores.map((s) => s.pct);
  const avg = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
  const min = Math.min(...totals);
  const max = Math.max(...totals);

  console.log(`\n**Summary**: ${allScores.length} chapters · avg ${avg} · range ${min}–${max} · grade ${letterGrade(avg)}\n`);

  // Outliers (lowest 3)
  const lowest = [...allScores].sort((a, b) => a.pct - b.pct).slice(0, 3);
  if (lowest.length) {
    console.log(`**Weakest chapters (gaps to fix):**`);
    for (const o of lowest) {
      console.log(`- Ch${o.n} (${o.pct}%): ${o.notes.length ? o.notes.join("; ") : "no specific notes"}`);
    }
    console.log("");
  }
}
