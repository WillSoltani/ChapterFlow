import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { BibliographyResult } from "../../src/agents/researcher-bibliography.js";
import type { ChapterResearchResult } from "../../src/agents/researcher-chapter.js";
import {
  ResearchCandidateApplicationPort,
  type ResearchCandidateApplicationRequest,
} from "../../src/app/researchCandidateApplicationPort.js";
import type { ModelTaskRunner } from "../../src/app/modelTaskRunner.js";
import type { CandidateManifest, CandidateSnapshot, CandidateStore } from "../../src/books/candidateTypes.js";
import { createFileRunStore } from "../../src/run-state/fileRunStore.js";
import { createFileStageCoordinator } from "../../src/run-state/stageCoordinator.js";
import { evaluateSourceV2Integrity } from "../../src/source/sourceIntegrity.js";
import { finishV25Tests, requiredTest, type TestContext } from "./harness.js";

const BOOK = "the-power-of-moments";
const TITLE = "The Power of Moments";
const AUTHOR = "Chip Heath & Dan Heath";

function bibliography(): BibliographyResult {
  return {
    bookId: BOOK,
    title: TITLE,
    author: "Chip Heath and Dan Heath",
    edition: { name: "fixture", chapterCount: 2, language: "English" },
    flatChapters: [
      { number: 1, title: "Defining Moments" },
      { number: 2, title: "Thinking in Moments" },
    ],
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

function chapter(number: number, title: string): ChapterResearchResult {
  const prefix = `ch${String(number).padStart(2, "0")}`;
  const examples = number === 1
    ? [
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
      ]
    : [
        {
          label: "KIPP College Signing Day",
          summary: "KIPP students announce a chosen college during College Signing Day while families and peers witness the transition.",
          specifics: ["KIPP", "College Signing Day"],
        },
        {
          label: "Sara Blakely Failure Stories",
          summary: "Sara Blakely describes a family dinner ritual that treated a reported failure as evidence of trying something difficult.",
          specifics: ["Sara Blakely", "family dinner ritual"],
        },
        {
          label: "University of Virginia Peak-End Exercise",
          summary: "University of Virginia students compare one deliberately elevated class event with an ordinary weekly routine in a peak-end exercise.",
          specifics: ["University of Virginia", "peak-end exercise"],
        },
      ];
  const facts = number === 1
    ? [
        ["Magic Castle Hotel uses one red poolside telephone to make service visible.", "Because the red telephone creates sensory contrast, guests can retrieve the service encounter later."],
        ["John Deere prepares a workstation before a new employee arrives on day one.", "Because visible preparation signals belonging, the first arrival carries meaning beyond routine setup."],
        ["Sharp HealthCare convenes one all-staff assembly across clinical and support roles.", "Because shared attendance synchronizes attention, separate roles receive the same transition signal."],
        ["A bounded peak occupies less time than the routine surrounding it.", "Because memory weights distinctive transitions, duration alone does not determine later recall."],
        ["Poolside popsicle service pairs a concrete object with a named delivery ritual.", "Because object and ritual arrive together, the service becomes easier to describe accurately."],
        ["A welcome message names the manager responsible for a new employee's arrival.", "Because named ownership reduces ambiguity, the employee knows who prepared the transition."],
        ["One prepared first day can establish a reference point for later workplace judgments.", "Because early evidence anchors expectations, later routine is interpreted against that reference point."],
        ["An all-staff gathering makes an institutional commitment observable in one room.", "Because simultaneous observation creates common knowledge, staff can coordinate around the commitment."],
        ["Three distinct cases use different settings while preserving a bounded transition.", "Because setting varies while boundary remains, the mechanism transfers without copying surface details."],
      ]
    : [
        ["KIPP students name one selected college during College Signing Day.", "Because public naming marks a completed choice, students and families share the same transition point."],
        ["Sara Blakely's family dinner ritual asks for one attempted failure.", "Because effort receives recognition, a setback can signal exploration instead of permanent inability."],
        ["University of Virginia students compare an elevated event with weekly routine.", "Because direct comparison exposes contrast, students can identify which design move changed attention."],
        ["College Signing Day places families and peers around one student announcement.", "Because witnesses share the announcement, private progress becomes socially recognized achievement."],
        ["A reported failure remains useful only when it names an actual attempted action.", "Because a concrete attempt supplies feedback, vague celebration of failure cannot guide a next move."],
        ["A peak-end exercise separates event intensity from total event duration.", "Because recall overweights salient boundaries, a short event may shape the summary judgment."],
        ["One chosen college supplies a specific destination rather than a generic aspiration.", "Because a named destination constrains the next steps, the commitment becomes easier to act on."],
        ["A family ritual can reframe a setback without denying its practical cost.", "Because interpretation changes while facts remain intact, learning does not require false optimism."],
        ["Three witnessed transitions create different forms of insight, pride, and connection.", "Because each transition makes meaning observable, readers can compare mechanisms across settings."],
      ];
  const noteRoots = number === 1
    ? ["elevation", "arrival", "surprise", "threshold", "celebration", "peak"]
    : ["insight", "reflection", "realization", "mentor", "reframe", "clarity"];
  const longNotes = Array.from({ length: 95 }, (_, index) => (
    `${noteRoots[index % noteRoots.length]}-${index + 1} ${noteRoots[(index + 1) % noteRoots.length]}-mechanism ${noteRoots[(index + 2) % noteRoots.length]}-choice ${noteRoots[(index + 3) % noteRoots.length]}-memory.`
  )).join(" ").slice(0, 2200);
  return {
    schemaVersion: "source-v2",
    chapterNumber: number,
    chapterTitle: title,
    focus: `Deliberate contrast turns an ordinary transition into a memorable event with enough specificity to guide a later choice.`,
    coreClaim: `Meaningful moments become memorable when a concrete break in routine changes attention and interpretation.`,
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
    frameworks: [{ name: `Moment frame ${number}`, members: ["contrast", "meaning", "retrieval"] }],
  };
}

function fabricatedChapter(number: number, title: string): ChapterResearchResult {
  const value = chapter(number, title);
  return {
    ...value,
    namedExamples: value.namedExamples.map((example, index) => ({
      ...example,
      label: `Generic case ${index + 1}`,
      summary: "A generic team changes one generic transition and records one generic outcome.",
      hardSpecifics: ["generic site", "generic transition"],
      realWorld: false,
    })),
    testableFacts: value.testableFacts?.map((fact, index) => ({
      ...fact,
      claim: `A visible cue ${index + 1} marks a transition before a decision.`,
      becauseMechanism: "Because contrast increases attention, the event becomes easier to retrieve later.",
      commonError: `A visible cue ${index + 1} marks a transition before a decision.`,
    })),
  };
}

function advisoryCanaryChapter(number: number, title: string): ChapterResearchResult {
  const value = chapter(number, title);
  // Short verbatim tokens (<=5 words each, per the hardSpecifics short-token
  // policy) that are deliberately NOT echoed in example[0]'s summary or notes, so
  // the advisory SV2.realness_unsupported_entity signal still fires while the
  // route-blocking length cap stays satisfied.
  const hardSpecifics = number === 1
    ? ["poolside call button", "silver serving tray"]
    : ["senior signing banner", "college destination pledge"];
  return {
    ...value,
    namedExamples: value.namedExamples.map((example, index) => (
      index === 0 ? { ...example, hardSpecifics } : example
    )),
    testableFacts: value.testableFacts?.map((fact, index) => (
      index === 0
        ? { ...fact, becauseMechanism: "Distinctive sensory contrast strengthens retrieval of the encounter later." }
        : fact
    )),
  };
}

function fakeCandidateStore() {
  let snapshot: CandidateSnapshot | null = null;
  let stageCalls = 0;
  const store: CandidateStore = {
    async stage(input) {
      stageCalls += 1;
      const digest = createHash("sha256")
        .update(input.files.map((file) => `${file.logicalPath}:${Buffer.from(file.bytes).toString("base64")}`).join("\0"))
        .digest("hex");
      const manifest: CandidateManifest = {
        schemaVersion: "1",
        bookId: input.bookId,
        candidateId: input.candidateId,
        createdByRunId: input.createdByRunId,
        entries: input.files.map(({ bytes, ...file }) => ({ ...file, byteLength: bytes.byteLength })),
        manifestDigest: digest,
        createdAt: input.createdAt,
      };
      snapshot = {
        manifest,
        files: input.files.map((file) => ({ ...file, byteLength: file.bytes.byteLength })),
      };
      return { ok: true, value: manifest };
    },
    async open(input) {
      if (snapshot?.manifest.bookId === input.bookId && input.selector.kind === "CANDIDATE" && snapshot.manifest.candidateId === input.selector.candidateId) {
        return { ok: true, value: snapshot };
      }
      return { ok: false, error: { code: "NOT_FOUND", message: "candidate not found" } };
    },
  };
  return { store, snapshot: () => snapshot, stageCalls: () => stageCalls };
}

function rig(context: TestContext, quality: "clean" | "malformed" | "fabricated" | "advisory-canary" = "clean") {
  const runStore = createFileRunStore(resolve(context.roots.stateRoot, "v25-runs"));
  const stageCoordinator = createFileStageCoordinator(resolve(context.roots.stateRoot, "v25-runs"));
  const candidates = fakeCandidateStore();
  const operations: string[] = [];
  const admittedAttemptIds: string[] = [];
  const modelRoutes: Array<{ profileId: string; workDir: string }> = [];
  // Mutable crash injection: when set, the next model call for this operationId
  // ADMITS its run-state attempt but returns an uncertain (unsettled) result
  // WITHOUT finishing it — reproducing a SIGKILL/teardown mid-attempt, where the
  // journal has an ATTEMPT_ADMITTED with no terminal record. Cleared after it
  // fires so a subsequent resume runs the operation to completion.
  // `failChapters`: chapters whose model call returns a persistently source-v2-
  // INVALID output (empty testableFacts). runResearcherChapter exhausts its
  // retries and the chapter fails with every attempt SETTLED, so the control run
  // goes TERMINAL FAILED (finding 7's shape) rather than stuck RUNNING. Cleared
  // by the test before a recovery resume so the chapter researches cleanly.
  const control: { crashOperation: string | null; failChapters: Set<number> } = { crashOperation: null, failChapters: new Set() };
  const runner: ModelTaskRunner = {
    async run(request) {
      operations.push(request.context.operationId);
      admittedAttemptIds.push(request.context.attemptId);
      modelRoutes.push({ profileId: request.profileId, workDir: request.context.workDir });
      const admittedAt = context.clock.now();
      const admitted = await runStore.admitAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        stageId: request.context.stageId,
        operationId: request.context.operationId,
        admittedAt,
        staleAt: new Date(Date.parse(admittedAt) + 60_000).toISOString(),
      });
      assert.equal(admitted.ok, true);
      if (control.crashOperation === request.context.operationId) {
        control.crashOperation = null;
        // Admitted, never finished: the attempt stays ACTIVE/STALE forever.
        return { attemptId: request.context.attemptId, outcome: "UNKNOWN", error: { code: "MODEL_EXECUTION_UNCERTAIN", message: "simulated hard kill" } };
      }
      const chapterMatch = request.context.operationId.match(/research-ch(\d+)$/);
      const chapterNumber = Number(chapterMatch?.[1] ?? 1);
      const chapterTitle = chapterNumber === 1 ? "Defining Moments" : "Thinking in Moments";
      const output = request.context.operationId === "research-bibliography"
        ? bibliography()
        : control.failChapters.has(chapterNumber)
          ? { ...chapter(chapterNumber, chapterTitle), testableFacts: [] }
          : quality === "malformed"
            ? { ...chapter(chapterNumber, chapterTitle), testableFacts: [] }
            : quality === "fabricated"
              ? fabricatedChapter(chapterNumber, chapterTitle)
              : quality === "advisory-canary"
                ? advisoryCanaryChapter(chapterNumber, chapterTitle)
                : chapter(chapterNumber, chapterTitle);
      const finished = await runStore.finishAttempt({
        bookId: request.context.bookId,
        runId: request.context.runId,
        attemptId: request.context.attemptId,
        outcome: "SUCCEEDED",
        finishedAt: context.clock.now(),
      });
      assert.equal(finished.ok, true);
      return { attemptId: request.context.attemptId, outcome: "SUCCEEDED", output };
    },
  };
  const port = new ResearchCandidateApplicationPort({
    pipelineRoot: resolve(context.roots.base, "pipeline-root"),
    runStore,
    stageCoordinator,
    candidateStore: candidates.store,
    runner,
    ids: {
      nextRunId: () => context.ids.next("research-run"),
      candidateId: () => context.ids.next("candidate"),
      modelAttemptId: () => context.ids.next("research-attempt"),
      reviewAttemptId: () => context.ids.next("review-attempt"),
      reviewId: () => context.ids.next("review"),
      qcRoundId: () => context.ids.next("qc-round"),
    },
    clock: context.clock,
  });
  const request: ResearchCandidateApplicationRequest = {
    bookId: BOOK,
    title: TITLE,
    author: AUTHOR,
    sourceGitSha: "a20d1cdab0fc33c4c1f840f4cf99089816e022d4",
    v25Root: resolve(context.roots.tempRoot, "v25"),
    attemptRoot: resolve(context.roots.attemptsRoot, "research"),
    chapterConcurrency: 2,
    signal: new AbortController().signal,
  };
  return { port, request, runStore, candidates, operations, modelRoutes, control, admittedAttemptIds };
}

