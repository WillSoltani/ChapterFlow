/**
 * Final ship gate for v21 chapters.
 *
 * Runs every relevant critic over a fully-assembled ChapterV21 and returns
 * pass/fail with detailed findings. The orchestrator calls this BEFORE
 * persisting the chapter to disk. A chapter that fails any BLOCKER cannot
 * ship.
 *
 * Coverage is documented in FAILURE-MODES.md. Every BLOCKER row in that
 * catalog must have a corresponding check here.
 */

import { ChapterV21, ExampleV21 } from "../types.js";
import { checkBannedPhrases, checkNoChapterNumberLiteral, checkNoEmDash, checkNoMetaReference } from "./register.js";
import { checkAlphabetCyclingNames, checkDecisionPoint, checkExampleTemplating, checkNamedProtagonist, checkSpecificScene } from "./narrative.js";
import { checkCardTestsRetrieval, checkQuizTestsApplication } from "./pedagogy.js";
import { checkAnswerPositionBalance, checkEnumValidity } from "./schema.js";
import {
  checkCadenceVariance,
  checkClosingLineLandings,
  checkCrossTierPhraseUniqueness,
  checkOpeningConcreteness,
  checkParagraphStartVariety,
  checkTiersProgressive,
} from "./prose.js";
import { checkReadingLevel } from "./readingLevel.js";

export type GateSeverity = "blocker" | "major" | "minor";

export type GateFinding = {
  catalogId: string;          // entry from FAILURE-MODES.md (e.g., "B1", "C3")
  severity: GateSeverity;
  unit: string;               // human-readable location ("breakdown.fastRead", "example[2]", "quiz.q05")
  message: string;
  evidence?: string;          // truncated offending text
};

export type GateReport = {
  passed: boolean;
  blockers: GateFinding[];    // any of these failing means the chapter does NOT ship
  majors: GateFinding[];      // chapter still ships but findings are surfaced
  minors: GateFinding[];      // advisory only
  summary: {
    blockersCount: number;
    majorsCount: number;
    minorsCount: number;
  };
};

const SEVERITY_FROM_CATALOG: Record<string, GateSeverity> = {
  // Schema (A)
  A1: "blocker",
  A2: "blocker",
  A3: "blocker",
  A4: "major",
  A5: "blocker",
  // Voice (B)
  B1: "blocker",
  B2: "blocker",
  B3: "major",
  B4: "major",
  B5: "blocker",
  B7: "minor",
  B8: "minor",
  // Examples (C)
  C1: "blocker",
  C2: "major",
  C3: "major",
  C7: "blocker",
  C8: "blocker",
  C9: "blocker",
  // Pedagogy (D)
  D1: "major",
  D2: "minor",
  // Reading level (E)
  E1: "major",
  E2: "major",
  E3: "minor",
};

const HOOK_BANNED_OPENERS = /^\s*(in this (chapter|book)|this chapter|the chapter|the author)/i;

