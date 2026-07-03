import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve } from "path";

import { assembleChapterV21 } from "../src/assembler.js";
import { runBookGate } from "../src/critics/bookGate.js";
import { runShipGate, type GateFinding } from "../src/critics/finalGate.js";
import { validateAllConfigFiles } from "../src/runtimeSchemas.js";
import { test } from "./harness.js";
import { makeChapter, PIPELINE_DIR } from "./helpers.js";

function allShipFindings(report: ReturnType<typeof runShipGate>): GateFinding[] {
  return [...report.blockers, ...report.majors, ...report.minors];
}

function deterministicJson(seed: number): unknown {
  let state = seed >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
  const build = (depth: number): unknown => {
    const pick = Math.floor(next() * (depth > 3 ? 5 : 8));
    if (pick === 0) return null;
    if (pick === 1) return next() > 0.5;
    if (pick === 2) return Math.floor(next() * 1000);
    if (pick === 3) return `s${Math.floor(next() * 100)}`;
    if (pick === 4) return undefined;
    if (pick === 5) return Array.from({ length: Math.floor(next() * 4) }, () => build(depth + 1));
    const out: Record<string, unknown> = {};
    for (const key of ["chapterId", "number", "breakdown", "quiz", "examples", "reviewCards"].slice(0, 1 + Math.floor(next() * 6))) {
      out[key] = build(depth + 1);
    }
    return out;
  };
  return build(0);
}

test("runShipGate is total over malformed JSON and reports schema paths", () => {
  const values: unknown[] = [
    null,
    true,
    7,
    "chapter",
    [],
    [null, { quiz: 1 }],
    {},
    {
      chapterId: 12,
      number: "one",
      title: null,
      readingTimeMinutes: "fast",
      hook: {},
      keyTakeaway: [],
      breakdown: { fastRead: 42 },
      examples: [{ exampleId: 1, scenario: null }],
      quiz: { questions: [{ questionId: "q01", prompt: 7, choices: null, correctIndex: "0" }] },
      reviewCards: "cards",
      implementationPlan: {},
    },
    ...Array.from({ length: 40 }, (_, i) => deterministicJson(i + 1)),
  ];

  for (const value of values) {
    let report: ReturnType<typeof runShipGate> | undefined;
    assert.doesNotThrow(() => {
      report = runShipGate(value as any);
    }, `runShipGate must not throw for ${JSON.stringify(value)}`);
    assert.ok(report, "report should be returned");
    assert.equal(report!.passed, false, "malformed input must not pass");
    assert.ok(
      allShipFindings(report!).some((f) => f.catalogId === "schema.chapter_contract" && f.unit.startsWith("/")),
      `expected schema.chapter_contract finding with JSON pointer path, got ${JSON.stringify(allShipFindings(report!))}`,
    );
  }
});

test("schema failure short-circuits unsafe chapter critics", () => {
  const report = runShipGate({
    chapterId: "zz-schema-ch01",
    number: 1,
    title: "Broken",
    readingTimeMinutes: 4,
    hook: "A valid-looking hook keeps the top-level field from being the failure.",
    keyTakeaway: "A valid-looking takeaway keeps the top-level field from being the failure.",
    breakdown: null,
    examples: [],
    quiz: { questions: [] },
    reviewCards: [],
    implementationPlan: { ifThenPlans: [] },
  } as any);
  const findings = allShipFindings(report);
  assert.ok(findings.length > 0, "schema findings should be present");
  assert.ok(
    findings.every((f) => f.catalogId === "schema.chapter_contract"),
    `unsafe deeper critics must not run after schema failure, got ${findings.map((f) => f.catalogId).join(", ")}`,
  );
  assert.ok(findings.some((f) => f.unit === "/breakdown"));
});

test("runBookGate is total over malformed chapter arrays and reports schema paths", () => {
  const malformedInputs: unknown[] = [
    null,
    7,
    "chapters",
    {},
    [null],
    [{ chapterId: "zz-ch01", number: "one", quiz: {} }],
    [makeChapter("zz-book-schema", 1), { chapterId: "zz-book-schema-ch02", quiz: { questions: "bad" } }],
  ];
  for (const chapters of malformedInputs) {
    let report: ReturnType<typeof runBookGate> | undefined;
    assert.doesNotThrow(() => {
      report = runBookGate("zz-book-schema", chapters as any);
    }, `runBookGate must not throw for ${JSON.stringify(chapters)}`);
    assert.ok(report, "report should be returned");
    assert.equal(report!.passed, false, "malformed book input must not pass");
    assert.ok(
      report!.findings.some((f) => f.catalogId === "schema.book_contract" && (f as any).path?.startsWith("/")),
      `expected schema.book_contract finding with path, got ${JSON.stringify(report!.findings)}`,
    );
  }
});

