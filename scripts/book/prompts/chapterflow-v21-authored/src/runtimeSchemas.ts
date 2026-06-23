import { existsSync, readFileSync, readdirSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import type {
  BookBrief,
  ChapterDesignDoc,
  ChapterV21,
  SourceAnchorForPrompt,
} from "./types.js";
import { V21_SCHEMA_VERSION } from "./types.js";
import type { AssembleInput } from "./assembler.js";
import type { BreakdownOutput } from "./agents/writer-breakdown.js";
import type { CardsOutput } from "./agents/writer-cards.js";
import type { ExampleOutput } from "./agents/writer-example.js";
import type { HookOutput } from "./agents/writer-hook.js";
import type { ImplementationPlanOutput } from "./agents/writer-implementation-plan.js";
import type { QuizOutput } from "./agents/writer-quiz.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_DIR = resolve(__dirname, "../config");

export const RUNTIME_SCHEMA_CONTRACT_VERSION = "runtime-schema-contract-v1" as const;
export const CONFIG_SCHEMA_CONTRACT_VERSION = "config-schema-contract-v1" as const;

export type RuntimeSchemaSeverity = "blocker" | "major" | "minor";

export type RuntimeSchemaFinding = {
  checkId: string;
  severity: RuntimeSchemaSeverity;
  path: string;
  expected: string;
  observed: string;
  message: string;
};

export type RuntimeValidationResult<T> =
  | { ok: true; value: T; findings: [] }
  | { ok: false; findings: RuntimeSchemaFinding[] };

class Collector {
  readonly findings: RuntimeSchemaFinding[] = [];
  constructor(private readonly checkId: string) {}

  issue(path: string, expected: string, observedValue: unknown): void {
    const observed = observedSummary(observedValue);
    this.findings.push({
      checkId: this.checkId,
      severity: "blocker",
      path,
      expected,
      observed,
      message: `${path}: expected ${expected}; observed ${observed}`,
    });
  }
}

export function observedSummary(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (Array.isArray(value)) return `array(len=${value.length})`;
  const type = typeof value;
  if (type === "string") {
    const s = value as string;
    const sample = s.length > 40 ? `${s.slice(0, 37)}...` : s;
    return `string(len=${s.length}${sample ? `, ${JSON.stringify(sample)}` : ""})`;
  }
  if (type === "number") return Number.isFinite(value as number) ? `number(${value})` : `number(${String(value)})`;
  if (type === "boolean") return `boolean(${String(value)})`;
  if (type === "object") {
    const keys = Object.keys(value as Record<string, unknown>).slice(0, 6);
    return `object(keys=${keys.join(",")}${Object.keys(value as Record<string, unknown>).length > keys.length ? ",..." : ""})`;
  }
  return type;
}

export function formatRuntimeFindings(findings: RuntimeSchemaFinding[]): string {
  return findings.map((f) => `${f.checkId} ${f.path}: expected ${f.expected}; observed ${f.observed}`).join("; ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function child(path: string, key: string | number): string {
  return `${path === "/" ? "" : path}/${String(key).replace(/~/g, "~0").replace(/\//g, "~1")}`;
}

function requiredRecord(c: Collector, raw: Record<string, unknown>, key: string, path: string): Record<string, unknown> | null {
  const value = raw[key];
  const p = child(path, key);
  if (!isRecord(value)) {
    c.issue(p, "object", value);
    return null;
  }
  return value;
}

function optionalRecord(c: Collector, raw: Record<string, unknown>, key: string, path: string): Record<string, unknown> | null {
  const value = raw[key];
  if (value === undefined || value === null) return null;
  const p = child(path, key);
  if (!isRecord(value)) {
    c.issue(p, "object when present", value);
    return null;
  }
  return value;
}

function requiredArray(c: Collector, raw: Record<string, unknown>, key: string, path: string): unknown[] | null {
  const value = raw[key];
  const p = child(path, key);
  if (!Array.isArray(value)) {
    c.issue(p, "array", value);
    return null;
  }
  return value;
}

function optionalArray(c: Collector, raw: Record<string, unknown>, key: string, path: string): unknown[] | null {
  const value = raw[key];
  if (value === undefined || value === null) return null;
  const p = child(path, key);
  if (!Array.isArray(value)) {
    c.issue(p, "array when present", value);
    return null;
  }
  return value;
}

function requiredString(c: Collector, raw: Record<string, unknown>, key: string, path: string, opts: { nonempty?: boolean } = { nonempty: true }): void {
  const value = raw[key];
  const p = child(path, key);
  if (typeof value !== "string" || (opts.nonempty !== false && value.trim().length === 0)) {
    c.issue(p, opts.nonempty === false ? "string" : "nonempty string", value);
  }
}

function requiredLiteral(c: Collector, raw: Record<string, unknown>, key: string, path: string, expected: string): void {
  const value = raw[key];
  if (value !== expected) c.issue(child(path, key), JSON.stringify(expected), value);
}

function optionalLiteral(c: Collector, raw: Record<string, unknown>, key: string, path: string, expected: string): void {
  const value = raw[key];
  if (value === undefined || value === null) return;
  if (value !== expected) c.issue(child(path, key), `${JSON.stringify(expected)} when present`, value);
}

function optionalString(c: Collector, raw: Record<string, unknown>, key: string, path: string): void {
  const value = raw[key];
  if (value === undefined || value === null) return;
  if (typeof value !== "string") c.issue(child(path, key), "string when present", value);
}

function requiredFiniteNumber(c: Collector, raw: Record<string, unknown>, key: string, path: string): void {
  const value = raw[key];
  if (typeof value !== "number" || !Number.isFinite(value)) c.issue(child(path, key), "finite number", value);
}

function requiredPositiveInteger(c: Collector, raw: Record<string, unknown>, key: string, path: string): void {
  const value = raw[key];
  if (!Number.isInteger(value) || (value as number) < 1) c.issue(child(path, key), "positive integer", value);
}

function optionalIntegerInRange(c: Collector, raw: Record<string, unknown>, key: string, path: string, min: number, max: number): void {
  const value = raw[key];
  if (value === undefined || value === null) return;
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    c.issue(child(path, key), `integer ${min}..${max} when present`, value);
  }
}

function requiredIntegerInRange(c: Collector, raw: Record<string, unknown>, key: string, path: string, min: number, max: number): void {
  const value = raw[key];
  if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) {
    c.issue(child(path, key), `integer ${min}..${max}`, value);
  }
}

