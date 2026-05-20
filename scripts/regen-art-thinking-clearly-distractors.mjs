#!/usr/bin/env node
/**
 * Regenerate quiz distractors for the-art-of-thinking-clearly.v21.json.
 *
 * Strategy: one API call per question (two distractors generated together so
 * they can be checked against each other for shared 5-grams). Sequential
 * chapters with a per-chapter gate. Resumable — only touches questions that
 * still contain a banned template phrase.
 */
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";

// Load .env.local manually (avoid adding dotenv dependency).
try {
  const env = fs.readFileSync(".env.local", "utf-8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1);
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
} catch {}

const BOOK_PATH = "book-packages/the-art-of-thinking-clearly.v21.json";
const MODEL = process.env.REGEN_MODEL || "claude-sonnet-4-5";
const MAX_ATTEMPTS_PER_QUESTION = 4;
const CHAPTER_CONCURRENCY = 6;
const START_CH = parseInt(process.env.START_CH || "1", 10); // 1-indexed
const END_CH = parseInt(process.env.END_CH || "99", 10);

const BANNED_PHRASES = [
  "looks strong enough to guide",
  "gives a practical reason for",
  "fits the immediate pressure around",
  "supports a narrower read of",
  "points toward a quicker call",
  "makes",
  "may matter under the right conditions",
  "may be the most visible signal here",
  "may be impractical to measure quickly",
  "may be risky in this case",
  "may deserve less weight here",
  "without comparing it with the relevant alternative",
  "while the same weak assumption",
  "before checking the current decision evidence",
  "while leaving the key comparison unchecked",
  "without testing the evidence in this scene",
];

const BANNED_REGEX =
  /(looks strong enough to guide|gives a practical reason for|fits the immediate pressure around|supports a narrower read of|points toward a quicker call|let [a-z ]+ stand until [a-z ]+ contradicts it|can wait unless [a-z ]+ changes the stakes|makes [a-z ]+ look credible|may matter under the right conditions|may be the most visible signal here|may be impractical to measure quickly|may be risky in this case|may deserve less weight here|without comparing it with the relevant alternative|while the same weak assumption|before checking the current decision evidence|while leaving the key comparison unchecked|without testing the evidence in this scene)/i;

const ABSOLUTE_REGEX =
  /\b(always|never|automatically|impossible|guaranteed|entirely|ever|forever|completely|wholly|absolutely)\b/i;
const ABSOLUTE_OK = /^(whatever|however|whenever|whichever)$/i;

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Missing ANTHROPIC_API_KEY in .env.local");
  process.exit(1);
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function tokens(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function fiveGrams(s) {
  const t = tokens(s);
  const out = [];
  for (let i = 0; i <= t.length - 5; i++) out.push(t.slice(i, i + 5).join(" "));
  return out;
}

function questionNeedsRegen(q) {
  return q.choices.some((c, di) => di !== q.correctIndex && BANNED_REGEX.test(c));
}

function validateDistractor(text, correctAnswer, extraBanList = []) {
  if (typeof text !== "string" || !text.trim()) return "empty";
  if (BANNED_REGEX.test(text)) return "banned-phrase";
  const m = text.match(ABSOLUTE_REGEX);
  if (m && !ABSOLUTE_OK.test(m[1])) return "absolute-word:" + m[1];
  if (!/^[A-Z"']/.test(text.trim())) return "lowercase-open";
  for (const phrase of extraBanList) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) return "extra-ban:" + phrase;
  }
  const cLen = correctAnswer.length;
  const ratio = cLen / text.length;
  if (ratio > 1.5 || ratio < 1 / 1.5) return "length-ratio:" + ratio.toFixed(2);
  return null;
}

const SYSTEM_PROMPT = `You write multiple-choice quiz distractors for a cognitive-bias chapter quiz. A distractor is a WRONG answer that is plausible — a misdiagnosis or wrong action a real practitioner might genuinely hold about the specific scenario in the question.

Hard rules:
1. Reference the scenario by content — name the specific actor, action, or condition the question describes. No generic phrasing.
2. Match approximate length of the correct answer (80%–130% of its character count).
3. Open with a capital letter. Single sentence preferred; two short sentences max.
4. Do NOT use any of these banned phrases or anything close to them:
   - "looks strong enough to guide"
   - "gives a practical reason for"
   - "fits the immediate pressure around"
   - "supports a narrower read of"
   - "points toward a quicker call"
   - "let X stand until Y contradicts it"
   - "can wait unless X changes the stakes"
   - "makes X look credible"
   - "may matter under the right conditions"
   - "may be the most visible signal here"
   - "may be impractical to measure quickly"
   - "may be risky in this case"
   - "may deserve less weight here"
   - "without comparing it with the relevant alternative"
   - "while the same weak assumption"
   - "before checking the current decision evidence"
   - "while leaving the key comparison unchecked"
   - "without testing the evidence in this scene"
5. Do NOT use absolute language: always, never, automatically, impossible, guaranteed, entirely, ever, forever, completely, wholly, absolutely.
6. The two distractors you write must NOT share any continuous 5-word phrase with each other or with the correct answer.
7. Each distractor must be a coherent, grammatical sentence. No word salad, no template substitution.

You will return ONLY a JSON object: {"d1": "...", "d2": "..."}. No prose, no explanation.`;

function buildUserMessage(ctx) {
  const { chapterTitle, prompt, correct, explanation, extraBans } = ctx;
  let extra = "";
  if (extraBans && extraBans.length) {
    extra =
      "\n\nADDITIONAL banned phrases this attempt (do not use any of them):\n" +
      extraBans.map((p) => "- " + JSON.stringify(p)).join("\n");
  }
  return `Chapter: ${chapterTitle}

Question prompt:
${prompt}

Correct answer (do not rewrite this — write two WRONG alternatives):
${correct}

Why the correct answer is correct (for context):
${explanation}

Write two distractors. Each should be a wrong view a real practitioner might plausibly hold about THIS specific scenario — not a nonsense alternative, not a template. They should diverge from each other in content (different wrong angle each).${extra}

Return only JSON: {"d1": "...", "d2": "..."}`;
}

async function callClaude(ctx) {
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserMessage(ctx) }],
  });
  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in response: " + text.slice(0, 200));
  const obj = JSON.parse(match[0]);
  if (typeof obj.d1 !== "string" || typeof obj.d2 !== "string")
    throw new Error("Malformed JSON: " + match[0].slice(0, 200));
  return [obj.d1.trim(), obj.d2.trim()];
}

