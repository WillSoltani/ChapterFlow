/**
 * Writer — quiz.
 *
 * Produces a chapter's quiz (typically 6–12 multiple-choice application
 * questions). Respects ChapterDesignDoc.quizFocus exactly: count, Bloom's mix,
 * transferEmphasis. Outputs canonical Bloom's and depth enums.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { callClaude } from "../claudeClient.js";
import { renderUntrustedSourceBlock } from "../providers/types.js";
import { BookBrief, ChapterDesignDoc, SourceAnchorForPrompt } from "../types.js";
import { BreakdownOutput } from "./writer-breakdown.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = resolve(__dirname, "../../prompts");

export type QuizOutput = {
  passingScorePercent: number;
  questions: Array<{
    questionId: string;
    sourceAnchorId?: string;
    sourceAnchorIds?: string[];
    keyEvidenceAnchorIds?: string[];
    prompt: string;
    choices: string[];
    correctIndex: number;
    explanation: string;
    bloomsLevel: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
    depthLevel: "simple" | "standard" | "deep";
  }>;
};

export type QuizInput = {
  brief: BookBrief;
  plan: ChapterDesignDoc;
  breakdown: BreakdownOutput;
  sourceAnchors?: SourceAnchorForPrompt[];
};

export async function runWriterQuiz(input: QuizInput): Promise<QuizOutput> {
  const systemPrompt = readFileSync(
    resolve(PROMPTS_DIR, "writer-quiz.system.md"),
    "utf8",
  );
  const userPrompt = buildUserPrompt(input);

  let attempt = 0;
  let lastErr: Error | null = null;
  while (attempt < 3) {
    attempt += 1;
    try {
      const reasons = lastErr
        ? lastErr.message.replace(/^quiz invalid:\s*/, "- ").replace(/;\s*/g, "\n- ")
        : "";
      const retryUser =
        attempt === 1
          ? userPrompt
          : [
              userPrompt,
              "",
              "# Your previous draft was rejected by the validator.",
              "Reasons:",
              reasons,
              "",
              "Rewrite the QuizOutput JSON. Every question must have exactly 3 choices. Each prompt asks the reader to apply the idea to a new situation; do not pose questions about a written artifact. Speak to the reader.",
              "CRITICAL: Distribute correctIndex values evenly — each position (0, 1, 2) must appear in roughly one-third of questions. No single position may appear in more than 50% of questions. Before writing, plan out your correctIndex sequence explicitly (e.g. 0,2,1,0,2,1,...) and stick to it.",
              "CRITICAL: The correct answer must not be more than 2× the average length of the two distractors. Write distractors that are substantive competing answers a thoughtful but mistaken person might choose — not one-word dismissals or obvious caricatures.",
              "CRITICAL: No more than 6 of 9 questions may start with 'A ' or 'An '. Use varied openers: conditional setup ('When a manager…'), direct principle question ('Which test best reveals…'), second-person ('Your team…'), or claim to evaluate ('A colleague argues…').",
            ].join("\n");
      const result = await callClaude<QuizOutput>({
        tier: "writer",
        stage: "writer-quiz",
        bookId: input.brief.bookId,
        chapterId: input.plan.chapterId,
        system: systemPrompt,
        user: retryUser,
        maxTokens: 6000,
        temperature: 0.55,
        jsonMode: true,
        timeoutMs: 360_000,
      });
      return validateQuiz(result.content, input);
    } catch (err) {
      lastErr = err as Error;
    }
  }
  throw lastErr ?? new Error("quiz writer failed after retries");
}

function buildUserPrompt(input: QuizInput): string {
  const parts: string[] = [];
  parts.push(`# Book brief`);
  parts.push("```json");
  parts.push(JSON.stringify(input.brief, null, 2));
  parts.push("```");
  parts.push("");
  parts.push(`# Chapter design doc`);
  parts.push("```json");
  parts.push(JSON.stringify(input.plan, null, 2));
  parts.push("```");
  parts.push("");
  parts.push(`# Chapter breakdown (for grounding — DO NOT quote or narrate)`);
  parts.push("## fastRead");
  parts.push(input.breakdown.fastRead);
  parts.push("## deepRead");
  parts.push(input.breakdown.deepRead);
  parts.push("");
  if (input.sourceAnchors && input.sourceAnchors.length > 0) {
    parts.push(renderUntrustedSourceBlock("Allowed source anchors", JSON.stringify(input.sourceAnchors, null, 2), "json"));
    parts.push("Use only these ids. Emit sourceAnchorIds and keyEvidenceAnchorIds for every question; keyEvidenceAnchorIds must identify the fact/framework that makes the correct answer true.");
    parts.push("");
  }
  parts.push(`Write the QuizOutput JSON now. Count must equal ${input.plan.quizFocus.count}. Bloom's mix must match ${JSON.stringify(input.plan.quizFocus.bloomsMix)} exactly. Balance correctIndex across positions 0, 1, 2.`);
  return parts.join("\n");
}

