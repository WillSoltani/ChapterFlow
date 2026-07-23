import assert from "node:assert/strict";

import type { BibliographyResult } from "../../src/agents/researcher-bibliography.js";
import {
  runResearcherChapter,
  type ChapterResearchInput,
  type ChapterResearchResult,
} from "../../src/agents/researcher-chapter.js";
import type { ModelTaskContext } from "../../src/contracts/v4Core.js";
import { createScriptedResultRunner, createUniquenessEnforcingRunner, mintingExecution } from "./fakes/uniquenessRunner.js";
import { finishV25Tests, requiredTest } from "./harness.js";

function bibliography(): BibliographyResult {
  return {
    bookId: "the-power-of-moments",
    title: "The Power of Moments",
    author: "Chip Heath and Dan Heath",
    edition: { name: "fixture", chapterCount: 1, language: "English" },
    flatChapters: [{ number: 1, title: "Defining Moments" }],
    thesis: "Brief experiences become disproportionately meaningful when elevation, insight, pride, or connection changes how people remember them.",
    teachingArc: "Concrete scenes establish why ordinary transitions are forgettable, then show how deliberate peaks can alter memory and future behavior.",
    authorVoice: {
      register: "plainspoken",
      signatureMoves: ["concrete scenes", "causal contrasts", "short labels"],
      avoidMoves: ["ornamental abstractions"],
    },
    confidence: "high",
  };
}

/** A known-good source-v2 chapter that passes both the length/meta validator
 *  and the source-v2 integrity gate (mirrors the clean fixture in
 *  v4-research-candidate-intake.test.ts). */
function validChapter(): ChapterResearchResult {
  const prefix = "ch01";
  const examples = [
    {
      label: "Magic Castle Hotel Popsicle Hotline",
      summary: "Magic Castle Hotel guests lift a red telephone beside the pool and receive a poolside popsicle service on a silver tray.",
      specifics: ["Magic Castle Hotel", "red telephone beside the pool"],
    },
    {
      label: "John Deere First Day Experience",
      summary: "John Deere redesigned a new employee arrival around a prepared workstation and a welcome message from a named manager.",
      specifics: ["John Deere", "prepared workstation"],
    },
    {
      label: "Sharp HealthCare All-Staff Assembly",
      summary: "Sharp HealthCare gathered staff for an all-staff assembly that made its patient-experience commitment visible across roles.",
      specifics: ["Sharp HealthCare", "all-staff assembly"],
    },
  ];
  const facts: Array<[string, string]> = [
    ["Magic Castle Hotel uses one red poolside telephone to make service visible.", "Because the red telephone creates sensory contrast, guests can retrieve the service encounter later."],
    ["John Deere prepares a workstation before a new employee arrives on day one.", "Because visible preparation signals belonging, the first arrival carries meaning beyond routine setup."],
    ["Sharp HealthCare convenes one all-staff assembly across clinical and support roles.", "Because shared attendance synchronizes attention, separate roles receive the same transition signal."],
    ["A bounded peak occupies less time than the routine surrounding it.", "Because memory weights distinctive transitions, duration alone does not determine later recall."],
    ["Poolside popsicle service pairs a concrete object with a named delivery ritual.", "Because object and ritual arrive together, the service becomes easier to describe accurately."],
    ["A welcome message names the manager responsible for a new employee's arrival.", "Because named ownership reduces ambiguity, the employee knows who prepared the transition."],
    ["One prepared first day can establish a reference point for later workplace judgments.", "Because early evidence anchors expectations, later routine is interpreted against that reference point."],
    ["An all-staff gathering makes an institutional commitment observable in one room.", "Because simultaneous observation creates common knowledge, staff can coordinate around the commitment."],
    ["Three distinct cases use different settings while preserving a bounded transition.", "Because setting varies while boundary remains, the mechanism transfers without copying surface details."],
  ];
  const noteRoots = ["elevation", "arrival", "surprise", "threshold", "celebration", "peak"];
  const longNotes = Array.from({ length: 95 }, (_, index) => (
    `${noteRoots[index % noteRoots.length]}-${index + 1} ${noteRoots[(index + 1) % noteRoots.length]}-mechanism ${noteRoots[(index + 2) % noteRoots.length]}-choice ${noteRoots[(index + 3) % noteRoots.length]}-memory.`
  )).join(" ").slice(0, 2200);
  return {
    schemaVersion: "source-v2",
    chapterNumber: 1,
    chapterTitle: "Defining Moments",
    focus: "Deliberate contrast turns an ordinary transition into a memorable event with enough specificity to guide a later choice.",
    coreClaim: "Meaningful moments become memorable when a concrete break in routine changes attention and interpretation.",
    centralConcept: {
      id: `${prefix}.concept.memorable-moment`,
      name: "memorable moment",
      plainDefinition: "A memorable moment is a bounded experience whose contrast and meaning make it easier to retrieve than surrounding routine.",
      whyItMatters: "Designers can improve important transitions without trying to make every minute exceptional.",
    },
    keyClaims: [
      "Contrast directs attention toward a bounded event.",
      "Specific sensory cues improve later retrieval.",
      "A clear transition gives an experience a usable shape.",
      "Meaning changes what people carry into later decisions.",
    ],
    namedExamples: examples.map((example, index) => ({
      id: `${prefix}.case.${index + 1}`,
      label: example.label,
      summary: example.summary,
      teachesWhat: "A small bounded intervention can create useful contrast without redesigning an entire experience.",
      hardSpecifics: example.specifics,
      realWorld: true,
    })),
    hardEdge: "Memorability is not constant spectacle or emotional manipulation. Useful peaks stay bounded, serve a real transition, and leave people free to interpret the experience.",
    voiceCues: ["opens with a concrete scene", "moves from contrast to mechanism"],
    paraphraseNotes: longNotes,
    testableFacts: facts.map(([claim, becauseMechanism], index) => ({
      id: `${prefix}.fact.${index + 1}`,
      claim,
      becauseMechanism,
      commonError: `Only total duration determines whether source fact ${index + 1} will matter later.`,
      errorIsWhy: `Specific contrast and interpretation, not duration alone, explain source fact ${index + 1}.`,
    })),
    frameworks: [{ name: "Moment frame 1", members: ["contrast", "meaning", "retrieval"] }],
  };
}