async function regenQuestion(chapterTitle, q, log) {
  const correct = q.choices[q.correctIndex];
  let extraBans = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_QUESTION; attempt++) {
    try {
      const [d1, d2] = await callClaude({
        chapterTitle,
        prompt: q.prompt,
        correct,
        explanation: q.explanation,
        extraBans,
      });
      const v1 = validateDistractor(d1, correct, extraBans);
      const v2 = validateDistractor(d2, correct, extraBans);
      // cross-check: d1 and d2 must not share a 5-gram
      const g1 = new Set(fiveGrams(d1));
      const cg = new Set(fiveGrams(correct));
      let sharedAB = false,
        sharedAC = false,
        sharedBC = false;
      for (const g of fiveGrams(d2)) if (g1.has(g)) sharedAB = true;
      for (const g of fiveGrams(d1)) if (cg.has(g)) sharedAC = true;
      for (const g of fiveGrams(d2)) if (cg.has(g)) sharedBC = true;
      if (!v1 && !v2 && !sharedAB && !sharedAC && !sharedBC) {
        return [d1, d2];
      }
      log(
        `    attempt ${attempt} reject: v1=${v1} v2=${v2} sharedAB=${sharedAB} AC=${sharedAC} BC=${sharedBC}`,
      );
      // augment bans for next attempt
      if (sharedAB) {
        for (const g of fiveGrams(d2)) if (g1.has(g)) extraBans.push(g);
      }
      if (v1 && v1.startsWith("extra-ban:")) extraBans.push(v1.slice(10));
      if (v2 && v2.startsWith("extra-ban:")) extraBans.push(v2.slice(10));
    } catch (e) {
      log(`    attempt ${attempt} error: ${e.message}`);
    }
  }
  throw new Error("question regen failed after " + MAX_ATTEMPTS_PER_QUESTION + " attempts");
}