function requiredBoolean(c: Collector, raw: Record<string, unknown>, key: string, path: string): void {
  const value = raw[key];
  if (typeof value !== "boolean") c.issue(child(path, key), "boolean", value);
}

function optionalBoolean(c: Collector, raw: Record<string, unknown>, key: string, path: string): void {
  const value = raw[key];
  if (value !== undefined && value !== null && typeof value !== "boolean") c.issue(child(path, key), "boolean when present", value);
}

function stringArray(c: Collector, arr: unknown[] | null, path: string, opts: { min?: number; exact?: number; allowEmpty?: boolean } = {}): void {
  if (!arr) return;
  if (opts.exact !== undefined && arr.length !== opts.exact) c.issue(path, `array length ${opts.exact}`, arr);
  if (opts.min !== undefined && arr.length < opts.min) c.issue(path, `array length >= ${opts.min}`, arr);
  arr.forEach((item, i) => {
    if (typeof item !== "string" || (!opts.allowEmpty && item.trim().length === 0)) {
      c.issue(child(path, i), opts.allowEmpty ? "string" : "nonempty string", item);
    }
  });
}

function optionalStringArray(c: Collector, raw: Record<string, unknown>, key: string, path: string): void {
  const arr = optionalArray(c, raw, key, path);
  if (arr) stringArray(c, arr, child(path, key));
}

export function validateChapterV21(raw: unknown, checkId = "schema.chapter_contract"): RuntimeValidationResult<ChapterV21> {
  const c = new Collector(checkId);
  if (!isRecord(raw)) {
    c.issue("/", "ChapterV21 object", raw);
    return { ok: false, findings: c.findings };
  }

  optionalLiteral(c, raw, "schemaVersion", "/", V21_SCHEMA_VERSION);
  requiredString(c, raw, "chapterId", "/");
  requiredPositiveInteger(c, raw, "number", "/");
  requiredString(c, raw, "title", "/");
  requiredFiniteNumber(c, raw, "readingTimeMinutes", "/");
  requiredString(c, raw, "hook", "/");
  optionalString(c, raw, "counterintuition", "/");
  optionalString(c, raw, "tryThisNow", "/");
  requiredString(c, raw, "keyTakeaway", "/");
  optionalString(c, raw, "reflectionBefore", "/");
  optionalString(c, raw, "reflectionAfter", "/");

  const breakdown = requiredRecord(c, raw, "breakdown", "/");
  if (breakdown) {
    requiredString(c, breakdown, "fastRead", "/breakdown");
    requiredString(c, breakdown, "deepRead", "/breakdown");
    requiredString(c, breakdown, "fullRead", "/breakdown");
  }

  const examples = requiredArray(c, raw, "examples", "/");
  if (examples) examples.forEach((item, i) => validateExampleV21(c, item, child("/examples", i)));

  const quiz = requiredRecord(c, raw, "quiz", "/");
  if (quiz) validateQuizV21(c, quiz, "/quiz");

  const reviewCards = requiredArray(c, raw, "reviewCards", "/");
  if (reviewCards) reviewCards.forEach((item, i) => validateReviewCardV21(c, item, child("/reviewCards", i)));

  const implementationPlan = requiredRecord(c, raw, "implementationPlan", "/");
  if (implementationPlan) validateImplementationPlanV21(c, implementationPlan, "/implementationPlan");

  const memorableLines = optionalArray(c, raw, "memorableLines", "/");
  if (memorableLines) memorableLines.forEach((item, i) => validateMemorableLine(c, item, child("/memorableLines", i)));

  const authoring = optionalRecord(c, raw, "authoring", "/");
  if (authoring) validateAuthoringEvidence(c, authoring, "/authoring");

  const experiencePlan = optionalRecord(c, raw, "experiencePlan", "/");
  if (experiencePlan) validateExperiencePlan(c, experiencePlan, "/experiencePlan");

  return c.findings.length ? { ok: false, findings: c.findings } : { ok: true, value: raw as ChapterV21, findings: [] };
}

function validateExampleV21(c: Collector, item: unknown, path: string): void {
  if (!isRecord(item)) {
    c.issue(path, "ExampleV21 object", item);
    return;
  }
  requiredString(c, item, "exampleId", path);
  optionalString(c, item, "sourceAnchorId", path);
  optionalStringArray(c, item, "sourceAnchorIds", path);
  requiredString(c, item, "title", path);
  const tags = requiredArray(c, item, "tags", path);
  stringArray(c, tags, child(path, "tags"));
  const planSpec = requiredRecord(c, item, "planSpec", path);
  if (planSpec) {
    for (const key of ["domain", "audience", "stakes", "format", "requiredBeat"]) requiredString(c, planSpec, key, child(path, "planSpec"));
    optionalString(c, planSpec, "venue", child(path, "planSpec"));
    optionalString(c, planSpec, "exemplar", child(path, "planSpec"));
  }
  for (const key of ["scenario", "whatToDo", "whyItMatters"]) requiredString(c, item, key, path);
}

function validateQuizV21(c: Collector, quiz: Record<string, unknown>, path: string): void {
  requiredFiniteNumber(c, quiz, "passingScorePercent", path);
  const questions = requiredArray(c, quiz, "questions", path);
  if (!questions) return;
  questions.forEach((item, i) => {
    const qPath = child(child(path, "questions"), i);
    if (!isRecord(item)) {
      c.issue(qPath, "QuizQuestion object", item);
      return;
    }
    requiredString(c, item, "questionId", qPath);
    optionalString(c, item, "sourceAnchorId", qPath);
    optionalStringArray(c, item, "sourceAnchorIds", qPath);
    optionalStringArray(c, item, "keyEvidenceAnchorIds", qPath);
    requiredString(c, item, "prompt", qPath);
    const choices = requiredArray(c, item, "choices", qPath);
    stringArray(c, choices, child(qPath, "choices"), { exact: 3 });
    requiredIntegerInRange(c, item, "correctIndex", qPath, 0, 2);
    optionalIntegerInRange(c, item, "correctAnswerIndex", qPath, 0, 2);
    requiredString(c, item, "explanation", qPath);
    requiredString(c, item, "bloomsLevel", qPath);
    requiredString(c, item, "depthLevel", qPath);
  });
}

function validateReviewCardV21(c: Collector, item: unknown, path: string): void {
  if (!isRecord(item)) {
    c.issue(path, "ReviewCardV21 object", item);
    return;
  }
  requiredString(c, item, "cardId", path);
  optionalString(c, item, "sourceAnchorId", path);
  optionalStringArray(c, item, "sourceAnchorIds", path);
  requiredString(c, item, "front", path);
  requiredString(c, item, "back", path);
  requiredString(c, item, "difficulty", path);
}