const CANONICAL_BLOOMS = new Set(["remember","understand","apply","analyze","evaluate","create"]);
const CANONICAL_DEPTH = new Set(["simple","standard","deep"]);

const STRAWMAN_TRIGGER = /\b(always|never|automatically|impossible|guaranteed|entirely|ever|forever|completely|wholly|absolutely|under no circumstances|in all cases)\b/i;

// AS1 / AS2 / AS3 — anti-salting patterns. Catches the May 2026 Covey incident
// where an agent inserted unique identifier-like tokens / jammed proper nouns /
// doubled periods into user-facing fields to evade cross-chapter n-gram audits.
const IDENTIFIER_TOKEN_PATTERN = /\b(q\d{1,3}|p\d{1,3}|ex\d{1,3}|c\d{1,3}|card\d{1,3}|chapter\d{1,3})\b/i;
const JAMMED_NOUN_PATTERN = /\b[A-Z][a-z]{3,}[A-Z][a-z]{3,}\b/;
const DOUBLED_PERIOD_PATTERN = /\w\.\.\s+[A-Z]/;
const ALLOWED_QUESTION_KEYS = new Set([
  "questionId","sourceAnchorId","sourceAnchorIds","keyEvidenceAnchorIds","prompt","choices","correctIndex","correctAnswerIndex","explanation","bloomsLevel","depthLevel",
]);
const VERB_HINT = /\b(is|are|was|were|be|been|being|has|have|had|do|does|did|can|could|should|would|will|may|might|must|name|build|cut|add|delete|remove|stop|start|run|pause|wait|trust|review|reset|reroute|track|set|map|check|read|write|ask|tell|listen|use|apply|treat|test|show|prove|reduce|increase|require|create|allow|prevent|enable|involve|describe|mean|reflect|indicate|imply|produce|stem|come|happen|occur|signal|aggregate|average|weight|filter|combine|compare|see|find|know|understand|expect|predict|forecast|estimate|interpret|choose|select|decide|consider|note|claim|argue|assert|deny|accept|reject|hold|prefer|favor|advise|recommend|lead|drive|influence|affect|change|shift|move|raise|lower|grow|shrink|focus|skip|cancel|withdraw|hand|devote)\b/i;
const QUIZ_BANNED_TAILS: ReadonlyArray<string> = [
  "fits the immediate pressure around",
  "could make that choice seem workable",
  "gives that route a concrete rationale",
  "making the tradeoff feel defensible",
  "looks persuasive because the recent evidence is tidy",
  "while preserving the spirit of the original",
  "without disrupting the broader workflow",
  "given the constraints in play",
  "based on the available signal",
  "until the team feels more certain",
  "delay the decision so",
  "keep the old message for now",
  "so the team does not lose energy",
  "answer every visible request first",
  "ranking would make action impossible",
  "it proves easy tasks never matter",
];

