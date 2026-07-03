import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { normalizeAnyPackage } from "./book-package-core";

/**
 * WS1 / K4 — permanent app-contract safety net for the slim distribution package.
 *
 * Reads EVERY shipped `book-packages/*.v21.json` from disk (the exact bytes the
 * client bundles and that get uploaded to S3) and asserts, for each:
 *   - top-level `schemaVersion === "chapterflow-v21-authored"` — its absence
 *     silently misroutes the package to the legacy v13 normalizer (empty reader,
 *     the worst failure mode);
 *   - it normalizes through the CLIENT adapter to 3 non-empty breakdown tiers +
 *     a quiz-integrity-clean shape (correctIndex in range, ≥2 choices, unique
 *     ids, passingScorePercent 50–100 when present);
 *   - NONE of the forbidden non-reader fields appears anywhere DEEP (the K3
 *     PPKG.forbidden_field list): the package must carry reader content only.
 *
 * This test is the safety net for the K5 catalog sweep and for every future
 * publish. It uses the same disk-read + client-adapter pattern as
 * bookPackages.test.ts (no server-only import chain).
 */

const PACKAGES_DIR = join(process.cwd(), "book-packages");
const V21_SCHEMA = "chapterflow-v21-authored";

/** Forbidden deep key-names — mirror src/.../verifyProductionPackage.ts K3 set. */
const FORBIDDEN_DEEP = new Set([
  "productionManifest",
  "authoring",
  "planSpec",
  "namedCaseIds",
  "sourceFactIds",
  "depthLevel",
]);
const FORBIDDEN_SOURCE_ANCHOR_RE = /SourceAnchorIds?$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** First forbidden field (deep name OR path-aware chapter internal) found, or null. */
function firstForbiddenField(value: unknown, insideChapter = false): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = firstForbiddenField(item, insideChapter);
      if (hit) return hit;
    }
    return null;
  }
  if (isObject(value)) {
    // Path-aware chapter internals: a chapter object is one carrying a chapterId.
    if (typeof value.chapterId === "string") {
      if ("schemaVersion" in value) return "per-chapter schemaVersion";
      if (isObject(value.implementationPlan) && "title" in value.implementationPlan) return "implementationPlan.title";
      if (Array.isArray(value.memorableLines)) {
        for (const line of value.memorableLines) {
          if (isObject(line) && "location" in line) return "memorableLines[].location";
          if (isObject(line) && "why" in line) return "memorableLines[].why";
        }
      }
    }
    for (const [k, child] of Object.entries(value)) {
      if (FORBIDDEN_DEEP.has(k)) return k;
      if (FORBIDDEN_SOURCE_ANCHOR_RE.test(k)) return k;
      const hit = firstForbiddenField(child, insideChapter);
      if (hit) return hit;
    }
  }
  return null;
}

type Loaded = { file: string; raw: Record<string, unknown> };

function loadV21Packages(): Loaded[] {
  const files = readdirSync(PACKAGES_DIR).filter((f) => f.endsWith(".v21.json")).sort();
  const out: Loaded[] = [];
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(PACKAGES_DIR, file), "utf8")) as Record<string, unknown>;
    out.push({ file, raw });
  }
  return out;
}

const PACKAGES = loadV21Packages();

test("there is at least one shipped v21 package to check", () => {
  assert.ok(PACKAGES.length > 0, "no book-packages/*.v21.json found");
});

for (const { file, raw } of PACKAGES) {
  test(`${file}: top-level schemaVersion is exactly ${V21_SCHEMA}`, () => {
    assert.equal(
      raw.schemaVersion,
      V21_SCHEMA,
      `${file} is missing/incorrect top-level schemaVersion — it would silently normalize as a legacy v13 package and render an empty reader`,
    );
  });

  test(`${file}: carries NO forbidden non-reader field (deep) — reader content only`, () => {
    const hit = firstForbiddenField(raw);
    assert.equal(hit, null, `${file} contains forbidden non-reader field ${JSON.stringify(hit)} — the distribution package must carry reader content only`);
  });

  test(`${file}: normalizes through the client adapter to 3 non-empty tiers + a quiz-integrity-clean shape`, () => {
    const norm = normalizeAnyPackage(raw, "direct") as {
      chapters: Array<{
        chapterId?: string;
        number?: number;
        contentVariants?: Record<string, unknown>;
        quiz?: { passingScorePercent?: number; questions?: Array<{ questionId?: string; choices?: unknown[]; correctIndex?: number }> };
      }>;
    };
    assert.ok(Array.isArray(norm.chapters) && norm.chapters.length > 0, `${file}: no chapters after normalize`);

    const chapterIds = new Set<string>();
    const chapterNumbers = new Set<number>();
    for (const ch of norm.chapters) {
      // 3 non-empty breakdown tiers (fastRead/deepRead/fullRead → easy/medium/hard).
      const variants = ch.contentVariants ?? {};
      for (const tier of ["easy", "medium", "hard"] as const) {
        assert.ok(variants[tier], `${file} ch${ch.number}: missing non-empty "${tier}" breakdown tier`);
      }
      // Unique chapter ids + numbers.
      if (typeof ch.chapterId === "string") {
        assert.ok(!chapterIds.has(ch.chapterId), `${file}: duplicate chapterId ${ch.chapterId}`);
        chapterIds.add(ch.chapterId);
      }
      if (typeof ch.number === "number") {
        assert.ok(!chapterNumbers.has(ch.number), `${file}: duplicate chapter number ${ch.number}`);
        chapterNumbers.add(ch.number);
      }

      const quiz = ch.quiz;
      assert.ok(quiz, `${file} ch${ch.number}: no quiz`);
      if (typeof quiz!.passingScorePercent === "number") {
        assert.ok(
          quiz!.passingScorePercent >= 50 && quiz!.passingScorePercent <= 100,
          `${file} ch${ch.number}: passingScorePercent ${quiz!.passingScorePercent} out of 50–100`,
        );
      }
      const questions = quiz!.questions ?? [];
      assert.ok(questions.length > 0, `${file} ch${ch.number}: no quiz questions`);
      const questionIds = new Set<string>();
      for (const q of questions) {
        assert.ok(Array.isArray(q.choices) && q.choices.length >= 2, `${file} ch${ch.number} q${q.questionId}: fewer than 2 choices`);
        assert.ok(
          typeof q.correctIndex === "number" && q.correctIndex >= 0 && q.correctIndex < (q.choices as unknown[]).length,
          `${file} ch${ch.number} q${q.questionId}: correctIndex ${q.correctIndex} out of range (choices ${(q.choices as unknown[])?.length})`,
        );
        if (typeof q.questionId === "string") {
          assert.ok(!questionIds.has(q.questionId), `${file} ch${ch.number}: duplicate questionId ${q.questionId}`);
          questionIds.add(q.questionId);
        }
      }
    }
  });

  test(`${file}: raw exampleIds are unique within each chapter`, () => {
    const chapters = Array.isArray(raw.chapters) ? (raw.chapters as Array<Record<string, unknown>>) : [];
    for (const ch of chapters) {
      const examples = Array.isArray(ch.examples) ? (ch.examples as Array<Record<string, unknown>>) : [];
      const ids = new Set<string>();
      for (const ex of examples) {
        if (typeof ex.exampleId === "string") {
          assert.ok(!ids.has(ex.exampleId), `${file}: duplicate exampleId ${ex.exampleId} in chapter ${ch.number}`);
          ids.add(ex.exampleId);
        }
      }
    }
  });
}