/** The exact bad shape observed in the 2026-07-23 live canary: a model-minted
 *  schemaVersion that exists nowhere in the repo, with every field empty. */
function canaryBadOutput(): unknown {
  return {
    schemaVersion: "chapterflow-analysis-v1",
    chapterNumber: 0,
    chapterTitle: "",
    focus: "",
    coreClaim: "",
    centralConcept: { name: "", plainDefinition: "", whyItMatters: "" },
    keyClaims: [],
    namedExamples: [],
    hardEdge: "",
    voiceCues: [],
    paraphraseNotes: "",
    testableFacts: [],
  };
}

/** Structurally-complete sidecar engineered to trip ONLY the advisory realness
 *  signals that gate the research route (placeholder examples + repeated
 *  boilerplate => SV2.realness_fabricated_sidecar) while passing every
 *  blocker-level check, length floor, and meta-reference guard. This is the
 *  canonical padded/fabricated Sonnet failure mode: the port's requireSourceV2
 *  rejects it, so the retry-admission predicate MUST also reject it (retry)
 *  rather than admitting it on attempt 1 and then hard-failing at the port. */
function fabricatedButStructurallyComplete(): ChapterResearchResult {
  const prefix = "ch01";
  const sharedSummary = "Company A1 rolled out a bounded workplace ritual that made a routine transition visible to every new hire on day one there.";
  const examples = Array.from({ length: 3 }, (_, i) => ({
    id: `${prefix}.case.${i + 1}`,
    label: `Case A${i + 1}`, // matches PLACEHOLDER_RE -> placeholder signal + shape
    summary: sharedSummary,   // identical across 3 -> repeated boilerplate signal + shape
    teachesWhat: "A small bounded intervention can create useful contrast without redesigning an entire experience.",
    hardSpecifics: ["Company A1", "day one"],
    realWorld: true,
  }));
  const facts = Array.from({ length: 9 }, (_, i) => ({
    id: `${prefix}.fact.${i + 1}`,
    claim: `Company A1 uses a bounded ritual number ${i + 1} to make a workplace transition observable to new staff members.`,
    becauseMechanism: `Because a visible ritual creates contrast, staff can later retrieve transition ${i + 1} more accurately than routine.`,
    commonError: `Only total duration determines whether ritual ${i + 1} will matter to a new hire later on.`,
    errorIsWhy: `Specific contrast and interpretation, not duration alone, explain why ritual ${i + 1} is remembered.`,
  }));
  const longNotes = Array.from({ length: 95 }, (_, i) => `ritual-${i + 1} contrast-mechanism meaning-choice retrieval-memory.`).join(" ").slice(0, 2200);
  return {
    ...validChapter(),
    namedExamples: examples,
    testableFacts: facts,
    paraphraseNotes: longNotes,
  };
}