function validateImplementationPlanV21(c: Collector, plan: Record<string, unknown>, path: string): void {
  requiredString(c, plan, "title", path);
  optionalStringArray(c, plan, "titleSourceAnchorIds", path);
  requiredString(c, plan, "coreSkill", path);
  optionalStringArray(c, plan, "coreSkillSourceAnchorIds", path);
  const ifThenPlans = requiredArray(c, plan, "ifThenPlans", path);
  if (ifThenPlans) {
    ifThenPlans.forEach((item, i) => {
      const itemPath = child(child(path, "ifThenPlans"), i);
      if (!isRecord(item)) {
        c.issue(itemPath, "ifThenPlan object", item);
        return;
      }
      optionalString(c, item, "sourceAnchorId", itemPath);
      optionalStringArray(c, item, "sourceAnchorIds", itemPath);
      requiredString(c, item, "context", itemPath);
      requiredString(c, item, "plan", itemPath);
    });
  }
  requiredString(c, plan, "twentyFourHourChallenge", path);
  optionalStringArray(c, plan, "twentyFourHourChallengeSourceAnchorIds", path);
  requiredString(c, plan, "weeklyPractice", path);
  optionalStringArray(c, plan, "weeklyPracticeSourceAnchorIds", path);
}

function validateMemorableLine(c: Collector, item: unknown, path: string): void {
  if (!isRecord(item)) {
    c.issue(path, "memorable line object", item);
    return;
  }
  requiredString(c, item, "text", path);
  requiredString(c, item, "location", path);
  requiredString(c, item, "why", path);
  optionalStringArray(c, item, "sourceAnchorIds", path);
}

function validateAuthoringEvidence(c: Collector, authoring: Record<string, unknown>, path: string): void {
  optionalString(c, authoring, "schemaVersion", path);
  const sourceAnchors = optionalRecord(c, authoring, "sourceAnchors", path);
  if (sourceAnchors) {
    optionalString(c, sourceAnchors, "schemaVersion", child(path, "sourceAnchors"));
    optionalString(c, sourceAnchors, "sourceHash", child(path, "sourceAnchors"));
    optionalString(c, sourceAnchors, "sourceSidecarPath", child(path, "sourceAnchors"));
    optionalStringArray(c, sourceAnchors, "observedAnchorIds", child(path, "sourceAnchors"));
    const effective = optionalRecord(c, sourceAnchors, "effectiveAnchors", child(path, "sourceAnchors"));
    if (effective) {
      const effectivePath = child(child(path, "sourceAnchors"), "effectiveAnchors");
      for (const [key, value] of Object.entries(effective)) {
        if (!Array.isArray(value)) c.issue(child(effectivePath, key), "array of strings", value);
        else stringArray(c, value, child(effectivePath, key));
      }
    }
  }
  const generation = optionalRecord(c, authoring, "generation", path);
  if (generation) validateGenerationRunManifest(c, generation, child(path, "generation"));
}

function validateExperiencePlan(c: Collector, ep: Record<string, unknown>, path: string): void {
  const failureRecovery = optionalRecord(c, ep, "failureRecovery", path);
  if (failureRecovery) {
    for (const key of ["normalizingLine", "cueQuestion", "repairLine"]) {
      requiredString(c, failureRecovery, key, child(path, "failureRecovery"), { nonempty: false });
    }
    const options = requiredArray(c, failureRecovery, "options", child(path, "failureRecovery"));
    stringArray(c, options, child(child(path, "failureRecovery"), "options"), { allowEmpty: true });
  }
  const transferPrompt = optionalRecord(c, ep, "transferPrompt", path);
  if (transferPrompt) {
    requiredString(c, transferPrompt, "prompt", child(path, "transferPrompt"), { nonempty: false });
    const contexts = requiredArray(c, transferPrompt, "contexts", child(path, "transferPrompt"));
    stringArray(c, contexts, child(child(path, "transferPrompt"), "contexts"), { allowEmpty: true });
  }
  const behaviorLoop = optionalRecord(c, ep, "behaviorLoop", path);
  if (behaviorLoop) {
    const patterns = optionalArray(c, behaviorLoop, "readerPatterns", child(path, "behaviorLoop"));
    if (patterns) {
      patterns.forEach((item, i) => {
        const p = child(child(child(path, "behaviorLoop"), "readerPatterns"), i);
        if (!isRecord(item)) {
          c.issue(p, "readerPattern object", item);
          return;
        }
        requiredString(c, item, "id", p, { nonempty: false });
        requiredString(c, item, "label", p, { nonempty: false });
        optionalIntegerInRange(c, item, "mapsToPlanIndex", p, 0, Number.MAX_SAFE_INTEGER);
        optionalIntegerInRange(c, item, "mapsToExampleIndex", p, 0, Number.MAX_SAFE_INTEGER);
      });
    }
  }
}

export function validateBookGateInput(bookId: unknown, chapters: unknown, checkId = "schema.book_contract"): RuntimeValidationResult<ChapterV21[]> {
  const c = new Collector(checkId);
  if (typeof bookId !== "string" || bookId.trim().length === 0) c.issue("/bookId", "nonempty string", bookId);
  if (!Array.isArray(chapters)) {
    c.issue("/chapters", "array of ChapterV21 objects", chapters);
    return c.findings.length ? { ok: false, findings: c.findings } : { ok: true, value: chapters as ChapterV21[], findings: [] };
  }
  chapters.forEach((chapter, i) => {
    const parsed = validateChapterV21(chapter, checkId);
    if (!parsed.ok) {
      for (const f of parsed.findings) {
        c.findings.push({ ...f, path: child("/chapters", i) + (f.path === "/" ? "" : f.path), message: `${child("/chapters", i)}${f.path === "/" ? "" : f.path}: expected ${f.expected}; observed ${f.observed}` });
      }
    }
  });
  return c.findings.length ? { ok: false, findings: c.findings } : { ok: true, value: chapters as ChapterV21[], findings: [] };
}

export type AssembleInputValidated = AssembleInput & {
  plan: ChapterDesignDoc;
  breakdown: BreakdownOutput;
  examples: ExampleOutput[];
  quiz: QuizOutput;
  cards: CardsOutput;
  implementationPlan: ImplementationPlanOutput;
  hook: HookOutput;
};