test("assembler rejects misaligned planner/output arrays before indexing", () => {
  const plan = {
    chapterId: "zz-assembler-ch01",
    number: 1,
    title: "Assembler Boundary",
    coreMove: "Check every generated array against the planner before indexing.",
    exampleCount: 2,
    exampleSpecs: [
      { domain: "support inbox", audience: "team lead", stakes: "bad handoff", format: "vignette", requiredBeat: "the handoff breaks" },
    ],
    quizFocus: { count: 1, bloomsMix: { apply: 1 }, transferEmphasis: 1 },
    cardFocus: { count: 1, retrievalPractice: true },
    readingTimeMinutes: 5,
  };
  const result = (assembleChapterV21 as (input: unknown) => any)({
    plan,
    breakdown: { fastRead: "fast", deepRead: "deep", fullRead: "full" },
    examples: [
      { exampleId: "ex01", title: "One", scenario: "A", whatToDo: "B", whyItMatters: "C" },
      { exampleId: "ex02", title: "Two", scenario: "D", whatToDo: "E", whyItMatters: "F" },
    ],
    quiz: {
      passingScorePercent: 70,
      questions: [{ questionId: "wrong-id", prompt: "P", choices: ["A", "B", "C"], correctIndex: 0, explanation: "E", bloomsLevel: "apply", depthLevel: "standard" }],
    },
    cards: { cards: [{ cardId: "rc01", front: "F", back: "B", difficulty: "easy" }] },
    implementationPlan: {
      title: "Boundary Check",
      coreSkill: "Validate arrays first.",
      ifThenPlans: [{ context: "before write", plan: "If arrays differ, then stop." }],
      twentyFourHourChallenge: "Check one fixture.",
      weeklyPractice: "Check all fixtures.",
    },
    keyTakeaway: "Validate before indexing.",
    hook: { hook: "The second example should never steal the first spec." },
  });

  assert.equal(result.ok, false, "misaligned assembler input should return blockers");
  assert.ok(
    result.findings.some((f: any) => f.checkId === "schema.assembler_contract" && f.path === "/plan/exampleSpecs"),
    `expected planner array path blocker, got ${JSON.stringify(result.findings)}`,
  );
});

test("schema-valid chapters still run existing deeper critics", () => {
  const ch = makeChapter("zz-schema-valid", 1);
  const cleanSchemaFindings = allShipFindings(runShipGate(ch)).filter((f) => f.catalogId === "schema.chapter_contract");
  assert.deepEqual(cleanSchemaFindings, []);

  ch.quiz.questions[0].choices = [ch.quiz.questions[0].choices[0], ch.quiz.questions[0].choices[0], ch.quiz.questions[0].choices[2]];
  const report = runShipGate(ch);
  assert.ok(
    allShipFindings(report).some((f) => f.catalogId === "schema.quiz_duplicate_choice"),
    "valid schema should continue into quiz duplicate-choice critic",
  );
});

test("every checked-in config $schema reference resolves", () => {
  const configDir = resolve(PIPELINE_DIR, "config");
  const missing: string[] = [];
  for (const file of readdirSync(configDir).filter((f) => f.endsWith(".json") && !f.endsWith(".schema.json"))) {
    const raw = JSON.parse(readFileSync(resolve(configDir, file), "utf8")) as { $schema?: string };
    if (!raw.$schema) continue;
    const schemaPath = resolve(configDir, raw.$schema);
    if (!existsSync(schemaPath)) missing.push(`${file} -> ${raw.$schema}`);
  }
  assert.deepEqual(missing, [], `missing config schema file(s): ${missing.join(", ")}`);
});

test("every checked-in config validates against the runtime config contract", () => {
  const findings = validateAllConfigFiles(resolve(PIPELINE_DIR, "config"));
  assert.deepEqual(findings, [], findings.map((f) => f.message).join("\n"));
});