requiredTest("1 intake admits real research attempts and stages exact 7 plus 2N seed inventory", async (context) => {
  const subject = rig(context);
  const result = await subject.port.run(subject.request);
  assert.equal(result.schemaVersion, "1");
  assert.equal(result.bookId, BOOK);
  assert.equal(result.resumed, false);
  assert.deepEqual([...subject.operations].sort(), ["research-bibliography", "research-ch01", "research-ch02"]);
  assert.deepEqual(subject.modelRoutes, Array.from({ length: 3 }, () => ({
    profileId: "attempt-read-json-v1",
    workDir: subject.request.attemptRoot,
  })));
  const snapshot = subject.candidates.snapshot();
  assert.ok(snapshot);
  assert.equal(snapshot.files.length, 11);
  assert.deepEqual(snapshot.files.map((file) => file.logicalPath), [
    "inputs/chapter-index.json",
    "inputs/source-freeze/toc.json",
    "inputs/source-freeze/book-source.md",
    "inputs/compiler-section-task-context.json",
    "inputs/research/research-run.manifest.json",
    "inputs/research/bibliography.raw.json",
    "inputs/research/source-freeze-report.md",
    "inputs/source/ch01.source.json",
    "inputs/source/ch01.source.txt",
    "inputs/source/ch02.source.json",
    "inputs/source/ch02.source.txt",
  ]);
  assert.deepEqual(result.sources, [
    {
      chapterNumber: 1,
      sidecarLogicalPath: "inputs/source/ch01.source.json",
      sourceLogicalPaths: ["inputs/source/ch01.source.txt", "inputs/source-freeze/book-source.md", "inputs/source-freeze/toc.json"],
    },
    {
      chapterNumber: 2,
      sidecarLogicalPath: "inputs/source/ch02.source.json",
      sourceLogicalPaths: ["inputs/source/ch02.source.txt", "inputs/source-freeze/book-source.md", "inputs/source-freeze/toc.json"],
    },
  ]);
  for (const file of snapshot.files.filter((item) => /inputs\/source\/ch\d+\.source\.json$/.test(item.logicalPath))) {
    const source = JSON.parse(Buffer.from(file.bytes).toString("utf8"));
    const decision = evaluateSourceV2Integrity(source, { chapterNumber: source.chapterNumber, chapterTitle: source.chapterTitle });
    assert.equal(decision.findings.some((finding) => finding.checkId === "SV2.realness_fabricated_sidecar"), false);
  }
  const run = await subject.runStore.readRun(BOOK, result.intakeRunId, context.clock.now());
  assert.equal(run.ok, true);
  if (!run.ok) return;
  assert.equal(run.value.status, "COMPLETED");
  assert.equal(run.value.attempts.length, 3);
  assert.equal(new Set(run.value.attempts.map((attempt) => attempt.admission.attemptId)).size, 3);
  assert.ok(run.value.attempts.every((attempt) => attempt.admission.stageId === "research" && attempt.status === "SUCCEEDED"));
});