export function validateAssembleInput(raw: unknown, checkId = "schema.assembler_contract"): RuntimeValidationResult<AssembleInputValidated> {
  const c = new Collector(checkId);
  if (!isRecord(raw)) {
    c.issue("/", "AssembleInput object", raw);
    return { ok: false, findings: c.findings };
  }

  const plan = requiredRecord(c, raw, "plan", "/");
  if (plan) validatePlan(c, plan, "/plan");
  const breakdown = requiredRecord(c, raw, "breakdown", "/");
  if (breakdown) {
    requiredString(c, breakdown, "fastRead", "/breakdown", { nonempty: false });
    requiredString(c, breakdown, "deepRead", "/breakdown", { nonempty: false });
    requiredString(c, breakdown, "fullRead", "/breakdown", { nonempty: false });
  }
  const examples = requiredArray(c, raw, "examples", "/");
  if (examples) examples.forEach((example, i) => validateExampleOutput(c, example, child("/examples", i)));
  const quiz = requiredRecord(c, raw, "quiz", "/");
  if (quiz) validateQuizOutput(c, quiz, "/quiz");
  const cards = requiredRecord(c, raw, "cards", "/");
  if (cards) validateCardsOutput(c, cards, "/cards");
  const implementationPlan = requiredRecord(c, raw, "implementationPlan", "/");
  if (implementationPlan) validateImplementationPlanOutput(c, implementationPlan, "/implementationPlan");
  const hook = requiredRecord(c, raw, "hook", "/");
  if (hook) validateHookOutput(c, hook, "/hook");
  requiredString(c, raw, "keyTakeaway", "/", { nonempty: false });
  optionalStringArray(c, raw, "keyTakeawaySourceAnchorIds", "/");
  optionalString(c, raw, "tryThisNow", "/");
  optionalStringArray(c, raw, "tryThisNowSourceAnchorIds", "/");
  optionalArray(c, raw, "memorableLines", "/");
  const generation = optionalRecord(c, raw, "generation", "/");
  if (generation) validateGenerationRunManifest(c, generation, "/generation");

  if (plan && examples) {
    const specLen = Array.isArray(plan.exampleSpecs) ? plan.exampleSpecs.length : null;
    if (typeof plan.exampleCount === "number" && specLen !== null && plan.exampleCount !== specLen) {
      c.issue("/plan/exampleSpecs", `length equal to plan.exampleCount (${plan.exampleCount})`, plan.exampleSpecs);
    }
    if (specLen !== null && examples.length !== specLen) {
      c.issue("/examples", `length equal to plan.exampleSpecs (${specLen})`, examples);
    }
    examples.forEach((example, i) => {
      if (isRecord(example) && typeof example.exampleId === "string" && !/^ch\d{2}-ex\d{2}/.test(example.exampleId) && !/^ex\d{2}/.test(example.exampleId)) {
        c.issue(child("/examples", i) + "/exampleId", "planner-owned id matching exNN or chNN-exNN-*", example.exampleId);
      }
    });
  }
  if (plan && quiz && Array.isArray(quiz.questions) && isRecord(plan.quizFocus)) {
    const expected = plan.quizFocus.count;
    if (typeof expected === "number" && quiz.questions.length !== expected) c.issue("/quiz/questions", `length equal to plan.quizFocus.count (${expected})`, quiz.questions);
    quiz.questions.forEach((question, i) => {
      if (!isRecord(question)) return;
      const expectedId = `q${String(i + 1).padStart(2, "0")}`;
      if (typeof question.questionId === "string" && question.questionId !== expectedId) c.issue(child("/quiz/questions", i) + "/questionId", expectedId, question.questionId);
    });
  }
  if (plan && cards && Array.isArray(cards.cards) && isRecord(plan.cardFocus)) {
    const expected = plan.cardFocus.count;
    if (typeof expected === "number" && cards.cards.length !== expected) c.issue("/cards/cards", `length equal to plan.cardFocus.count (${expected})`, cards.cards);
  }

  validateSourceV2AssembleAnchors(c, raw);

  return c.findings.length ? { ok: false, findings: c.findings } : { ok: true, value: raw as AssembleInputValidated, findings: [] };
}