export function runShipGate(chapter: ChapterV21): GateReport {
  const findings: GateFinding[] = [];

  const push = (catalogId: string, unit: string, message: string, evidence?: string) => {
    const severity = SEVERITY_FROM_CATALOG[catalogId];
    if (!severity) {
      throw new Error(`finalGate: catalogId "${catalogId}" not registered in SEVERITY_FROM_CATALOG`);
    }
    findings.push({ catalogId, severity, unit, message, evidence });
  };

  // ── Hook (B1, B2, B4, B5) ────────────────────────────────────────────────
  if (chapter.hook) {
    if (HOOK_BANNED_OPENERS.test(chapter.hook)) {
      push("B1", "hook", "hook opens with meta-reference", chapter.hook);
    }
    runRegisterChecks("hook", chapter.hook, push);
  }
  if (chapter.counterintuition) {
    runRegisterChecks("counterintuition", chapter.counterintuition, push);
  }
  if (chapter.keyTakeaway) {
    runRegisterChecks("keyTakeaway", chapter.keyTakeaway, push);
  }
  if (chapter.tryThisNow) {
    runRegisterChecks("tryThisNow", chapter.tryThisNow, push);
  }
  // Backwards-compat: legacy v21 packages (tiny-habits) used reflectionBefore/After.
  // We still register-check them so they don't sneak past with bad content, but
  // new chapters won't populate them.
  if (chapter.reflectionBefore) {
    runRegisterChecks("reflectionBefore", chapter.reflectionBefore, push);
  }
  if (chapter.reflectionAfter) {
    runRegisterChecks("reflectionAfter", chapter.reflectionAfter, push);
  }
  if (chapter.memorableLines) {
    chapter.memorableLines.forEach((line, i) => {
      runRegisterChecks(`memorableLines[${i}]`, line.text, push);
    });
  }

  // ── Breakdown (B1, B2, B4, B5, E1, E2, E3, B7, B8) ───────────────────────
  for (const [tierName, tierText] of [
    ["fastRead", chapter.breakdown.fastRead],
    ["deepRead", chapter.breakdown.deepRead],
    ["fullRead", chapter.breakdown.fullRead],
  ] as const) {
    runRegisterChecks(`breakdown.${tierName}`, tierText, push);
    for (const f of checkReadingLevel(tierText, tierName)) {
      push("E1", `breakdown.${tierName}`, f.message);
    }
    for (const f of checkOpeningConcreteness(tierText, `breakdown.${tierName}`)) {
      push("E3", `breakdown.${tierName}`, f.message);
    }
    for (const f of checkParagraphStartVariety(tierText, `breakdown.${tierName}`)) {
      push("B7", `breakdown.${tierName}`, f.message);
    }
    for (const f of checkCadenceVariance(tierText, `breakdown.${tierName}`)) {
      push("B7", `breakdown.${tierName}`, f.message);
    }
    for (const f of checkClosingLineLandings(tierText, `breakdown.${tierName}`)) {
      push("B7", `breakdown.${tierName}`, f.message);
    }
  }
  // E2 — tier progression
  for (const f of checkTiersProgressive(
    { fastRead: chapter.breakdown.fastRead, deepRead: chapter.breakdown.deepRead, fullRead: chapter.breakdown.fullRead },
    "breakdown",
  )) {
    push("E2", "breakdown", f.message);
  }
  // B8 — cross-tier verbatim
  const allowList = [chapter.title, ...chapter.title.split(/\s+/).filter((w) => w.length > 4).slice(0, 3)];
  for (const f of checkCrossTierPhraseUniqueness(
    { fastRead: chapter.breakdown.fastRead, deepRead: chapter.breakdown.deepRead, fullRead: chapter.breakdown.fullRead },
    allowList,
    "breakdown",
  )) {
    push("B8", "breakdown", f.message);
  }

  // ── Example-slate templating (C8): catches Cartesian-product output where
  // an agent shipped N "examples" that are one template with substituted
  // name/role/city. Fired by GPT-in-Codex on smarter-faster-better and
  // seven-powers; would have prevented both bad books from shipping.
  for (const f of checkExampleTemplating(chapter.examples)) {
    push("C8", "examples", f.message, f.evidence);
  }

  // ── Alphabet-cycling protagonist names (C9): a script tell where an agent
  // enumerated the alphabet rather than choosing protagonists scene by scene.
  // Caught Antifragile shipping with 21/25 chapters using A-B-C-D-E-F → G-H-…
  for (const f of checkAlphabetCyclingNames(chapter.examples)) {
    push("C9", "examples", f.message, f.evidence);
  }

  // ── Examples (B1, B2, B4, B5, C1, C2, C3, C7) ────────────────────────────
  chapter.examples.forEach((ex, i) => {
    const unit = `example[${i}]`;
    // Treat as legacy Example shape for narrative critics (they accept v21 example minus `tags/planSpec`)
    const exForCritic = {
      ...ex,
      category: "work" as const,
      contexts: ex.tags ?? [],
      // The narrative critic only reads scenario, format, etc.
      format: ex.planSpec.format,
    } as unknown as ExampleV21 & { category: string; contexts: string[]; format: string };

    for (const f of checkNamedProtagonist(exForCritic as any)) push("C1", unit, f.message, f.evidence);
    for (const f of checkSpecificScene(exForCritic as any)) push("C2", unit, f.message, f.evidence);
    for (const f of checkDecisionPoint(exForCritic as any)) push("C3", unit, f.message, f.evidence);

    const exFullText = `${ex.scenario} ${ex.whatToDo} ${ex.whyItMatters} ${ex.title}`;
    runRegisterChecks(unit, exFullText, push);

    // C7 — banned-pool name in scenario
    const bannedPool = ["Priya","Omar","Maya","Marcus","Elena","Lena","Victor","Theo","Jonah","Mateo","Tessa","Owen","Mira","Malik","Nadia","Felix","Caleb","Talia","Elise","Naomi"];
    for (const name of bannedPool) {
      if (new RegExp(`\\b${name}\\b`).test(ex.scenario) || new RegExp(`\\b${name}\\b`).test(ex.title)) {
        push("C7", unit, `banned-pool protagonist name "${name}" used`, ex.scenario);
        break;
      }
    }
  });

  // ── Quiz (A1, A2, A3, A4, A5, D1) ────────────────────────────────────────
  chapter.quiz.questions.forEach((q, i) => {
    const unit = `quiz.q${String(i + 1).padStart(2, "0")}`;
    // A5 — exactly 3 choices
    if (!Array.isArray(q.choices) || q.choices.length !== 3) {
      push("A5", unit, `choices length ${q.choices?.length} (must be 3)`);
    }
    // A1 / A2 / A3 — schema enum validity
    for (const f of checkEnumValidity(q as any)) {
      const isBloomFail = f.message.includes("bloomsLevel");
      push(isBloomFail ? (q.bloomsLevel ? "A1" : "A3") : "A2", unit, f.message);
    }
    // D1 — application vs recall
    for (const f of checkQuizTestsApplication(q as any)) push("D1", unit, f.message, f.evidence);
    // Register checks on prompt + choices + explanation
    runRegisterChecks(unit, `${q.prompt} ${q.choices.join(" ")} ${q.explanation ?? ""}`, push);
  });
  // A4 — answer-position balance
  for (const f of checkAnswerPositionBalance(chapter.quiz as any, chapter.number)) {
    push("A4", "quiz", f.message);
  }

  // ── Cards (D2, B1, B2, B4, B5) ───────────────────────────────────────────
  chapter.reviewCards.forEach((c, i) => {
    const unit = `card[${i}]`;
    for (const f of checkCardTestsRetrieval(c as any)) push("D2", unit, f.message, f.evidence);
    runRegisterChecks(unit, `${c.front} ${c.back}`, push);
  });

  // ── Implementation plan (B1, B2, B4, B5) ─────────────────────────────────
  runRegisterChecks("implementationPlan.coreSkill", chapter.implementationPlan.coreSkill, push);
  runRegisterChecks("implementationPlan.twentyFourHour", chapter.implementationPlan.twentyFourHourChallenge, push);
  runRegisterChecks("implementationPlan.weeklyPractice", chapter.implementationPlan.weeklyPractice, push);
  chapter.implementationPlan.ifThenPlans.forEach((it, i) => {
    runRegisterChecks(`implementationPlan.ifThen[${i}]`, it.plan, push);
  });

  const blockers = findings.filter((f) => f.severity === "blocker");
  const majors = findings.filter((f) => f.severity === "major");
  const minors = findings.filter((f) => f.severity === "minor");

  return {
    passed: blockers.length === 0,
    blockers,
    majors,
    minors,
    summary: {
      blockersCount: blockers.length,
      majorsCount: majors.length,
      minorsCount: minors.length,
    },
  };
}