requiredTest("2 exact completed resume reuses research while fresh runs work and changed-intent resume fails closed", async (context) => {
  const subject = rig(context);
  const first = await subject.port.run(subject.request);
  const calls = subject.operations.length;
  const stageCalls = subject.candidates.stageCalls();
  const second = await subject.port.run({ ...subject.request, resumeRunId: first.intakeRunId });
  assert.equal(second.resumed, true);
  assert.deepEqual(second.candidate, first.candidate);
  assert.equal(subject.operations.length, calls);
  assert.equal(subject.candidates.stageCalls(), stageCalls);

  const fresh = await subject.port.run(subject.request);
  assert.equal(fresh.resumed, false);
  assert.notEqual(fresh.intakeRunId, first.intakeRunId);
  assert.notEqual(fresh.researchRunId, first.researchRunId);
  assert.equal(subject.operations.length, calls + 3);
  assert.equal(subject.candidates.stageCalls(), stageCalls + 1);

  await assert.rejects(
    subject.port.run({
      ...subject.request,
      resumeRunId: first.intakeRunId,
      sourceGitSha: "b20d1cdab0fc33c4c1f840f4cf99089816e022d4",
    }),
    /RESEARCH_RESUME_CONFLICT:resume run definition differs from requested intent/,
  );
  assert.equal(subject.operations.length, calls + 3);
  assert.equal(subject.candidates.stageCalls(), stageCalls + 1);

  const originalRun = await subject.runStore.readRun(BOOK, first.intakeRunId, context.clock.now());
  assert.equal(originalRun.ok, true);
  if (originalRun.ok) assert.equal(originalRun.value.attempts.length, calls);
});