function validateSourceV2AssembleAnchors(c: Collector, raw: Record<string, unknown>): void {
  const sourceEvidence = raw.sourceEvidence;
  if (!isRecord(sourceEvidence) || sourceEvidence.sourceV2 !== true) return;
  const anchorItems = Array.isArray(sourceEvidence.anchors) ? sourceEvidence.anchors : [];
  const allowed = new Set<string>();
  for (const item of anchorItems) {
    if (isRecord(item) && typeof item.id === "string" && item.id.trim()) allowed.add(item.id);
  }
  if (allowed.size === 0) {
    c.issue("/sourceEvidence/anchors", "nonempty allowed source anchors for source-v2 assembly", sourceEvidence.anchors);
    return;
  }

  const requireIds = (value: unknown, path: string): void => {
    const ids = normalizeStringArrayValue(value);
    if (ids.length === 0) {
      c.issue(path, "nonempty source anchor id array from generated output", value);
      return;
    }
    ids.forEach((id, i) => {
      if (!allowed.has(id)) c.issue(child(path, i), "allowed source anchor id", id);
    });
  };
  const requireRecordIds = (record: Record<string, unknown> | null, key: string, path: string): void => {
    if (!record) {
      c.issue(path, "object carrying source anchor ids", record);
      return;
    }
    requireIds(record[key], child(path, key));
  };
  const idsFromSourceFields = (record: Record<string, unknown>): unknown => {
    const arr = record.sourceAnchorIds;
    if (arr !== undefined) return arr;
    const single = record.sourceAnchorId;
    return single === undefined ? undefined : [single];
  };

  const breakdown = isRecord(raw.breakdown) ? raw.breakdown : null;
  const breakdownIds = isRecord(breakdown?.sourceAnchorIds) ? breakdown.sourceAnchorIds : null;
  requireRecordIds(breakdownIds, "fastRead", "/breakdown/sourceAnchorIds");
  requireRecordIds(breakdownIds, "deepRead", "/breakdown/sourceAnchorIds");
  requireRecordIds(breakdownIds, "fullRead", "/breakdown/sourceAnchorIds");

  const examples = Array.isArray(raw.examples) ? raw.examples : [];
  examples.forEach((example, i) => {
    if (isRecord(example)) requireIds(idsFromSourceFields(example), child(child("/examples", i), "sourceAnchorIds"));
  });

  const quiz = isRecord(raw.quiz) ? raw.quiz : null;
  const questions = Array.isArray(quiz?.questions) ? quiz.questions : [];
  questions.forEach((question, i) => {
    const qPath = child(child("/quiz/questions", i), "sourceAnchorIds");
    if (isRecord(question)) {
      requireIds(idsFromSourceFields(question), qPath);
      requireIds(question.keyEvidenceAnchorIds, child(child("/quiz/questions", i), "keyEvidenceAnchorIds"));
    }
  });

  const cards = isRecord(raw.cards) ? raw.cards : null;
  const cardItems = Array.isArray(cards?.cards) ? cards.cards : [];
  cardItems.forEach((card, i) => {
    if (isRecord(card)) requireIds(idsFromSourceFields(card), child(child("/cards/cards", i), "sourceAnchorIds"));
  });

  const implementationPlan = isRecord(raw.implementationPlan) ? raw.implementationPlan : null;
  if (implementationPlan) {
    requireIds(implementationPlan.titleSourceAnchorIds, "/implementationPlan/titleSourceAnchorIds");
    requireIds(implementationPlan.coreSkillSourceAnchorIds, "/implementationPlan/coreSkillSourceAnchorIds");
    const ifThenPlans = Array.isArray(implementationPlan.ifThenPlans) ? implementationPlan.ifThenPlans : [];
    ifThenPlans.forEach((item, i) => {
      if (isRecord(item)) requireIds(idsFromSourceFields(item), child(child("/implementationPlan/ifThenPlans", i), "sourceAnchorIds"));
    });
    requireIds(implementationPlan.twentyFourHourChallengeSourceAnchorIds, "/implementationPlan/twentyFourHourChallengeSourceAnchorIds");
    requireIds(implementationPlan.weeklyPracticeSourceAnchorIds, "/implementationPlan/weeklyPracticeSourceAnchorIds");
  }

  const hook = isRecord(raw.hook) ? raw.hook : null;
  if (hook) {
    requireIds(hook.sourceAnchorIds, "/hook/sourceAnchorIds");
    if (typeof hook.counterintuition === "string" && hook.counterintuition.trim()) {
      requireIds(hook.counterintuitionSourceAnchorIds, "/hook/counterintuitionSourceAnchorIds");
    }
  }
  requireIds(raw.keyTakeawaySourceAnchorIds, "/keyTakeawaySourceAnchorIds");
  if (typeof raw.tryThisNow === "string" && raw.tryThisNow.trim()) {
    requireIds(raw.tryThisNowSourceAnchorIds, "/tryThisNowSourceAnchorIds");
  }

  const memorableLines = Array.isArray(raw.memorableLines) ? raw.memorableLines : [];
  memorableLines.forEach((line, i) => {
    if (isRecord(line)) requireIds(line.sourceAnchorIds, child(child("/memorableLines", i), "sourceAnchorIds"));
  });
}

function normalizeStringArrayValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  if (typeof value === "string" && value.trim()) return [value];
  return [];
}

function validateGenerationRunManifest(c: Collector, raw: Record<string, unknown>, path: string): void {
  requiredLiteral(c, raw, "schemaVersion", path, "chapter-generation-run-v1");
  requiredString(c, raw, "runId", path);
  requiredString(c, raw, "chapterId", path);
  requiredString(c, raw, "authorSessionId", path);
  requiredString(c, raw, "createdAt", path);
  requiredString(c, raw, "promptSetId", path);
  requiredString(c, raw, "configId", path);
  requiredString(c, raw, "codeVersion", path);
  requiredLiteral(c, raw, "chapterSchemaVersion", path, V21_SCHEMA_VERSION);
  optionalString(c, raw, "sourceHash", path);
  optionalString(c, raw, "sourceAnchorCatalogHash", path);
  optionalString(c, raw, "planHash", path);
  const provider = requiredRecord(c, raw, "provider", path);
  if (provider) {
    requiredString(c, provider, "tier", child(path, "provider"));
    requiredString(c, provider, "provider", child(path, "provider"));
    requiredString(c, provider, "model", child(path, "provider"));
  }
  const projection = requiredRecord(c, raw, "projection", path);
  if (projection) {
    requiredString(c, projection, "version", child(path, "projection"));
    requiredLiteral(c, projection, "readerContentHashInclusion", child(path, "projection"), "excluded");
    requiredString(c, projection, "note", child(path, "projection"));
  }
  const stages = requiredArray(c, raw, "stages", path);
  if (stages) {
    stages.forEach((stage, i) => {
      const p = child(child(path, "stages"), i);
      if (!isRecord(stage)) {
        c.issue(p, "generation stage provenance object", stage);
        return;
      }
      requiredLiteral(c, stage, "schemaVersion", p, "chapter-generation-stage-v1");
      requiredString(c, stage, "stage", p);
      requiredString(c, stage, "status", p);
      requiredString(c, stage, "inputHash", p);
      optionalString(c, stage, "outputHash", p);
      requiredPositiveInteger(c, stage, "attemptCount", p);
      requiredString(c, stage, "completedAt", p);
      optionalString(c, stage, "degradationEventId", p);
    });
  }
  const degradations = requiredArray(c, raw, "degradations", path);
  if (degradations) {
    degradations.forEach((event, i) => validateGenerationDegradationEvent(c, event, child(child(path, "degradations"), i)));
  }
}

function validateGenerationDegradationEvent(c: Collector, event: unknown, path: string): void {
  if (!isRecord(event)) {
    c.issue(path, "generation degradation event object", event);
    return;
  }
  requiredLiteral(c, event, "schemaVersion", path, "generation-degradation-event-v1");
  requiredString(c, event, "eventId", path);
  requiredString(c, event, "stage", path);
  const inputHashes = requiredRecord(c, event, "inputHashes", path);
  if (inputHashes) {
    for (const [key, value] of Object.entries(inputHashes)) {
      if (typeof value !== "string" || !value.trim()) c.issue(child(child(path, "inputHashes"), key), "nonempty hash string", value);
    }
  }
  const error = requiredRecord(c, event, "error", path);
  if (error) {
    requiredString(c, error, "class", child(path, "error"));
    requiredString(c, error, "message", child(path, "error"));
  }
  requiredPositiveInteger(c, event, "attemptCount", path);
  const fallback = requiredRecord(c, event, "fallbackUsed", path);
  if (fallback) {
    requiredString(c, fallback, "kind", child(path, "fallbackUsed"));
    requiredString(c, fallback, "policy", child(path, "fallbackUsed"));
    requiredString(c, fallback, "reason", child(path, "fallbackUsed"));
  }
  requiredString(c, event, "outputHash", path);
  requiredString(c, event, "severity", path);
  requiredString(c, event, "requiredDisposition", path);
  requiredString(c, event, "observedAt", path);
}