/** A valid-shaped output that trips the meta-reference content guard. */
function metaReferenceOutput(): ChapterResearchResult {
  return {
    ...validChapter(),
    coreClaim: "The author argues that meaningful moments become memorable when a concrete break in routine changes attention.",
  };
}

function input(): ChapterResearchInput {
  return {
    bibliography: bibliography(),
    chapter: { number: 1, title: "Defining Moments" },
    priorChapterTitles: [],
  };
}

/** Fake runner that dispenses queued model outputs (clamping to the last entry
 *  on overflow) AND enforces run-state's attempt-uniqueness invariant: a second
 *  run() with an already-admitted (runId, attemptId) returns the exact
 *  MODEL_ATTEMPT_EXISTS ModelResult the real gateway returns, so a retry that
 *  reuses a frozen context fails closed the way the live canary did. The
 *  execution mints a fresh attempt identity per invocation via nextContext,
 *  mirroring the research port's operationExecution — so a CORRECT retry loop
 *  admits a new attempt each time and never trips the uniqueness guard. */
function rig(outputs: readonly unknown[]) {
  const base: ModelTaskContext = {
    bookId: "the-power-of-moments",
    runId: "run-fixture",
    attemptId: "attempt-fixture",
    stageId: "research",
    operationId: "research-ch01",
    workDir: "/tmp/cf-v25-canary-retry",
    signal: new AbortController().signal,
  };
  const { runner, prompts, calls } = createUniquenessEnforcingRunner(outputs);
  const execution = mintingExecution(runner, base);
  return { execution, prompts, calls };
}

requiredTest("1 invalid canary output succeeds after one retry with validator feedback + prior output in prompt", async () => {
  const subject = rig([canaryBadOutput(), validChapter()]);
  const result = await runResearcherChapter(input(), subject.execution);

  assert.equal(result.schemaVersion, "source-v2");
  assert.equal(result.chapterNumber, 1);
  assert.equal(subject.calls(), 2);

  const retryPrompt = subject.prompts[1];
  // (a) the retry prompt names the rejection and includes validator error lines
  assert.match(retryPrompt, /PREVIOUS ATTEMPT WAS REJECTED/);
  assert.match(retryPrompt, /focus too short/);
  // (b) the retry prompt echoes the prior bad output so the model sees its mistake
  assert.match(retryPrompt, /chapterflow-analysis-v1/);
  // the first prompt must NOT carry any retry feedback
  assert.doesNotMatch(subject.prompts[0], /PREVIOUS ATTEMPT WAS REJECTED/);
});

requiredTest("2 content-guard (meta-reference) rejection retries the same way and then succeeds", async () => {
  const subject = rig([metaReferenceOutput(), validChapter()]);
  const result = await runResearcherChapter(input(), subject.execution);

  assert.equal(result.schemaVersion, "source-v2");
  assert.equal(subject.calls(), 2);
  const retryPrompt = subject.prompts[1];
  assert.match(retryPrompt, /PREVIOUS ATTEMPT WAS REJECTED/);
  assert.match(retryPrompt, /meta-reference/);
});