requiredTest("3 malformed or aggregate-fabricated source-v2 output fails closed before immutable seed", async (context) => {
  const subject = rig(context, "malformed");
  await assert.rejects(subject.port.run({ ...subject.request, chapterConcurrency: 1 }), /SV2\.testable_facts_floor|source-v2/i);
  assert.equal(subject.candidates.stageCalls(), 0);
  assert.equal(subject.candidates.snapshot(), null);

  const fabricated = rig(context, "fabricated");
  await assert.rejects(
    fabricated.port.run({ ...fabricated.request, chapterConcurrency: 1 }),
    /SV2\.realness_fabricated_sidecar/,
  );
  assert.equal(fabricated.candidates.stageCalls(), 0);
});

requiredTest("4 advisory-only live-canary shape remains admissible and stages immutable seed", async (context) => {
  const subject = rig(context, "advisory-canary");
  await subject.port.run({ ...subject.request, chapterConcurrency: 1 });
  assert.equal(subject.candidates.stageCalls(), 1);

  const snapshot = subject.candidates.snapshot();
  assert.ok(snapshot);
  assert.equal(snapshot.files.length, 11);
  for (const file of snapshot.files.filter((item) => /inputs\/source\/ch\d+\.source\.json$/.test(item.logicalPath))) {
    const source = JSON.parse(Buffer.from(file.bytes).toString("utf8"));
    const decision = evaluateSourceV2Integrity(source, { chapterNumber: source.chapterNumber, chapterTitle: source.chapterTitle });
    const checkIds = new Set(decision.findings.map((finding) => finding.checkId));
    assert.equal(checkIds.has("SV2.realness_non_testable_fact"), true);
    assert.equal(checkIds.has("SV2.realness_unsupported_entity"), true);
    assert.equal(checkIds.has("SV2.realness_placeholder_example"), false);
    assert.equal(checkIds.has("SV2.realness_repeated_boilerplate"), false);
    assert.equal(checkIds.has("SV2.realness_fabricated_sidecar"), false);
  }
});