function validatePlan(c: Collector, plan: Record<string, unknown>, path: string): void {
  requiredString(c, plan, "chapterId", path);
  requiredPositiveInteger(c, plan, "number", path);
  requiredString(c, plan, "title", path);
  requiredString(c, plan, "coreMove", path);
  requiredPositiveInteger(c, plan, "exampleCount", path);
  const specs = requiredArray(c, plan, "exampleSpecs", path);
  if (specs) specs.forEach((item, i) => validateExampleSpec(c, item, child(child(path, "exampleSpecs"), i)));
  const quizFocus = requiredRecord(c, plan, "quizFocus", path);
  if (quizFocus) {
    requiredPositiveInteger(c, quizFocus, "count", child(path, "quizFocus"));
    const bloomsMix = optionalRecord(c, quizFocus, "bloomsMix", child(path, "quizFocus"));
    if (bloomsMix) {
      for (const [key, value] of Object.entries(bloomsMix)) {
        if (typeof value !== "number" || !Number.isFinite(value)) c.issue(child(child(child(path, "quizFocus"), "bloomsMix"), key), "finite number", value);
      }
    }
    requiredFiniteNumber(c, quizFocus, "transferEmphasis", child(path, "quizFocus"));
    optionalStringArray(c, quizFocus, "sourceAnchorIds", child(path, "quizFocus"));
  }
  const cardFocus = requiredRecord(c, plan, "cardFocus", path);
  if (cardFocus) {
    requiredPositiveInteger(c, cardFocus, "count", child(path, "cardFocus"));
    requiredBoolean(c, cardFocus, "retrievalPractice", child(path, "cardFocus"));
    optionalStringArray(c, cardFocus, "sourceAnchorIds", child(path, "cardFocus"));
  }
  requiredFiniteNumber(c, plan, "readingTimeMinutes", path);
  optionalStringArray(c, plan, "coreMoveSourceAnchorIds", path);
}

function validateExampleSpec(c: Collector, item: unknown, path: string): void {
  if (!isRecord(item)) {
    c.issue(path, "ExampleSpec object", item);
    return;
  }
  for (const key of ["domain", "audience", "stakes", "format", "requiredBeat"]) requiredString(c, item, key, path);
  optionalStringArray(c, item, "sourceAnchorIds", path);
}

function validateExampleOutput(c: Collector, item: unknown, path: string): void {
  if (!isRecord(item)) {
    c.issue(path, "ExampleOutput object", item);
    return;
  }
  requiredString(c, item, "exampleId", path);
  optionalString(c, item, "sourceAnchorId", path);
  optionalStringArray(c, item, "sourceAnchorIds", path);
  for (const key of ["title", "scenario", "whatToDo", "whyItMatters"]) requiredString(c, item, key, path, { nonempty: false });
}

function validateQuizOutput(c: Collector, quiz: Record<string, unknown>, path: string): void {
  requiredFiniteNumber(c, quiz, "passingScorePercent", path);
  const questions = requiredArray(c, quiz, "questions", path);
  if (!questions) return;
  questions.forEach((item, i) => {
    const p = child(child(path, "questions"), i);
    if (!isRecord(item)) {
      c.issue(p, "quiz output question object", item);
      return;
    }
    requiredString(c, item, "questionId", p);
    optionalString(c, item, "sourceAnchorId", p);
    optionalStringArray(c, item, "sourceAnchorIds", p);
    optionalStringArray(c, item, "keyEvidenceAnchorIds", p);
    requiredString(c, item, "prompt", p, { nonempty: false });
    const choices = requiredArray(c, item, "choices", p);
    stringArray(c, choices, child(p, "choices"), { exact: 3 });
    requiredIntegerInRange(c, item, "correctIndex", p, 0, 2);
    requiredString(c, item, "explanation", p, { nonempty: false });
    requiredString(c, item, "bloomsLevel", p);
    requiredString(c, item, "depthLevel", p);
  });
}

function validateCardsOutput(c: Collector, cards: Record<string, unknown>, path: string): void {
  const items = requiredArray(c, cards, "cards", path);
  if (!items) return;
  items.forEach((item, i) => validateReviewCardV21(c, item, child(child(path, "cards"), i)));
}

function validateImplementationPlanOutput(c: Collector, plan: Record<string, unknown>, path: string): void {
  validateImplementationPlanV21(c, plan, path);
}

function validateHookOutput(c: Collector, hook: Record<string, unknown>, path: string): void {
  requiredString(c, hook, "hook", path, { nonempty: false });
  optionalString(c, hook, "counterintuition", path);
  optionalStringArray(c, hook, "sourceAnchorIds", path);
  optionalStringArray(c, hook, "counterintuitionSourceAnchorIds", path);
}

export function validateBookBrief(raw: unknown, checkId = "schema.book_brief_contract"): RuntimeValidationResult<BookBrief> {
  const c = new Collector(checkId);
  if (!isRecord(raw)) {
    c.issue("/", "BookBrief object", raw);
    return { ok: false, findings: c.findings };
  }
  for (const key of ["bookId", "title", "author", "thesisParagraph", "targetReader", "teachingArc"]) requiredString(c, raw, key, "/");
  const coreIdeas = requiredArray(c, raw, "coreIdeas", "/");
  if (coreIdeas) {
    coreIdeas.forEach((item, i) => {
      const p = child("/coreIdeas", i);
      if (!isRecord(item)) {
        c.issue(p, "CoreIdea object", item);
        return;
      }
      for (const key of ["name", "oneSentence", "mentalMove"]) requiredString(c, item, key, p);
      const anchors = requiredArray(c, item, "sourceAnchors", p);
      stringArray(c, anchors, child(p, "sourceAnchors"));
    });
  }
  const voice = requiredRecord(c, raw, "voiceCharter", "/");
  if (voice) {
    for (const key of ["register", "person", "cadence"]) requiredString(c, voice, key, "/voiceCharter");
    stringArray(c, requiredArray(c, voice, "signatureMoves", "/voiceCharter"), "/voiceCharter/signatureMoves");
    stringArray(c, requiredArray(c, voice, "avoidMoves", "/voiceCharter"), "/voiceCharter/avoidMoves");
  }
  stringArray(c, requiredArray(c, raw, "forbiddenMoves", "/"), "/forbiddenMoves");
  return c.findings.length ? { ok: false, findings: c.findings } : { ok: true, value: raw as BookBrief, findings: [] };
}

