import assert from "node:assert/strict";

import type { BibliographyResult } from "../../src/agents/researcher-bibliography.js";
import {
  MAX_CHAPTER_RESEARCH_ATTEMPTS,
  MAX_META_REPAIRS_PER_ATTEMPT,
  isDegenerateChapterResearchOutput,
  runResearcherChapter,
  type ChapterResearchInput,
  type ChapterResearchResult,
} from "../../src/agents/researcher-chapter.js";
import type { ModelTaskContext } from "../../src/contracts/v4Core.js";
import { createScriptedResultRunner, createUniquenessEnforcingRunner, mintingExecution } from "./fakes/uniquenessRunner.js";
import { isQuotaExhaustedMessage } from "../../src/runtime/modelErrors.js";
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

/** The exact finding-40 (canary7, 2026-07-24) degenerate output: the model
 *  returned a bare `{}` on the RETRY — no fields at all (schemaVersion, chapter
 *  number, every field absent). The validator reports "everything missing", and
 *  before the fix the loop echoed this `{}` back as the "prior draft to repair",
 *  entrenching the empty across attempts 2→3 (observed 2/2). */
function emptyObjectOutput(): unknown {
  return {};
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

requiredTest("1 degenerate (all-empty) output retries with a complete-object directive and NO echo of the empty blob", async () => {
  const subject = rig([canaryBadOutput(), validChapter()]);
  const result = await runResearcherChapter(input(), subject.execution);

  assert.equal(result.schemaVersion, "source-v2");
  assert.equal(result.chapterNumber, 1);
  assert.equal(subject.calls(), 2);

  const retryPrompt = subject.prompts[1];
  // (a) the retry prompt names the rejection and includes validator error lines
  assert.match(retryPrompt, /PREVIOUS ATTEMPT WAS REJECTED/);
  assert.match(retryPrompt, /focus too short/);
  // (b) an all-empty output is DEGENERATE — echoing it back ("do not repeat this")
  //     is worthless and entrenches the emptiness (finding-40: 2/2). The loop must
  //     instead demand a COMPLETE object and NOT echo the skeleton back.
  assert.match(retryPrompt, /almost-empty|empty or skeleton|populate EVERY required field/i);
  // the skeleton is NOT echoed back as a "prior draft to repair" (that is the
  // entrenching behavior); the bogus schemaVersion may still appear inside the
  // SV2 problem LINE, which is legitimate feedback, so we assert on the echo LABEL.
  assert.doesNotMatch(retryPrompt, /repair it, do not restart/);
  // the first prompt must NOT carry any retry feedback
  assert.doesNotMatch(subject.prompts[0], /PREVIOUS ATTEMPT WAS REJECTED/);
});

requiredTest("2 content-guard (meta-reference) rejection spends ONE bounded repair carrying the offending sentence, then succeeds", async () => {
  const subject = rig([metaReferenceOutput(), validChapter()]);
  const result = await runResearcherChapter(input(), subject.execution);

  assert.equal(result.schemaVersion, "source-v2");
  assert.equal(subject.calls(), 2);
  const repairPrompt = subject.prompts[1];

  // R-283 — DELIBERATE CHANGE to this case's second call. A rejection whose ONLY
  // defect is wording in a prose field is not worth a fresh 20 KB draft: the live
  // 2026-09-04 Franklin run spent three of them per chapter and ch01 still ended
  // on "the book" plus a new "Franklin writes". The second call is now a bounded
  // repair that receives the offending sentences and rewrites only those. The
  // ordinary retry path is unchanged and is pinned by cases 1, 3 and 11.
  assert.match(repairPrompt, /# Repair task/);
  assert.match(repairPrompt, /meta-reference/);
  // It names the FIELD and quotes the offending SENTENCE — the thing the
  // phrase-only feedback never did, and the reason the live run could not converge.
  assert.match(repairPrompt, /found in `coreClaim`/);
  assert.ok(
    repairPrompt.includes(metaReferenceOutput().coreClaim),
    "the repair must receive the offending sentence verbatim",
  );

  // The card must NAME the book's own author as the remedy. A live Franklin run
  // died 3/3 on "the author": in an autobiography the author IS the subject, so a
  // model told only what is banned has no legal move. Naming them is the move.
  assert.match(repairPrompt, /Chip Heath and Dan Heath/,
    "the remedy must name THIS book's author, not describe the ban abstractly");

  // ...and must carry no OTHER book's vocabulary. The old card enumerated
  // "Allen writes" and told the model to state facts about
  // "people/thought/circumstances" — As a Man Thinketh's thesis, hardcoded into
  // the universal researcher contract. That is the leak bookScars exists to stop.
  assert.doesNotMatch(repairPrompt, /Allen writes/, "no foreign book's scar tissue in a universal contract");
  assert.doesNotMatch(repairPrompt, /thought\/circumstances/, "no foreign book's thesis vocabulary");

  // The repaired sidecar passed the SAME validator, and says so on the sidecar
  // that gets written to disk.
  assert.ok(result.metaRepair, "a repaired sidecar records the repair in its provenance");
  assert.equal(result.metaRepair?.attempt, 1);
  assert.deepEqual(result.metaRepair?.offenses.map((offense) => offense.match), ["The author"]);
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

requiredTest("9 timed-out attempt (outcome TIMED_OUT) retries after a bounded backoff with a fresh attempt id, then succeeds", async () => {
  // Task 11k: a chapter-research call killed at the profile timeout horizon
  // surfaces as outcome TIMED_OUT (the gateway stamps code MODEL_PROCESS_FAILED).
  // claude -p buffers ALL stdout until completion, so a timeout says nothing
  // about progress — a fresh re-spawn against the same bounded budget routinely
  // completes. It is a transient class: retried after a bounded backoff.
  const subject = scriptedRig([
    { outcome: "TIMED_OUT", error: { code: "MODEL_PROCESS_FAILED", message: "bounded model process did not succeed" } },
    { outcome: "SUCCEEDED", output: validChapter() },
  ]);
  const clock = recordingSleep();
  const result = await runResearcherChapter(input(), subject.execution, { sleep: clock.sleep });

  assert.equal(result.schemaVersion, "source-v2");
  assert.equal(result.chapterNumber, 1);
  // exactly two model calls: the timed-out attempt + the successful retry
  assert.equal(subject.runs(), 2);
  // 11b: the retry admitted a DISTINCT attempt id (never re-spawns the timed-out one)
  assert.equal(new Set(subject.attemptIds).size, 2);
  // one backoff fired before the single retry, at the first schedule step
  assert.deepEqual(clock.waited, [2000]);
  const retryPrompt = subject.prompts[1];
  // the retry prompt notes a timeout and fabricates NO output echo
  assert.match(retryPrompt, /timed out/i);
  assert.doesNotMatch(retryPrompt, /Your previous \(rejected\) output was/);
  // the schema reminder is still present so the model knows the required envelope
  assert.match(retryPrompt, /schemaVersion is exactly "source-v2"/);
});

requiredTest("10 persistent TIMED_OUT fails closed after MAX_ATTEMPTS(3) with the full backoff schedule and no fourth call", async () => {
  const subject = scriptedRig([
    { outcome: "TIMED_OUT", error: { code: "MODEL_PROCESS_FAILED", message: "bounded model process did not succeed" } },
  ]);
  const clock = recordingSleep();
  await assert.rejects(
    runResearcherChapter(input(), subject.execution, { sleep: clock.sleep }),
    (error: unknown) => {
      const message = (error as Error).message;
      assert.match(message, /timed out/i);
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

requiredTest("14 durable QUOTA EXHAUSTION (weekly limit) fails fast on attempt 1 — no retry, no backoff, real API message (Task 11af)", async () => {
  const subject = scriptedRig([
    { outcome: "FAILED", error: { code: "MODEL_PROCESS_FAILED", message: "You've hit your weekly limit \u00b7 resets Jul 28 at 8pm (America/Halifax) (api_error_status=429)" } },
  ]);
  const clock = recordingSleep();
  await assert.rejects(
    runResearcherChapter(input(), subject.execution, { sleep: clock.sleep }),
    (error: unknown) => {
      const message = (error as Error).message;
      assert.match(message, /weekly limit/i, "operator must see the real provider message");
      assert.doesNotMatch(message, /transient model process failure/i, "quota exhaustion is not a transient blip");
      return true;
    },
  );
  assert.equal(subject.runs(), 1, "quota exhaustion must not burn further attempts");
  assert.deepEqual(clock.waited, [], "no backoff wait on a durable quota block");
});

requiredTest("15 a SHORT rate-limit 429 without a reset horizon stays transient and still retries (Task 11af)", async () => {
  const subject = scriptedRig([
    { outcome: "FAILED", error: { code: "MODEL_PROCESS_FAILED", message: "API Error: 429 rate_limit_error: too many requests (api_error_status=429)" } },
  ]);
  const clock = recordingSleep();
  await assert.rejects(runResearcherChapter(input(), subject.execution, { sleep: clock.sleep }), () => true);
  assert.equal(subject.runs(), 3, "short rate limits keep the bounded transient retry");
  assert.deepEqual(clock.waited, [2000, 8000]);
});

requiredTest("16 isQuotaExhaustedMessage separates durable caps from short rate limits (Task 11af)", () => {
  assert.equal(isQuotaExhaustedMessage("You've hit your weekly limit \u00b7 resets Jul 28 at 8pm (America/Halifax) (api_error_status=429)"), true);
  assert.equal(isQuotaExhaustedMessage("usage limit reached for this account"), true);
  assert.equal(isQuotaExhaustedMessage("API Error: 429 rate_limit_error: too many requests"), false);
  assert.equal(isQuotaExhaustedMessage("bounded model process did not succeed"), false);
});

requiredTest("11 substantive validator rejection leads with the task, frames the prior draft as REFERENCE, and echoes it for repair", async () => {
  // A substantive-but-wrong draft is repairable, so the retry MUST echo it — but
  // reframed as reference material to fix, led by a task restatement, not an
  // accusation. Finding-40: the accusatory "fix exactly these" + long banned list
  // raised the model's degenerate-empty rate; leading with the task and keeping
  // the prior draft as reference reduces that pressure.
  //
  // R-283: the draft here also misses a FLOOR, so the bounded lexical repair is
  // not eligible (it can only fix wording) and this case still exercises the
  // ordinary retry path it was written for.
  const subject = rig([{ ...metaReferenceOutput(), voiceCues: ["one cue only"] }, validChapter()]);
  const result = await runResearcherChapter(input(), subject.execution);

  assert.equal(result.schemaVersion, "source-v2");
  assert.equal(subject.calls(), 2);
  const retryPrompt = subject.prompts[1];

  // task-first lead appears BEFORE the rejection header
  const taskIdx = retryPrompt.search(/Continue the SAME task/i);
  const rejectIdx = retryPrompt.search(/PREVIOUS ATTEMPT WAS REJECTED/);
  assert.ok(taskIdx >= 0, "retry prompt must restate the task");
  assert.ok(rejectIdx >= 0);
  assert.ok(taskIdx < rejectIdx, "the task restatement must lead, before the rejection list");

  // the banned-list problem line is preserved
  assert.match(retryPrompt, /meta-reference/);
  assert.match(retryPrompt, /voiceCues needs 2-4 items/, "the floor is what makes this rejection non-repairable");
  // the prior draft is echoed as REFERENCE to repair (not "do not repeat these mistakes")
  assert.match(retryPrompt, /repair it, do not restart/i);
  assert.match(retryPrompt, /The author argues/); // the echoed prior coreClaim
  // NOT treated as a degenerate empty
  assert.doesNotMatch(retryPrompt, /almost-empty/i);
});

requiredTest("12 bare {} degenerate output does NOT echo the empty and demands a complete object", async () => {
  const subject = rig([emptyObjectOutput(), validChapter()]);
  const result = await runResearcherChapter(input(), subject.execution);

  assert.equal(result.schemaVersion, "source-v2");
  assert.equal(subject.calls(), 2);
  const retryPrompt = subject.prompts[1];

  assert.match(retryPrompt, /almost-empty|empty or skeleton|populate EVERY required field/i);
  // the worthless "here is your previous attempt: {}" echo must be gone
  assert.doesNotMatch(retryPrompt, /repair it, do not restart/i);
  // schema reminder still present
  assert.match(retryPrompt, /schemaVersion is exactly "source-v2"/);
});

requiredTest("13 isDegenerateChapterResearchOutput classifies empties vs substantive drafts", () => {
  // finding-40 shapes: bare {} and the all-empty-fields canary are degenerate.
  assert.equal(isDegenerateChapterResearchOutput({}), true);
  assert.equal(isDegenerateChapterResearchOutput(canaryBadOutput()), true);
  assert.equal(isDegenerateChapterResearchOutput(null), true);
  assert.equal(isDegenerateChapterResearchOutput([]), true);
  assert.equal(isDegenerateChapterResearchOutput("{}"), true);
  // any single substantive field makes it repairable, not degenerate
  assert.equal(isDegenerateChapterResearchOutput({ focus: "a real focus sentence" }), false);
  assert.equal(isDegenerateChapterResearchOutput({ keyClaims: ["one claim"] }), false);
  assert.equal(
    isDegenerateChapterResearchOutput({ centralConcept: { name: "x", plainDefinition: "", whyItMatters: "" } }),
    false,
  );
  // substantive-but-wrong drafts are NOT degenerate
  assert.equal(isDegenerateChapterResearchOutput(metaReferenceOutput()), false);
  assert.equal(isDegenerateChapterResearchOutput(validChapter()), false);
});

requiredTest("17 a bounded repair that still trips the meta guard fails closed with the ORIGINAL error and buys no extra attempt", async () => {
  // R-283 fail-closed. Every call — draft and repair alike — returns the same
  // offending draft, so the repair never lands. The chapter must die on the
  // draft's OWN validator error (not on a repair-specific euphemism), and the
  // repair must not buy a fourth attempt: MAX_CHAPTER_RESEARCH_ATTEMPTS is still
  // the outer bound on the chapter.
  const subject = rig([metaReferenceOutput()]);
  await assert.rejects(
    runResearcherChapter(input(), subject.execution),
    (error: unknown) => {
      const message = (error as Error).message;
      assert.match(message, /3 attempt/i);
      assert.match(message, /meta-reference "The author" found in `coreClaim`/);
      return true;
    },
  );
  assert.equal(subject.calls(), MAX_CHAPTER_RESEARCH_ATTEMPTS * (1 + MAX_META_REPAIRS_PER_ATTEMPT));
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