function validateQuiz(q: QuizOutput, input: QuizInput): QuizOutput {
  const problems: string[] = [];
  if (!q || typeof q !== "object") throw new Error("quiz writer returned non-object");
  if (typeof q.passingScorePercent !== "number") q.passingScorePercent = 70;
  if (!Array.isArray(q.questions)) problems.push("questions missing");

  const expectedCount = input.plan.quizFocus.count;
  if (q.questions.length !== expectedCount) {
    problems.push(`question count ${q.questions.length} != expected ${expectedCount}`);
  }

  // Defense in depth: ship gate also catches these, but failing here forces
  // the writer's retry loop to fire instead of quarantining post-assembly.
  const metaRegexes = [
    /\bthis chapter\b/i,
    /\bthe chapter\b/i,
    /\bthe author\b/i,
    /\bthe book\b/i,
    /\bin this (chapter|section|book|law)\b/i,
    /\bchapter\s+\d+\b/,
  ];

  // Questions: canonical enums, position bounds, choice count
  for (const [i, question] of q.questions.entries()) {
    if (!question.prompt || question.prompt.length < 30) problems.push(`q${i} prompt too short`);
    if (!Array.isArray(question.choices) || question.choices.length !== 3) {
      problems.push(`q${i} must have exactly 3 choices (got ${question.choices?.length})`);
    }
    if (question.correctIndex < 0 || question.correctIndex > 2) {
      problems.push(`q${i} correctIndex out of range`);
    }
    if (!CANONICAL_BLOOMS.has(question.bloomsLevel)) {
      problems.push(`q${i} non-canonical bloomsLevel "${question.bloomsLevel}"`);
    }
    if (!CANONICAL_DEPTH.has(question.depthLevel)) {
      problems.push(`q${i} non-canonical depthLevel "${question.depthLevel}"`);
    }
    if (!question.explanation || question.explanation.length < 80) {
      problems.push(`q${i} explanation too short (${question.explanation?.length})`);
    }
    const qFullText = `${question.prompt} ${(question.choices ?? []).join(" ")} ${question.explanation ?? ""}`;
    for (const re of metaRegexes) {
      const m = qFullText.match(re);
      if (m) {
        problems.push(`q${i} contains meta-reference "${m[0]}"`);
        break;
      }
    }
    // Strawman trigger in any non-correct distractor.
    if (Array.isArray(question.choices) && question.choices.length === 3 && question.correctIndex >= 0 && question.correctIndex < 3) {
      for (let ci = 0; ci < question.choices.length; ci++) {
        if (ci === question.correctIndex) continue;
        const m = question.choices[ci]?.match(STRAWMAN_TRIGGER);
        if (m) {
          problems.push(`q${i} choice[${ci}] uses absolute trigger "${m[0]}" — rewrite as a scenario-anchored wrong-but-plausible claim`);
          break;
        }
      }
    }
    // In-question duplicate choices.
    if (Array.isArray(question.choices)) {
      const seen = new Set<string>();
      for (let ci = 0; ci < question.choices.length; ci++) {
        const norm = question.choices[ci]?.toLowerCase().trim();
        if (!norm) continue;
        if (seen.has(norm)) {
          problems.push(`q${i} choice[${ci}] duplicates a prior choice`);
          break;
        }
        seen.add(norm);
      }
    }
    // Lowercase choice start.
    if (Array.isArray(question.choices)) {
      for (let ci = 0; ci < question.choices.length; ci++) {
        const c = question.choices[ci] ?? "";
        const trimmed = c.replace(/^[\s"'“‘«\[]+/, "");
        if (trimmed && /[a-z]/.test(trimmed.charAt(0))) {
          problems.push(`q${i} choice[${ci}] starts lowercase`);
          break;
        }
      }
    }
    // Banned tail-clause template.
    {
      const all = qFullText.toLowerCase();
      for (const banned of QUIZ_BANNED_TAILS) {
        if (all.includes(banned)) {
          problems.push(`q${i} contains banned distractor template "${banned}"`);
          break;
        }
      }
    }
    // AS1 — identifier-token injection ("q7", "ex01", "p2") in prose.
    {
      const idMatch = qFullText.match(IDENTIFIER_TOKEN_PATTERN);
      if (idMatch) {
        problems.push(`q${i} contains identifier-like token "${idMatch[0]}" inside prose. This is salting to evade n-gram critics. Rewrite the prompt/choice/explanation as natural English without identifier tokens.`);
      }
    }
    // AS2 — jammed proper nouns ("MaplefieldBridgeton").
    {
      const jamMatch = qFullText.match(JAMMED_NOUN_PATTERN);
      if (jamMatch) {
        problems.push(`q${i} contains jammed proper nouns "${jamMatch[0]}". Two capitalized words mashed without a space. Rewrite as separate words.`);
      }
    }
    // AS3 — doubled period followed by capital letter.
    {
      const ddMatch = qFullText.match(DOUBLED_PERIOD_PATTERN);
      if (ddMatch) {
        problems.push(`q${i} contains doubled period "${ddMatch[0]}" — generation parse error or sentence-boundary salting. Replace with a single period.`);
      }
    }
    // Unexpected fields beyond the allowed quiz-question shape.
    for (const key of Object.keys(question)) {
      if (!ALLOWED_QUESTION_KEYS.has(key)) {
        problems.push(`q${i} carries unexpected field "${key}" — upstream validator returns 422`);
        break;
      }
    }
    if (input.sourceAnchors && input.sourceAnchors.length > 0) {
      const allowed = new Set(input.sourceAnchors.map((anchor) => anchor.id));
      const ids = question.sourceAnchorIds ?? (question.sourceAnchorId ? [question.sourceAnchorId] : []);
      const keyIds = question.keyEvidenceAnchorIds ?? ids;
      if (ids.length === 0) {
        problems.push(`q${i} sourceAnchorIds must cite at least one allowed source anchor`);
      }
      if (keyIds.length === 0) {
        problems.push(`q${i} keyEvidenceAnchorIds must cite the source fact/framework that supports the correct key`);
      }
      for (const id of [...ids, ...keyIds]) {
        if (typeof id !== "string" || !allowed.has(id)) problems.push(`q${i} cites unsupported source anchor ${JSON.stringify(id)}`);
      }
      if (!question.sourceAnchorId && ids[0]) question.sourceAnchorId = ids[0];
      if (!question.sourceAnchorIds && ids.length > 0) question.sourceAnchorIds = ids;
      if (!question.keyEvidenceAnchorIds && keyIds.length > 0) question.keyEvidenceAnchorIds = keyIds;
    }
    // enforce questionId format
    question.questionId = `q${String(i + 1).padStart(2, "0")}`;
  }

  // Bloom's mix: allow small deviation (±1 per level) to give the writer room
  if (input.plan.quizFocus.bloomsMix) {
    const actual: Record<string, number> = {};
    for (const qq of q.questions) actual[qq.bloomsLevel] = (actual[qq.bloomsLevel] ?? 0) + 1;
    for (const [level, expected] of Object.entries(input.plan.quizFocus.bloomsMix)) {
      const got = actual[level] ?? 0;
      if (Math.abs(got - (expected as number)) > 1) {
        problems.push(`bloom level "${level}" expected ${expected}, got ${got}`);
      }
    }
  }

  // Answer-position distribution
  const posCounts = [0, 0, 0];
  for (const qq of q.questions) posCounts[qq.correctIndex] += 1;
  const total = q.questions.length;
  if (total >= 4) {
    const maxFrac = Math.max(...posCounts) / total;
    if (maxFrac > 0.5) {
      problems.push(`correctIndex position ${posCounts.indexOf(Math.max(...posCounts))} wins ${(maxFrac * 100).toFixed(0)}% (max 50%)`);
    }
  }

  // Answer length ratio (word-count based, matching the gate critic).
  // ≥ 2.0 = blocker class; ≥ 1.5 = flagged; target < 1.4.
  for (const [i, question] of q.questions.entries()) {
    if (!Array.isArray(question.choices) || question.choices.length !== 3) continue;
    if (question.correctIndex < 0 || question.correctIndex > 2) continue;
    const cWc = (question.choices[question.correctIndex] ?? "").split(/\s+/).filter(Boolean).length;
    const dWcs = question.choices.filter((_, j) => j !== question.correctIndex)
      .map((c) => (c ?? "").split(/\s+/).filter(Boolean).length);
    const dAvg = dWcs.reduce((a, b) => a + b, 0) / Math.max(1, dWcs.length);
    if (dAvg > 0 && cWc / dAvg >= 1.5) {
      problems.push(`q${i} correct answer is ${(cWc / dAvg).toFixed(2)}× the average distractor length (${cWc}w vs ${dAvg.toFixed(1)}w avg, target <1.4) — shorten correct choice or expand distractors with scenario-specific content`);
    }
  }

  // Label-shaped correct answer: ≤6 words and no verb-hint.
  for (const [i, question] of q.questions.entries()) {
    if (!Array.isArray(question.choices) || question.choices.length !== 3) continue;
    if (question.correctIndex < 0 || question.correctIndex > 2) continue;
    const correct = question.choices[question.correctIndex] ?? "";
    const wc = correct.split(/\s+/).filter(Boolean).length;
    if (wc <= 6 && !VERB_HINT.test(correct)) {
      problems.push(`q${i} correct answer "${correct}" is ${wc} words and label-shaped (no verb) — expand to an action sentence`);
    }
  }

  // Opener lock: no more than 5 of 9 questions may start with "A " or "An " (matches BP17 threshold).
  const aAnCount = q.questions.filter((qq) => /^An? [A-Z]/.test(qq.prompt ?? "")).length;
  if (q.questions.length >= 7) {
    const threshold = Math.ceil(q.questions.length * (5 / 9));
    if (aAnCount > threshold) {
      problems.push(`${aAnCount} of ${q.questions.length} questions start with "A/An…" (max ${threshold}) — vary openers with conditional ("When a manager…"), second-person ("Your team…"), or claim-evaluation ("A colleague argues…")`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`quiz invalid: ${problems.join("; ")}`);
  }
  return q;
}