export function validateProviderCallResult(raw: unknown, checkId = "schema.provider_result_contract"): RuntimeValidationResult<unknown> {
  const c = new Collector(checkId);
  if (!isRecord(raw)) {
    c.issue("/", "provider CallResult object", raw);
    return { ok: false, findings: c.findings };
  }
  const provider = raw.provider;
  if (provider !== "anthropic-cli" && provider !== "anthropic-api" && provider !== "openai-api") {
    c.issue("/provider", "known provider name", provider);
  }
  requiredString(c, raw, "model", "/");
  requiredFiniteNumber(c, raw, "durationMs", "/");
  requiredPositiveInteger(c, raw, "attempts", "/");
  requiredString(c, raw, "raw", "/", { nonempty: false });
  const rawResponses = optionalArray(c, raw, "rawResponses", "/");
  stringArray(c, rawResponses, "/rawResponses", { allowEmpty: true });
  const attemptMetadata = requiredArray(c, raw, "attemptMetadata", "/");
  if (attemptMetadata) {
    attemptMetadata.forEach((item, i) => {
      const p = child("/attemptMetadata", i);
      if (!isRecord(item)) {
        c.issue(p, "provider attempt metadata object", item);
        return;
      }
      requiredPositiveInteger(c, item, "attempt", p);
      requiredFiniteNumber(c, item, "durationMs", p);
      requiredString(c, item, "kind", p);
      optionalString(c, item, "error", p);
    });
  }
  const usage = requiredRecord(c, raw, "usage", "/");
  if (usage) {
    optionalNonnegativeNumber(c, usage, "inputTokens", "/usage");
    optionalNonnegativeNumber(c, usage, "outputTokens", "/usage");
    optionalNonnegativeNumber(c, usage, "cacheReadTokens", "/usage");
    optionalNonnegativeNumber(c, usage, "cacheWriteTokens", "/usage");
    optionalNonnegativeNumber(c, usage, "estimatedCostUsd", "/usage");
  }
  if (!("content" in raw)) c.issue("/content", "present provider content", undefined);
  return c.findings.length ? { ok: false, findings: c.findings } : { ok: true, value: raw, findings: [] };
}

function optionalNonnegativeNumber(c: Collector, raw: Record<string, unknown>, key: string, path: string): void {
  const value = raw[key];
  if (value === undefined || value === null) return;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    c.issue(child(path, key), "nonnegative finite number when present", value);
  }
}

export function validateSourceAnchors(raw: unknown, checkId = "schema.source_anchor_contract"): RuntimeValidationResult<SourceAnchorForPrompt[]> {
  const c = new Collector(checkId);
  if (!Array.isArray(raw)) {
    c.issue("/", "array of source anchors", raw);
    return { ok: false, findings: c.findings };
  }
  raw.forEach((item, i) => {
    const p = child("/", i);
    if (!isRecord(item)) {
      c.issue(p, "source anchor object", item);
      return;
    }
    for (const key of ["id", "kind", "label", "text"]) requiredString(c, item, key, p);
    const claimTypes = requiredArray(c, item, "supportsClaimTypes", p);
    stringArray(c, claimTypes, child(p, "supportsClaimTypes"));
    const hardSpecifics = optionalArray(c, item, "hardSpecifics", p);
    stringArray(c, hardSpecifics, child(p, "hardSpecifics"));
  });
  return c.findings.length ? { ok: false, findings: c.findings } : { ok: true, value: raw as SourceAnchorForPrompt[], findings: [] };
}

export function validateAllConfigFiles(configDir = CONFIG_DIR): RuntimeSchemaFinding[] {
  const findings: RuntimeSchemaFinding[] = [];
  let files: string[];
  try {
    files = readdirSync(configDir).filter((file) => file.endsWith(".json") && !file.endsWith(".schema.json")).sort();
  } catch (err) {
    return [{
      checkId: "schema.config_contract",
      severity: "blocker",
      path: "/config",
      expected: "readable config directory",
      observed: observedSummary((err as Error).message),
      message: `/config: expected readable config directory; observed ${(err as Error).message}`,
    }];
  }
  for (const file of files) {
    const path = resolve(configDir, file);
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(path, "utf8"));
    } catch (err) {
      findings.push({
        checkId: "schema.config_contract",
        severity: "blocker",
        path: `/${file}`,
        expected: "valid JSON",
        observed: observedSummary((err as Error).message),
        message: `/${file}: expected valid JSON; observed ${(err as Error).message}`,
      });
      continue;
    }
    findings.push(...validateConfigObject(file, raw));
    if (isRecord(raw) && typeof raw.$schema === "string") {
      const schemaPath = resolve(configDir, raw.$schema);
      if (!existsSync(schemaPath)) {
        findings.push({
          checkId: "schema.config_contract",
          severity: "blocker",
          path: `/${file}/$schema`,
          expected: "existing schema file",
          observed: raw.$schema,
          message: `/${file}/$schema: expected existing schema file; observed ${raw.$schema}`,
        });
      }
    }
  }
  return findings;
}