requiredTest("5 bibliography author normalization accepts ampersand but rejects different author words before seed", async (context) => {
  const subject = rig(context);
  await assert.rejects(
    subject.port.run({ ...subject.request, author: "Chip Heath & Malcolm Gladwell" }),
    /RESEARCH_IDENTITY_MISMATCH:bibliography title or author differs from request/,
  );
  assert.equal(subject.candidates.stageCalls(), 0);
  assert.equal(subject.candidates.snapshot(), null);
});

requiredTest("6 cancelled input and missing explicit resume fail before run candidate or attempt write", async (context) => {
  const subject = rig(context);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(subject.port.run({ ...subject.request, signal: controller.signal }), /cancelled before run creation/);
  await assert.rejects(subject.port.run({ ...subject.request, resumeRunId: "typo-missing-run" }), /RESEARCH_RESUME_NOT_FOUND/);
  assert.equal(subject.operations.length, 0);
  assert.equal(subject.candidates.stageCalls(), 0);
});

requiredTest("7 explicit new run identity creates fresh intake and cannot masquerade as resume", async (context) => {
  const subject = rig(context);
  const newRunId = "book-run-shared-id";
  const result = await subject.port.run({ ...subject.request, newRunId });
  assert.equal(result.intakeRunId, newRunId);
  assert.equal(result.resumed, false);
  assert.equal(subject.candidates.snapshot()?.manifest.createdByRunId, newRunId);
  const stored = await subject.runStore.readRun(BOOK, newRunId, context.clock.now());
  assert.equal(stored.ok, true);
  if (stored.ok) assert.equal(stored.value.status, "COMPLETED");

  await assert.rejects(
    subject.port.run({ ...subject.request, newRunId: "fresh", resumeRunId: newRunId }),
    /RESEARCH_INPUT_INVALID:newRunId and resumeRunId are mutually exclusive/,
  );
  assert.equal(subject.operations.length, 3);
  assert.equal(subject.candidates.stageCalls(), 1);
});

