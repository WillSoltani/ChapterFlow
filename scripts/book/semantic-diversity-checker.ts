/**
 * Semantic Diversity Checker
 *
 * Checks three dimensions of content diversity in structured chapter JSON:
 *   (a) Scenario diversity within each chapter (reject if any pair too similar)
 *   (b) Tone substance verification (reject if tone variants are cosmetic swaps)
 *   (c) Cross-chapter opener uniqueness (reject if openers repeat across chapters)
 *
 * Uses token-based Jaccard + n-gram overlap as a fast, embedding-free proxy.
 * Can be extended with real embeddings (OpenAI, Cohere, etc.) by replacing
 * the similarity function.
 *
 * Usage:
 *   npx tsx scripts/book/semantic-diversity-checker.ts <chapter.json|book-package.json> [--output-dir <dir>]
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve, basename } from "path";

// ── Types ────────────────────────────────────────────────────────────────────

type ToneKeyed = { gentle: string; direct: string; competitive: string };

type Example = {
  exampleId: string;
  title: string;
  scenario: string | ToneKeyed;
  whatToDo: string[] | ToneKeyed;
  whyItMatters: string | ToneKeyed;
};

type ContentVariant = {
  chapterBreakdown?: ToneKeyed;
  keyTakeaways?: Array<{ point: ToneKeyed; moreDetails?: ToneKeyed }>;
  oneMinuteRecap?: ToneKeyed | { retrieve?: ToneKeyed; connect?: ToneKeyed; preview?: ToneKeyed };
};

type Chapter = {
  chapterId: string;
  number: number;
  title: string;
  contentVariants: Record<string, ContentVariant>;
  examples: Example[];
};

type BookPackage = {
  book?: { bookId?: string };
  chapters: Chapter[];
};

// ── Thresholds ───────────────────────────────────────────────────────────────

const SCENARIO_MAX_SIMILARITY = 0.85;
const TONE_MAX_SIMILARITY = 0.95;
const TONE_MIN_SIMILARITY = 0.55;
const OPENER_MAX_SIMILARITY = 0.80;

// ── Similarity Engine ────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function bigrams(tokens: string[]): Set<string> {
  const bg = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i++) {
    bg.add(`${tokens[i]}_${tokens[i + 1]}`);
  }
  return bg;
}

function jaccardOverBigrams(a: string, b: string): number {
  const tokA = tokenize(a);
  const tokB = tokenize(b);
  const bgA = bigrams(tokA);
  const bgB = bigrams(tokB);

  if (bgA.size === 0 && bgB.size === 0) {
    const setA = new Set(tokA);
    const setB = new Set(tokB);
    const inter = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : inter.size / union.size;
  }

  const inter = new Set([...bgA].filter((x) => bgB.has(x)));
  const union = new Set([...bgA, ...bgB]);
  return union.size === 0 ? 0 : inter.size / union.size;
}

function similarity(a: string, b: string): number {
  const tokenJaccard = (() => {
    const setA = new Set(tokenize(a));
    const setB = new Set(tokenize(b));
    const inter = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : inter.size / union.size;
  })();

  const bigramJaccard = jaccardOverBigrams(a, b);

  // Weighted blend: bigrams catch phrasing similarity, tokens catch topic similarity
  return 0.4 * tokenJaccard + 0.6 * bigramJaccard;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractScenarioText(scenario: string | ToneKeyed): string {
  if (typeof scenario === "string") return scenario;
  return scenario.direct || scenario.gentle || scenario.competitive || "";
}

function extractToneTexts(tk: ToneKeyed): { gentle: string; direct: string; competitive: string } {
  return { gentle: tk.gentle || "", direct: tk.direct || "", competitive: tk.competitive || "" };
}

function firstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : text.slice(0, 120).trim();
}

// ── Check Types ──────────────────────────────────────────────────────────────

type Violation = {
  check: "scenario_diversity" | "tone_substance" | "opener_uniqueness";
  chapterNumber: number;
  chapterNumber2?: number;
  field?: string;
  pair?: [string, string];
  similarity: number;
  threshold: number;
  message: string;
};

type DiversityReport = {
  filePath: string;
  chapterCount: number;
  passed: boolean;
  violations: Violation[];
  summary: {
    scenarioDiversity: { checked: number; violations: number };
    toneSubstance: { checked: number; violations: number };
    openerUniqueness: { checked: number; violations: number };
  };
};

// ── Check (a): Scenario Diversity ────────────────────────────────────────────

function checkScenarioDiversity(chapter: Chapter): Violation[] {
  const violations: Violation[] = [];
  const scenarios = chapter.examples.map((ex) => ({
    id: ex.exampleId,
    text: extractScenarioText(ex.scenario),
  }));

  for (let i = 0; i < scenarios.length; i++) {
    for (let j = i + 1; j < scenarios.length; j++) {
      const sim = similarity(scenarios[i].text, scenarios[j].text);
      if (sim > SCENARIO_MAX_SIMILARITY) {
        violations.push({
          check: "scenario_diversity",
          chapterNumber: chapter.number,
          pair: [scenarios[i].id, scenarios[j].id],
          similarity: Math.round(sim * 100) / 100,
          threshold: SCENARIO_MAX_SIMILARITY,
          message: `Scenarios "${scenarios[i].id}" and "${scenarios[j].id}" are too similar (${(sim * 100).toFixed(0)}% > ${SCENARIO_MAX_SIMILARITY * 100}%)`,
        });
      }
    }
  }

  return violations;
}

// ── Check (b): Tone Substance ────────────────────────────────────────────────

function checkToneSubstance(chapter: Chapter): Violation[] {
  const violations: Violation[] = [];

  for (const [variantKey, variant] of Object.entries(chapter.contentVariants)) {
    const toneFields: Array<{ field: string; toneKeyed: ToneKeyed }> = [];

    if (variant.chapterBreakdown) {
      toneFields.push({ field: `${variantKey}.chapterBreakdown`, toneKeyed: variant.chapterBreakdown });
    }

    if (variant.keyTakeaways) {
      variant.keyTakeaways.forEach((kt, idx) => {
        toneFields.push({ field: `${variantKey}.keyTakeaways[${idx}].point`, toneKeyed: kt.point });
      });
    }

    for (const { field, toneKeyed } of toneFields) {
      const tones = extractToneTexts(toneKeyed);
      const pairs: Array<[string, string, string, string]> = [
        ["gentle", tones.gentle, "direct", tones.direct],
        ["gentle", tones.gentle, "competitive", tones.competitive],
        ["direct", tones.direct, "competitive", tones.competitive],
      ];

      for (const [nameA, textA, nameB, textB] of pairs) {
        if (!textA || !textB) continue;
        const sim = similarity(textA, textB);

        if (sim > TONE_MAX_SIMILARITY) {
          violations.push({
            check: "tone_substance",
            chapterNumber: chapter.number,
            field,
            pair: [nameA, nameB],
            similarity: Math.round(sim * 100) / 100,
            threshold: TONE_MAX_SIMILARITY,
            message: `Tone "${nameA}" and "${nameB}" in ${field} are cosmetically similar (${(sim * 100).toFixed(0)}% > ${TONE_MAX_SIMILARITY * 100}%) — adjective swap, not real tone shift`,
          });
        }

        if (sim < TONE_MIN_SIMILARITY) {
          violations.push({
            check: "tone_substance",
            chapterNumber: chapter.number,
            field,
            pair: [nameA, nameB],
            similarity: Math.round(sim * 100) / 100,
            threshold: TONE_MIN_SIMILARITY,
            message: `Tone "${nameA}" and "${nameB}" in ${field} diverge too much (${(sim * 100).toFixed(0)}% < ${TONE_MIN_SIMILARITY * 100}%) — tones may contradict each other`,
          });
        }
      }
    }
  }

  return violations;
}

// ── Check (c): Cross-Chapter Opener Uniqueness ───────────────────────────────

function checkOpenerUniqueness(chapters: Chapter[]): Violation[] {
  const violations: Violation[] = [];
  const tones = ["gentle", "direct", "competitive"] as const;

  for (const tone of tones) {
    const openers: Array<{ chapterNumber: number; text: string }> = [];

    for (const chapter of chapters) {
      for (const variant of Object.values(chapter.contentVariants)) {
        if (variant.chapterBreakdown) {
          const text = variant.chapterBreakdown[tone];
          if (text) {
            openers.push({ chapterNumber: chapter.number, text: firstSentence(text) });
          }
          break;
        }
      }
    }

    for (let i = 0; i < openers.length; i++) {
      for (let j = i + 1; j < openers.length; j++) {
        const sim = similarity(openers[i].text, openers[j].text);
        if (sim > OPENER_MAX_SIMILARITY) {
          violations.push({
            check: "opener_uniqueness",
            chapterNumber: openers[i].chapterNumber,
            chapterNumber2: openers[j].chapterNumber,
            field: `chapterBreakdown.${tone}`,
            similarity: Math.round(sim * 100) / 100,
            threshold: OPENER_MAX_SIMILARITY,
            message: `Ch${openers[i].chapterNumber} and Ch${openers[j].chapterNumber} ${tone} openers are too similar (${(sim * 100).toFixed(0)}% > ${OPENER_MAX_SIMILARITY * 100}%)`,
          });
        }
      }
    }
  }

  return violations;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function checkFile(filePath: string): DiversityReport {
  const raw = JSON.parse(readFileSync(filePath, "utf-8"));

  let chapters: Chapter[];
  if (Array.isArray(raw.chapters)) {
    chapters = raw.chapters;
  } else {
    chapters = [raw as Chapter];
  }

  const allViolations: Violation[] = [];
  let scenarioChecked = 0;
  let toneChecked = 0;

  for (const chapter of chapters) {
    const scenarioViolations = checkScenarioDiversity(chapter);
    const toneViolations = checkToneSubstance(chapter);
    allViolations.push(...scenarioViolations, ...toneViolations);
    scenarioChecked += chapter.examples.length;
    toneChecked += Object.keys(chapter.contentVariants).length;
  }

  const openerViolations = checkOpenerUniqueness(chapters);
  allViolations.push(...openerViolations);

  return {
    filePath,
    chapterCount: chapters.length,
    passed: allViolations.length === 0,
    violations: allViolations,
    summary: {
      scenarioDiversity: {
        checked: scenarioChecked,
        violations: allViolations.filter((v) => v.check === "scenario_diversity").length,
      },
      toneSubstance: {
        checked: toneChecked,
        violations: allViolations.filter((v) => v.check === "tone_substance").length,
      },
      openerUniqueness: {
        checked: chapters.length,
        violations: openerViolations.length,
      },
    },
  };
}

function main() {
  const args = process.argv.slice(2);
  const filePaths: string[] = [];
  let outputDir: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output-dir" && args[i + 1]) {
      outputDir = args[++i];
    } else {
      filePaths.push(args[i]);
    }
  }

  if (filePaths.length === 0) {
    console.error("Usage: npx tsx scripts/book/semantic-diversity-checker.ts <file.json> [--output-dir <dir>]");
    process.exit(1);
  }

  let allPassed = true;

  for (const fp of filePaths) {
    const resolved = resolve(fp);
    const report = checkFile(resolved);

    if (!report.passed) allPassed = false;

    const status = report.passed ? "PASS" : "FAIL";
    console.log(`\n── ${basename(resolved)} [${status}] ──`);
    console.log(`  Chapters: ${report.chapterCount}`);
    console.log(`  Scenario diversity: ${report.summary.scenarioDiversity.violations} violations / ${report.summary.scenarioDiversity.checked} scenarios`);
    console.log(`  Tone substance: ${report.summary.toneSubstance.violations} violations / ${report.summary.toneSubstance.checked} variants`);
    console.log(`  Opener uniqueness: ${report.summary.openerUniqueness.violations} violations / ${report.summary.openerUniqueness.checked} chapters`);

    for (const v of report.violations) {
      console.log(`  ✗ [${v.check}] Ch${v.chapterNumber}: ${v.message}`);
    }

    if (outputDir) {
      mkdirSync(outputDir, { recursive: true });
      const outPath = resolve(outputDir, "semantic-diversity.json");
      writeFileSync(outPath, JSON.stringify(report, null, 2));
      console.log(`  Report written to: ${outPath}`);
    }
  }

  process.exit(allPassed ? 0 : 1);
}

main();