requiredTest("3 persistently invalid output fails closed after MAX_ATTEMPTS(3) with accumulated validator errors", async () => {
  const subject = rig([canaryBadOutput()]);
  await assert.rejects(
    runResearcherChapter(input(), subject.execution),
    (error: unknown) => {
      const message = (error as Error).message;
      assert.match(message, /focus too short/);
      assert.match(message, /3 attempt/i);
      return true;
    },
  );
  // exactly MAX_ATTEMPTS model calls — never a fourth
  assert.equal(subject.calls(), 3);
});

requiredTest("4 fabricated-but-structurally-complete sidecar is retried (not admitted on attempt 1) so it never reaches the port's hard reject", async () => {
  const subject = rig([fabricatedButStructurallyComplete(), validChapter()]);
  const result = await runResearcherChapter(input(), subject.execution);

  assert.equal(result.schemaVersion, "source-v2");
  // The bad output MUST drive a retry — admitting it on attempt 1 (calls === 1)
  // is the exact defect: the port's requireSourceV2 would then RESEARCH_SOURCE_V2_INVALID-abort.
  assert.equal(subject.calls(), 2);
  const retryPrompt = subject.prompts[1];
  assert.match(retryPrompt, /PREVIOUS ATTEMPT WAS REJECTED/);
  assert.match(retryPrompt, /SV2\.realness_fabricated_sidecar/);
});

/** Build a minting execution over a scripted-result runner (per-invocation
 *  fresh attempt identity, mirroring the research port), so each retry admits a
 *  distinct attempt id exactly as 11b requires. */
function scriptedRig(script: readonly Readonly<{ outcome: "SUCCEEDED" | "FAILED" | "TIMED_OUT" | "CANCELLED" | "UNKNOWN"; output?: unknown; error?: { code: string; message: string } }>[]) {
  const base: ModelTaskContext = {
    bookId: "the-power-of-moments",
    runId: "run-fixture",
    attemptId: "attempt-fixture",
    stageId: "research",
    operationId: "research-ch01",
    workDir: "/tmp/cf-v25-canary-retry",
    signal: new AbortController().signal,
  };
  const { runner, prompts, runs } = createScriptedResultRunner(script);
  const seen = new Set<string>();
  const attemptIds: string[] = [];
  // Wrap the runner to record + enforce fresh attempt ids across invocations,
  // proving 11b minting still applies on the gateway-rejection retry path.
  const recordingRunner = {
    async run(request: Parameters<typeof runner.run>[0]) {
      attemptIds.push(request.context.attemptId);
      if (seen.has(request.context.attemptId)) throw new Error(`attempt id reused: ${request.context.attemptId}`);
      seen.add(request.context.attemptId);
      return runner.run(request);
    },
  };
  const execution = mintingExecution(recordingRunner, base);
  return { execution, prompts, runs, attemptIds };
}

requiredTest("5 gateway MODEL_OUTPUT_INVALID rejection is validator-class: retries with schema feedback and a fresh attempt id, then succeeds", async () => {
  const subject = scriptedRig([
    { outcome: "FAILED", error: { code: "MODEL_OUTPUT_INVALID", message: "model output failed source-controlled schema validation" } },
    { outcome: "SUCCEEDED", output: validChapter() },
  ]);
  const result = await runResearcherChapter(input(), subject.execution);

  assert.equal(result.schemaVersion, "source-v2");
  assert.equal(result.chapterNumber, 1);
  // exactly two model calls: the rejected one + the successful retry
  assert.equal(subject.runs(), 2);
  // 11b: the retry admitted a DISTINCT attempt id (no reuse of the rejected one)
  assert.equal(new Set(subject.attemptIds).size, 2);
  const retryPrompt = subject.prompts[1];
  assert.match(retryPrompt, /PREVIOUS ATTEMPT WAS REJECTED/);
  assert.match(retryPrompt, /gateway schema validation rejected the previous output/);
  // schema reminder is present so the model knows the required envelope
  assert.match(retryPrompt, /schemaVersion is exactly "source-v2"/);
  // the raw invalid output is NOT available from the gateway — do not fabricate one
  assert.doesNotMatch(retryPrompt, /Your previous \(rejected\) output was/);
});