/** Register-level checks that apply to every text-bearing field. */
function runRegisterChecks(unit: string, text: string, push: (catalogId: string, unit: string, message: string, evidence?: string) => void): void {
  for (const f of checkNoMetaReference(text)) {
    push("B1", unit, f.message, f.evidence);
  }
  for (const f of checkNoChapterNumberLiteral(text)) {
    push("B2", unit, f.message, f.evidence);
  }
  for (const f of checkNoEmDash(text)) {
    push("B5", unit, f.message, f.evidence);
  }
  for (const f of checkBannedPhrases(text).findings) {
    push("B4", unit, f.message, f.evidence);
  }
}

/** Pretty-print a gate report for logging. */
export function formatGateReport(report: GateReport): string {
  const lines: string[] = [];
  lines.push(`Ship gate: ${report.passed ? "PASS" : "BLOCK"}`);
  lines.push(`  blockers: ${report.summary.blockersCount}`);
  lines.push(`  majors: ${report.summary.majorsCount}`);
  lines.push(`  minors: ${report.summary.minorsCount}`);
  if (report.blockers.length > 0) {
    lines.push("  Blocker findings:");
    for (const f of report.blockers) {
      lines.push(`    [${f.catalogId}] ${f.unit}: ${f.message}`);
    }
  }
  return lines.join("\n");
}