function validateConfigObject(file: string, raw: unknown): RuntimeSchemaFinding[] {
  const c = new Collector("schema.config_contract");
  if (!isRecord(raw)) {
    c.issue(`/${file}`, "config object", raw);
    return c.findings;
  }
  const p = `/${file}`;
  switch (file) {
    case "author-voice-profiles.json": {
      requiredString(c, raw, "version", p);
      const profiles = requiredRecord(c, raw, "profiles", p);
      if (profiles) {
        for (const [key, profile] of Object.entries(profiles)) {
          const pp = child(child(p, "profiles"), key);
          if (!isRecord(profile)) {
            c.issue(pp, "voice profile object", profile);
            continue;
          }
          for (const field of ["bookId", "author", "register"]) requiredString(c, profile, field, pp);
          optionalBoolean(c, profile, "unconfirmed", pp);
          stringArray(c, optionalArray(c, profile, "avoidFrames", pp), child(pp, "avoidFrames"));
          validateNumberRecord(c, optionalRecord(c, profile, "naturalCounterShapes", pp), child(pp, "naturalCounterShapes"));
          validateNumberRecord(c, optionalRecord(c, profile, "naturalHookShapes", pp), child(pp, "naturalHookShapes"));
        }
      }
      break;
    }
    case "banned-connectives.json":
      stringArray(c, requiredArray(c, raw, "bannedConnectives", p), child(p, "bannedConnectives"));
      stringArray(c, requiredArray(c, raw, "openerPatternsToVary", p), child(p, "openerPatternsToVary"));
      break;
    case "banned-phrases.json":
      requiredString(c, raw, "version", p);
      validatePhraseEntries(c, requiredArray(c, raw, "hardBanned", p), child(p, "hardBanned"), false);
      validatePhraseEntries(c, optionalArray(c, raw, "softBanned", p), child(p, "softBanned"), true);
      break;
    case "categories.json": {
      requiredString(c, raw, "version", p);
      stringArray(c, requiredArray(c, raw, "canonical", p), child(p, "canonical"));
      validateStringRecord(c, requiredRecord(c, raw, "aliases", p), child(p, "aliases"));
      break;
    }
    case "critic-rubric.json": {
      requiredString(c, raw, "version", p);
      requiredRecord(c, raw, "shipGate", p);
      const checks = requiredArray(c, raw, "checks", p);
      if (checks) {
        checks.forEach((check, i) => {
          const cp = child(child(p, "checks"), i);
          if (!isRecord(check)) {
            c.issue(cp, "critic rubric check object", check);
            return;
          }
          for (const field of ["id", "severity", "kind", "description"]) requiredString(c, check, field, cp);
          stringArray(c, requiredArray(c, check, "appliesTo", cp), child(cp, "appliesTo"));
        });
      }
      break;
    }
    case "meta-patterns.json": {
      requiredString(c, raw, "version", p);
      validatePatternEntries(c, requiredArray(c, raw, "metaReferencePatterns", p), child(p, "metaReferencePatterns"));
      validatePatternEntries(c, requiredArray(c, raw, "chapterNumberPatterns", p), child(p, "chapterNumberPatterns"));
      const allowed = requiredRecord(c, raw, "allowedMetaContexts", p);
      if (allowed) stringArray(c, requiredArray(c, allowed, "bypassFields", child(p, "allowedMetaContexts")), child(child(p, "allowedMetaContexts"), "bypassFields"));
      break;
    }
    case "name-policy.json":
      requiredString(c, raw, "schemaVersion", p);
      requiredString(c, raw, "policyId", p);
      requiredString(c, raw, "primaryNameSource", p);
      requiredString(c, raw, "auditNameSource", p);
      requiredRecord(c, raw, "withinBook", p);
      requiredRecord(c, raw, "catalogCooldown", p);
      break;
    case "named-frameworks.json":
      for (const [bookId, entries] of Object.entries(raw)) {
        if (bookId.startsWith("_")) continue;
        if (!Array.isArray(entries)) {
          c.issue(child(p, bookId), "array of framework entries", entries);
          continue;
        }
        entries.forEach((entry, i) => {
          const ep = child(child(p, bookId), i);
          if (!isRecord(entry)) {
            c.issue(ep, "framework entry object", entry);
            return;
          }
          requiredString(c, entry, "name", ep);
          stringArray(c, requiredArray(c, entry, "members", ep), child(ep, "members"));
          optionalBoolean(c, entry, "acronym", ep);
        });
      }
      break;
    case "pedagogy-palettes.json":
      for (const field of ["hookShapes", "tryThisNowForms"]) validateIdDefinitionArray(c, optionalArray(c, raw, field, p), child(p, field));
      break;
    case "scenario-openers.json":
      validateIdDefinitionArray(c, requiredArray(c, raw, "openers", p), child(p, "openers"));
      break;
    case "scene-mechanisms.json":
      validateIdDefinitionArray(c, requiredArray(c, raw, "mechanisms", p), child(p, "mechanisms"), "directive");
      break;
    case "scene-shapes.json":
      validateIdDefinitionArray(c, requiredArray(c, raw, "shapes", p), child(p, "shapes"));
      break;
    case "stakes-palette.json":
      validateIdDefinitionArray(c, requiredArray(c, raw, "stakes", p), child(p, "stakes"));
      break;
    case "venue-palette.json":
      stringArray(c, requiredArray(c, raw, "venues", p), child(p, "venues"), { min: 1 });
      break;
    case "name-bank.json":
      for (const [group, entries] of Object.entries(raw)) {
        if (group.startsWith("_")) continue;
        if (!Array.isArray(entries)) c.issue(child(p, group), "array of names", entries);
        else stringArray(c, entries, child(p, group));
      }
      break;
    default:
      break;
  }
  return c.findings;
}

function validateNumberRecord(c: Collector, record: Record<string, unknown> | null, path: string): void {
  if (!record) return;
  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== "number" || !Number.isFinite(value)) c.issue(child(path, key), "finite number", value);
  }
}

function validateStringRecord(c: Collector, record: Record<string, unknown> | null, path: string): void {
  if (!record) return;
  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== "string" || value.trim().length === 0) c.issue(child(path, key), "nonempty string", value);
  }
}

function validatePhraseEntries(c: Collector, entries: unknown[] | null, path: string, soft: boolean): void {
  if (!entries) return;
  entries.forEach((entry, i) => {
    const p = child(path, i);
    if (!isRecord(entry)) {
      c.issue(p, "phrase entry object", entry);
      return;
    }
    requiredString(c, entry, "phrase", p);
    requiredString(c, entry, "reason", p);
    if (soft) requiredFiniteNumber(c, entry, "perBookBudget", p);
  });
}

function validatePatternEntries(c: Collector, entries: unknown[] | null, path: string): void {
  if (!entries) return;
  entries.forEach((entry, i) => {
    const p = child(path, i);
    if (!isRecord(entry)) {
      c.issue(p, "pattern entry object", entry);
      return;
    }
    requiredString(c, entry, "id", p);
    requiredString(c, entry, "pattern", p);
    requiredString(c, entry, "severity", p);
  });
}

function validateIdDefinitionArray(c: Collector, entries: unknown[] | null, path: string, textKey = "definition"): void {
  if (!entries) return;
  entries.forEach((entry, i) => {
    const p = child(path, i);
    if (!isRecord(entry)) {
      c.issue(p, "palette entry object", entry);
      return;
    }
    requiredString(c, entry, "id", p);
    requiredString(c, entry, textKey, p);
    optionalString(c, entry, "proneClass", p);
    optionalString(c, entry, "example", p);
  });
}