requiredTest("6 genuine infra failures propagate immediately with NO retry", async () => {
  for (const infra of [
    { code: "MODEL_RUN_CANCELLED", outcome: "CANCELLED" as const },
    { code: "MODEL_ATTEMPT_EXISTS", outcome: "UNKNOWN" as const },
    { code: "MODEL_CAPACITY_EXHAUSTED", outcome: "FAILED" as const },
  ]) {
    const subject = scriptedRig([
      { outcome: infra.outcome, error: { code: infra.code, message: "infra failure" } },
      { outcome: "SUCCEEDED", output: validChapter() },
    ]);
    await assert.rejects(
      runResearcherChapter(input(), subject.execution),
      (error: unknown) => {
        assert.match((error as Error).message, new RegExp(infra.code));
        return true;
      },
    );
    // propagated on the first call — the success at index 1 was never reached
    assert.equal(subject.runs(), 1, `${infra.code} must not retry`);
  }
});

/** A recording sleep: resolves instantly (no real wall-clock wait) while
 *  capturing every backoff duration the retry loop requested, so the schedule
 *  is asserted deterministically. */
function recordingSleep() {
  const waited: number[] = [];
  return { sleep: async (ms: number): Promise<void> => { waited.push(ms); }, waited };
}

requiredTest("7 transient MODEL_PROCESS_FAILED retries after a bounded backoff with a fresh attempt id, then succeeds", async () => {
  const subject = scriptedRig([
    { outcome: "FAILED", error: { code: "MODEL_PROCESS_FAILED", message: "bounded model process did not succeed" } },
    { outcome: "SUCCEEDED", output: validChapter() },
  ]);
  const clock = recordingSleep();
  const result = await runResearcherChapter(input(), subject.execution, { sleep: clock.sleep });

  assert.equal(result.schemaVersion, "source-v2");
  assert.equal(result.chapterNumber, 1);
  // exactly two model calls: the transient failure + the successful retry
  assert.equal(subject.runs(), 2);
  // 11b: the retry admitted a DISTINCT attempt id (never re-spawns the failed one)
  assert.equal(new Set(subject.attemptIds).size, 2);
  // one backoff fired before the single retry, at the first schedule step
  assert.deepEqual(clock.waited, [2000]);
  const retryPrompt = subject.prompts[1];
  // the retry prompt notes a transient process failure and fabricates NO output echo
  assert.match(retryPrompt, /transient/i);
  assert.doesNotMatch(retryPrompt, /Your previous \(rejected\) output was/);
  // the schema reminder is still present so the model knows the required envelope
  assert.match(retryPrompt, /schemaVersion is exactly "source-v2"/);
});

requiredTest("8 persistent transient MODEL_PROCESS_FAILED fails closed after MAX_ATTEMPTS(3) with the full backoff schedule and no fourth call", async () => {
  const subject = scriptedRig([
    { outcome: "FAILED", error: { code: "MODEL_PROCESS_FAILED", message: "bounded model process did not succeed" } },
  ]);
  const clock = recordingSleep();
  await assert.rejects(
    runResearcherChapter(input(), subject.execution, { sleep: clock.sleep }),
    (error: unknown) => {
      const message = (error as Error).message;
      assert.match(message, /transient|process/i);
      assert.match(message, /3 attempt/i);
      return true;
    },
  );
  // exactly MAX_ATTEMPTS model calls — never a fourth
  assert.equal(subject.runs(), 3);
  // backoff fired between attempt 1→2 and 2→3, and never after the final attempt
  assert.deepEqual(clock.waited, [2000, 8000]);
  // every attempt admitted a fresh, non-colliding attempt id
  assert.equal(new Set(subject.attemptIds).size, 3);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