/** Read the durable attempt journal for a run and return one record per line. */
function readAttemptJournal(context: TestContext, runId: string): Array<Record<string, unknown>> {
  const path = resolve(context.roots.stateRoot, "v25-runs", "books", BOOK, "runs", runId, "attempts.jsonl");
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

/** Drive a run to the exact crash state observed in the 2026-07-23 canary: an
 *  attempt admitted with no terminal record while the run stays RUNNING. */
async function crashDuringChapter(context: TestContext, runId: string) {
  const subject = rig(context);
  subject.control.crashOperation = "research-ch01";
  await assert.rejects(
    subject.port.run({ ...subject.request, newRunId: runId, chapterConcurrency: 1 }),
    /MODEL_EXECUTION_UNCERTAIN|MODEL_TASK_UNKNOWN|chapter research/,
  );
  const crashed = await subject.runStore.readRun(BOOK, runId, context.clock.now());
  assert.equal(crashed.ok, true);
  if (!crashed.ok) throw new Error("crashed run unreadable");
  assert.equal(crashed.value.status, "RUNNING");
  const unsettled = crashed.value.attempts.filter((attempt) => attempt.status === "ACTIVE" || attempt.status === "STALE");
  assert.ok(unsettled.length >= 1, "crash must leave an admitted-but-unsettled attempt");
  return subject;
}

requiredTest("8 crash-resume WITHOUT reconcile flag preserves the fail-closed RESEARCH_ATTEMPT_UNCERTAIN error verbatim", async (context) => {
  const runId = "book-run-crash-noflag";
  const subject = await crashDuringChapter(context, runId);
  await assert.rejects(
    subject.port.run({ ...subject.request, resumeRunId: runId, chapterConcurrency: 1 }),
    /RESEARCH_ATTEMPT_UNCERTAIN:unsettled model attempt blocks replay/,
  );
  // the run is still RUNNING and still unsettled — nothing was reconciled
  const after = await subject.runStore.readRun(BOOK, runId, context.clock.now());
  assert.equal(after.ok, true);
  if (after.ok) {
    assert.equal(after.value.status, "RUNNING");
    assert.ok(after.value.attempts.some((attempt) => attempt.status === "ACTIVE" || attempt.status === "STALE"));
  }
});

requiredTest("9 crash-resume WITH reconcile flag settles the unsettled attempt, re-runs with a fresh attempt id, and completes", async (context) => {
  const runId = "book-run-crash-reconcile";
  const subject = await crashDuringChapter(context, runId);
  const attemptsBefore = subject.admittedAttemptIds.length;

  const resumed = await subject.port.run({ ...subject.request, resumeRunId: runId, chapterConcurrency: 1, reconcileUnsettled: true });
  assert.equal(resumed.resumed, true);
  assert.equal(resumed.bookId, BOOK);

  // the run finished COMPLETED and every attempt is now settled
  const after = await subject.runStore.readRun(BOOK, runId, context.clock.now());
  assert.equal(after.ok, true);
  if (!after.ok) return;
  assert.equal(after.value.status, "COMPLETED");
  assert.equal(after.value.attempts.every((attempt) => attempt.status !== "ACTIVE" && attempt.status !== "STALE"), true);

  // the unsettled attempt was settled ABANDONED with the reconcile marker
  const abandoned = after.value.attempts.filter((attempt) => attempt.status === "ABANDONED");
  assert.equal(abandoned.length, 1);
  const journal = readAttemptJournal(context, runId);
  const reconciled = journal.filter(
    (record) => record.type === "ATTEMPT_FINISHED" && record.outcome === "ABANDONED" && record.detail === "RECONCILED_UNSETTLED_ON_RESUME",
  );
  assert.equal(reconciled.length, 1);
  assert.equal(reconciled[0].attemptId, abandoned[0].admission.attemptId);

  // the resumed generation re-ran research with FRESH, salted, non-colliding
  // attempt ids (never re-admitting the crashed run's ids)
  const resumeAdmitted = subject.admittedAttemptIds.slice(attemptsBefore);
  assert.ok(resumeAdmitted.length >= 1, "resume must re-run at least the crashed chapter");
  assert.ok(resumeAdmitted.every((id) => /-r\d+-/.test(id)), "resumed attempt ids must carry the resume salt");
  assert.equal(new Set(subject.admittedAttemptIds).size, subject.admittedAttemptIds.length, "no attempt id was ever reused");
});

/** Drive a book-run to finding 7's exact terminal state: one chapter exhausts
 *  its retries (every attempt settled), so the control run goes TERMINAL FAILED
 *  while the OTHER chapter's durable sidecars survive on disk under the shared
 *  legacy research run. */
async function failDuringChapter(context: TestContext, runId: string) {
  const subject = rig(context);
  subject.control.failChapters = new Set([2]); // ch02 persistently source-v2-invalid
  await assert.rejects(
    subject.port.run({ ...subject.request, newRunId: runId, chapterConcurrency: 1 }),
    /chapter research invalid|SV2|source-v2/i,
  );
  const failed = await subject.runStore.readRun(BOOK, runId, context.clock.now());
  assert.equal(failed.ok, true);
  if (!failed.ok) throw new Error("failed run unreadable");
  assert.equal(failed.value.status, "FAILED");
  // ch01's durable sidecar survived; ch02 never wrote one
  const dir = legacyResearchRunDir(subject);
  assert.ok(readFileSync(resolve(dir, "sidecars", "source", "ch01.source.json"), "utf8"));
  return subject;
}

/** Locate the single shared legacy research-run directory produced under the
 *  v25 root (research-runs/<bookId>/<runId>). */
function legacyResearchRunDir(subject: ReturnType<typeof rig>): string {
  const bookRunsRoot = resolve(subject.request.v25Root, "research-runs", BOOK);
  const runIds = readdirSync(bookRunsRoot);
  assert.equal(runIds.length, 1, "exactly one legacy research run should exist");
  return resolve(bookRunsRoot, runIds[0]);
}

requiredTest("10 resume of a TERMINAL-FAILED research run WITHOUT the reconcile flag fails closed with RESEARCH_RUN_TERMINAL verbatim", async (context) => {
  const runId = "book-run-terminal-noflag";
  const subject = await failDuringChapter(context, runId);
  await assert.rejects(
    subject.port.run({ ...subject.request, resumeRunId: runId, chapterConcurrency: 1 }),
    /RESEARCH_RUN_TERMINAL:FAILED/,
  );
  const after = await subject.runStore.readRun(BOOK, runId, context.clock.now());
  assert.equal(after.ok, true);
  if (after.ok) assert.equal(after.value.status, "FAILED");
});

requiredTest("11 resume of a TERMINAL-FAILED research run WITH the reconcile flag opens a successor that reuses the durable K sidecars and re-researches only the missing N-K", async (context) => {
  const runId = "book-run-terminal-recover";
  const subject = await failDuringChapter(context, runId);
  subject.control.failChapters = new Set(); // the transient condition clears
  const opsBefore = subject.operations.length;

  const recovered = await subject.port.run({ ...subject.request, resumeRunId: runId, chapterConcurrency: 1, reconcileUnsettled: true });
  assert.equal(recovered.resumed, true);
  assert.equal(recovered.bookId, BOOK);
  // a SUCCESSOR control run — a fresh intake id, never the failed predecessor
  assert.notEqual(recovered.intakeRunId, runId);

  // reuse: model-call count == N-K. ch01 reused durable (no model call), ch02 re-run.
  const resumeOps = subject.operations.slice(opsBefore).sort();
  assert.deepEqual(resumeOps, ["research-ch02"]);
  assert.equal(resumeOps.includes("research-bibliography"), false);
  assert.equal(resumeOps.includes("research-ch01"), false);

  // the successor completed and staged the full 7 + 2N seed
  const successor = await subject.runStore.readRun(BOOK, recovered.intakeRunId, context.clock.now());
  assert.equal(successor.ok, true);
  if (successor.ok) assert.equal(successor.value.status, "COMPLETED");
  const snapshot = subject.candidates.snapshot();
  assert.ok(snapshot);
  assert.equal(snapshot.files.length, 11);

  // provenance is durable in the seed's research-run manifest
  const manifestFile = snapshot.files.find((file) => file.logicalPath === "inputs/research/research-run.manifest.json");
  assert.ok(manifestFile);
  const manifest = JSON.parse(Buffer.from(manifestFile.bytes).toString("utf8")) as {
    events: Array<{ type: string; data?: Record<string, unknown> }>;
  };
  const provenance = manifest.events.find((event) => event.type === "run.successor_recovery");
  assert.ok(provenance, "successor provenance must be recorded in the research-run manifest");
  assert.equal(provenance.data?.predecessorControlRunId, runId);
  assert.equal(provenance.data?.successorControlRunId, recovered.intakeRunId);
  assert.deepEqual(provenance.data?.reusedChapters, [1]);
  assert.deepEqual(provenance.data?.reResearchedChapters, [2]);

  // the predecessor stays TERMINAL FAILED — never rewritten
  const predecessor = await subject.runStore.readRun(BOOK, runId, context.clock.now());
  assert.equal(predecessor.ok, true);
  if (predecessor.ok) assert.equal(predecessor.value.status, "FAILED");
});

requiredTest("12 a durable sidecar that still parses and hash-matches but no longer passes source-v2 is re-researched on recovery, never reused blindly", async (context) => {
  const runId = "book-run-terminal-corrupt-reuse";
  const subject = await failDuringChapter(context, runId);
  subject.control.failChapters = new Set();

  // Corrupt ch01's durable sidecar in place: still parses and (after patching the
  // manifest output hashes) hash-matches its entry, but FAILS the source-v2 route
  // validator. The reuse gate — not the hash check — must force its re-research.
  const dir = legacyResearchRunDir(subject);
  const jsonPath = resolve(dir, "sidecars", "source", "ch01.source.json");
  const txtPath = resolve(dir, "sidecars", "source", "ch01.source.txt");
  const corrupt = JSON.parse(readFileSync(jsonPath, "utf8"));
  corrupt.testableFacts = []; // trips SV2 route-blocking (testable_facts_floor)
  const corruptJson = `${JSON.stringify(corrupt, null, 2)}\n`;
  writeFileSync(jsonPath, corruptJson);
  const corruptTxt = `${readFileSync(txtPath, "utf8")}\ncorrupted-marker`;
  writeFileSync(txtPath, corruptTxt);
  const manifestPath = resolve(dir, "research-run.manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    chapters: Record<string, { outputJsonHash?: string; outputTextHash?: string }>;
  };
  manifest.chapters["01"].outputJsonHash = createHash("sha256").update(corruptJson).digest("hex");
  manifest.chapters["01"].outputTextHash = createHash("sha256").update(corruptTxt).digest("hex");
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const opsBefore = subject.operations.length;
  const recovered = await subject.port.run({ ...subject.request, resumeRunId: runId, chapterConcurrency: 1, reconcileUnsettled: true });
  assert.equal(recovered.resumed, true);

  // BOTH chapters re-researched: ch01 rejected on reuse validation, ch02 missing
  const resumeOps = subject.operations.slice(opsBefore).sort();
  assert.deepEqual(resumeOps, ["research-ch01", "research-ch02"]);
  const successor = await subject.runStore.readRun(BOOK, recovered.intakeRunId, context.clock.now());
  assert.equal(successor.ok, true);
  if (successor.ok) assert.equal(successor.value.status, "COMPLETED");
});

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