async function processChapter(book, chIndex, log) {
  const ch = book.chapters[chIndex];
  const title = ch.title;
  const targets = [];
  ch.quiz.questions.forEach((q, qi) => {
    if (questionNeedsRegen(q)) targets.push(qi);
  });
  if (!targets.length) {
    log(`Ch${chIndex + 1} (${title}): no regen needed`);
    return false;
  }
  log(`Ch${chIndex + 1} (${title}): regenerating ${targets.length} questions`);

  // concurrency-bounded parallel regen of questions in this chapter
  const newPairs = new Map();
  for (let i = 0; i < targets.length; i += CHAPTER_CONCURRENCY) {
    const batch = targets.slice(i, i + CHAPTER_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (qi) => {
        const q = ch.quiz.questions[qi];
        const pair = await regenQuestion(title, q, log);
        return [qi, pair];
      }),
    );
    for (const [qi, pair] of results) newPairs.set(qi, pair);
  }

  // chapter-level 5-gram dedup: gather all proposed distractors (only the regenerated ones)
  // and check no 5-gram appears 2+ times.
  for (let round = 0; round < 3; round++) {
    const counts = new Map();
    for (const [, [d1, d2]] of newPairs) {
      for (const g of fiveGrams(d1)) counts.set(g, (counts.get(g) || 0) + 1);
      for (const g of fiveGrams(d2)) counts.set(g, (counts.get(g) || 0) + 1);
    }
    const dups = [...counts.entries()].filter(([, c]) => c >= 2).map(([g]) => g);
    if (!dups.length) break;
    log(`  chapter dedup round ${round + 1}: ${dups.length} 5-gram dups across chapter`);
    // find which questions contain a duplicated 5-gram and regenerate them with extra bans
    const affected = new Set();
    for (const [qi, [d1, d2]] of newPairs) {
      const g1 = new Set(fiveGrams(d1));
      const g2 = new Set(fiveGrams(d2));
      for (const g of dups)
        if (g1.has(g) || g2.has(g)) {
          affected.add(qi);
        }
    }
    log(`  regenerating ${affected.size} affected questions`);
    for (const qi of affected) {
      const q = ch.quiz.questions[qi];
      // pass dups as extraBans via the question call by augmenting the prompt directly
      const correct = q.choices[q.correctIndex];
      let extraBans = [...dups];
      let got = null;
      for (let a = 1; a <= MAX_ATTEMPTS_PER_QUESTION; a++) {
        try {
          const [d1, d2] = await callClaude({
            chapterTitle: title,
            prompt: q.prompt,
            correct,
            explanation: q.explanation,
            extraBans,
          });
          const v1 = validateDistractor(d1, correct, extraBans);
          const v2 = validateDistractor(d2, correct, extraBans);
          const cg = new Set(fiveGrams(correct));
          const g1 = new Set(fiveGrams(d1));
          let sAB = false,
            sAC = false,
            sBC = false;
          for (const g of fiveGrams(d2)) if (g1.has(g)) sAB = true;
          for (const g of fiveGrams(d1)) if (cg.has(g)) sAC = true;
          for (const g of fiveGrams(d2)) if (cg.has(g)) sBC = true;
          if (!v1 && !v2 && !sAB && !sAC && !sBC) {
            got = [d1, d2];
            break;
          }
        } catch (e) {
          log(`    redo Q${qi + 1} attempt ${a} error: ${e.message}`);
        }
      }
      if (!got) throw new Error(`Could not deduplicate Ch${chIndex + 1} Q${qi + 1}`);
      newPairs.set(qi, got);
    }
  }

  // write new distractors into the book (preserve correct slot)
  for (const [qi, [d1, d2]] of newPairs) {
    const q = ch.quiz.questions[qi];
    const ci = q.correctIndex;
    const newChoices = [null, null, null];
    newChoices[ci] = q.choices[ci];
    const slots = [0, 1, 2].filter((s) => s !== ci);
    newChoices[slots[0]] = d1;
    newChoices[slots[1]] = d2;
    q.choices = newChoices;
  }

  log(`  Ch${chIndex + 1} done`);
  return true;
}

async function main() {
  const book = JSON.parse(fs.readFileSync(BOOK_PATH, "utf-8"));
  console.log(`Loaded ${book.chapters.length} chapters. Range: Ch${START_CH}..Ch${END_CH}`);

  for (let ci = START_CH - 1; ci <= END_CH - 1; ci++) {
    const log = (msg) => console.log(msg);
    try {
      const changed = await processChapter(book, ci, log);
      if (changed) {
        fs.writeFileSync(BOOK_PATH, JSON.stringify(book, null, 2) + "\n");
        console.log(`  saved after Ch${ci + 1}`);
      }
    } catch (e) {
      console.error(`Ch${ci + 1} FAILED: ${e.message}`);
      console.error(e.stack);
      process.exit(2);
    }
  }
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
