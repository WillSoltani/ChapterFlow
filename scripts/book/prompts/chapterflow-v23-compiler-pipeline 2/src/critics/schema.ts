/**
 * Schema critics — enforce canonical enum values and distribution constraints
 * that were left unchecked in v13 (Bloom's-level vocabulary chaos, 53/38/9
 * answer-position bias).
 */

import { Chapter, CriticFinding, Quiz, QuizQuestion } from "../types.js";
import { finding } from "./shared.js";

const CANONICAL_BLOOMS = new Set([
  "remember", "understand", "apply", "analyze", "evaluate", "create",
]);

const CANONICAL_DEPTH = new Set(["simple", "standard", "deep"]);

/** Normalize a Bloom's-level string to its canonical form. Returns null if not
 *  recoverable. Used by critics AND repair tooling. */
export function normalizeBloomsLevel(raw: string | undefined): string | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (CANONICAL_BLOOMS.has(lower)) return lower;

  // Compound tokens like "apply-analyze", "apply_analyze" → pick the highest Bloom's level.
  const parts = lower.split(/[-_]+/).filter(Boolean);
  const order = ["remember", "understand", "apply", "analyze", "evaluate", "create"];
  let best = -1;
  for (const p of parts) {
    if (CANONICAL_BLOOMS.has(p)) {
      const idx = order.indexOf(p);
      if (idx > best) best = idx;
    }
  }
  if (best >= 0) return order[best];

  // Synonyms the generator used
  const synonyms: Record<string, string> = {
    "recall": "remember",
    "recognize": "remember",
    "comprehend": "understand",
    "explain": "understand",
    "transfer": "apply",
    "predict": "evaluate",
    "connect": "analyze",
    "connect-transfer": "analyze",
    "distinguish": "analyze",
  };
  if (synonyms[lower]) return synonyms[lower];
  return null;
}

export function normalizeDepthLevel(raw: string | undefined): string | null {
  if (!raw) return null;
  const lower = raw.trim().toLowerCase();
  if (CANONICAL_DEPTH.has(lower)) return lower;
  const synonyms: Record<string, string> = {
    "easy": "simple",
    "medium": "standard",
    "moderate": "standard",
    "hard": "deep",
    "deeper": "deep",
    "applied": "deep",
    "advanced": "deep",
    "core": "standard",
    "complex": "deep",
    "challenging": "deep",
    "reflective": "deep",
  };
  return synonyms[lower] ?? null;
}

export function checkEnumValidity(q: QuizQuestion): CriticFinding[] {
  const findings: CriticFinding[] = [];
  if (!q.bloomsLevel) {
    findings.push(
      finding(
        "schema.enum_validity",
        "blocker",
        "quiz question missing bloomsLevel",
      ),
    );
  } else if (typeof q.bloomsLevel !== "string") {
    // A non-string bloomsLevel (codex JSON slip: a number/object) would throw on
    // .toLowerCase() below and crash the whole ship gate (→ finalize/qc-converge).
    // Emit a finding instead of crashing.
    findings.push(
      finding(
        "schema.enum_validity",
        "blocker",
        `bloomsLevel must be a string (got ${typeof q.bloomsLevel})`,
      ),
    );
  } else if (!CANONICAL_BLOOMS.has(q.bloomsLevel.toLowerCase())) {
    const normalized = normalizeBloomsLevel(q.bloomsLevel);
    findings.push(
      finding(
        "schema.bloom_vocabulary",
        "blocker",
        `non-canonical bloomsLevel "${q.bloomsLevel}"${normalized ? ` (should normalize to "${normalized}")` : " (unrecoverable)"}`,
      ),
    );
  }

  if (q.depthLevel != null && typeof q.depthLevel !== "string") {
    findings.push(
      finding(
        "schema.enum_validity",
        "major",
        `depthLevel must be a string (got ${typeof q.depthLevel})`,
      ),
    );
  } else if (q.depthLevel && !CANONICAL_DEPTH.has(q.depthLevel.toLowerCase())) {
    const normalized = normalizeDepthLevel(q.depthLevel);
    findings.push(
      finding(
        "schema.enum_validity",
        "major",
        `non-canonical depthLevel "${q.depthLevel}"${normalized ? ` (should normalize to "${normalized}")` : ""}`,
      ),
    );
  }
  return findings;
}

/** Quiz-level distribution check. Called once per chapter quiz, not per
 *  question. Returns a single finding on the chapter if answer positions are
 *  skewed. */
export function checkAnswerPositionBalance(
  quiz: Quiz | undefined,
  chapterNumber: number,
): CriticFinding[] {
  if (!quiz || !quiz.questions || quiz.questions.length < 4) return [];
  const counts = new Map<number, number>();
  for (const q of quiz.questions) {
    const ci = typeof q.correctIndex === "number" ? q.correctIndex : q.correctAnswerIndex;
    if (typeof ci !== "number") continue;
    counts.set(ci, (counts.get(ci) ?? 0) + 1);
  }
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  const findings: CriticFinding[] = [];
  const maxCount = Math.max(...counts.values());
  const maxFrac = maxCount / total;
  if (maxFrac > 0.5) {
    findings.push(
      finding(
        "schema.answer_position_balance",
        "major",
        `quiz answer-position skew: idx ${dominantIdx(counts)} wins ${(maxFrac * 100).toFixed(0)}% (max 50%)`,
      ),
    );
  }
  return findings;
}

function dominantIdx(counts: Map<number, number>): number {
  let best = -1;
  let bestCount = -1;
  for (const [idx, c] of counts) {
    if (c > bestCount) {
      bestCount = c;
      best = idx;
    }
  }
  return best;
}
