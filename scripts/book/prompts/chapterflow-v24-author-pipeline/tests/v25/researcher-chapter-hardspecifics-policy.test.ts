import assert from "node:assert/strict";

import type { BibliographyResult } from "../../src/agents/researcher-bibliography.js";
import {
  collectHardSpecificLengthProblems,
  MAX_HARD_SPECIFIC_WORDS,
  runResearcherChapter,
  type ChapterResearchInput,
  type ChapterResearchResult,
} from "../../src/agents/researcher-chapter.js";
import { chapterRouteValid } from "../../src/app/researchCandidateApplicationPort.js";
import type { ModelTaskContext } from "../../src/contracts/v4Core.js";
import { createUniquenessEnforcingRunner, mintingExecution } from "./fakes/uniquenessRunner.js";
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

/** A known-good source-v2 chapter whose every hardSpecific is a SHORT verbatim
 *  token (<=5 words): it passes the length/meta validator, the source-v2 gate,
 *  AND the new short-token policy. Mirrors the clean fixture in
 *  researcher-chapter-retry.test.ts. */
function validChapter(): ChapterResearchResult {
  const prefix = "ch01";
  const examples = [
    {
      label: "Magic Castle Hotel Popsicle Hotline",
      summary: "Magic Castle Hotel guests lift a red telephone beside the pool and receive a poolside popsicle service on a silver tray.",
      specifics: ["Magic Castle Hotel", "red telephone beside pool"],
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

/** The FINDING-18 defect shape: a research result identical to the valid one
 *  EXCEPT one namedExample carries a CLAUSE-LENGTH hardSpecific (9 words) — the
 *  exact class ("neglected plot of ground, with no idle middle option") that
 *  cannot compose into a word-budgeted memorable line downstream. Everything
 *  else (floors, meta guard) still passes, isolating the length policy. */
function clauseSpecificChapter(): ChapterResearchResult {
  const base = validChapter();
  const examples = base.namedExamples.map((ex, i) => (
    i === 0
      ? { ...ex, hardSpecifics: ["neglected plot of ground with no idle middle option", "Magic Castle Hotel"] }
      : ex
  ));
  return { ...base, namedExamples: examples };
}

function input(): ChapterResearchInput {
  return {
    bibliography: bibliography(),
    chapter: { number: 1, title: "Defining Moments" },
    priorChapterTitles: [],
  };
}

function rig(outputs: readonly unknown[]) {
  const base: ModelTaskContext = {
    bookId: "the-power-of-moments",
    runId: "run-fixture",
    attemptId: "attempt-fixture",
    stageId: "research",
    operationId: "research-ch01",
    workDir: "/tmp/cf-v25-hardspecifics-policy",
    signal: new AbortController().signal,
  };
  const { runner, prompts, calls } = createUniquenessEnforcingRunner(outputs);
  const execution = mintingExecution(runner, base);
  return { execution, prompts, calls };
}

requiredTest("1 collectHardSpecificLengthProblems flags a >5-word clause specific with the precise problem line", () => {
  const problems = collectHardSpecificLengthProblems(clauseSpecificChapter().namedExamples);
  assert.equal(problems.length, 1);
  const line = problems[0];
  assert.match(line, /hardSpecific too long/);
  assert.match(line, /give a short verbatim token \(a name, number, phrase of <=5 words\)/);
  // it names the offending example and quotes the offending clause
  assert.match(line, /Magic Castle Hotel Popsicle Hotline/);
  assert.match(line, /neglected plot of ground with no idle middle option/);
});

requiredTest("2 short-token specifics pass (no problems on the all-short valid chapter)", () => {
  assert.deepEqual(collectHardSpecificLengthProblems(validChapter().namedExamples), []);
});

requiredTest("3 boundary: exactly 5 words passes, 6 words fails", () => {
  assert.equal(MAX_HARD_SPECIFIC_WORDS, 5);
  const at = validChapter();
  at.namedExamples[0].hardSpecifics = ["one two three four five", "John Deere"];
  assert.deepEqual(collectHardSpecificLengthProblems(at.namedExamples), []);

  const over = validChapter();
  over.namedExamples[0].hardSpecifics = ["one two three four five six", "John Deere"];
  const problems = collectHardSpecificLengthProblems(over.namedExamples);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /\(6 words\)/);
});

requiredTest("4 empty and duplicate specifics keep existing behavior (never length-flagged)", () => {
  const withEmpty = validChapter();
  // empty / whitespace-only specifics are left to the >=2-per-case floor, not the length cap
  withEmpty.namedExamples[0].hardSpecifics = ["", "   ", "Magic Castle Hotel"];
  assert.deepEqual(collectHardSpecificLengthProblems(withEmpty.namedExamples), []);

  const withDupes = validChapter();
  withDupes.namedExamples[0].hardSpecifics = ["John Deere", "John Deere"];
  assert.deepEqual(collectHardSpecificLengthProblems(withDupes.namedExamples), []);
});

requiredTest("5 runResearcherChapter REJECTS a clause-specific chapter and retries with the length problem fed back, then succeeds", async () => {
  const subject = rig([clauseSpecificChapter(), validChapter()]);
  const result = await runResearcherChapter(input(), subject.execution);

  assert.equal(result.schemaVersion, "source-v2");
  // the clause-specific output MUST drive a retry (not be admitted on attempt 1)
  assert.equal(subject.calls(), 2);
  const retryPrompt = subject.prompts[1];
  assert.match(retryPrompt, /PREVIOUS ATTEMPT WAS REJECTED/);
  assert.match(retryPrompt, /hardSpecific too long/);
  assert.match(retryPrompt, /short verbatim token/);
});

requiredTest("6 reuse migration: chapterRouteValid rejects a stale clause-specific sidecar and accepts an all-short one", () => {
  // 11d hook: a durable sidecar with a clause-length specific must fail reuse so
  // the chapter falls through to re-research (the designed migration path).
  assert.equal(chapterRouteValid(clauseSpecificChapter()), false);
  assert.equal(chapterRouteValid(validChapter()), true);
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
