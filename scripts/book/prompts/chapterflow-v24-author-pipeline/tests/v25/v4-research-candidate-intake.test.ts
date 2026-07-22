import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  const hardSpecifics = number === 1
    ? [
        "Magic Castle Hotel guests use the red poolside telephone to request service.",
        "The popsicles arrive beside the pool on a silver tray.",
      ]
    : [
        "KIPP students announce their selected college before families and peers.",
        "College Signing Day turns the choice into a witnessed transition.",
      ];
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
  const modelRoutes: Array<{ profileId: string; workDir: string }> = [];
  const runner: ModelTaskRunner = {
    async run(request) {
      operations.push(request.context.operationId);
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
      const chapterMatch = request.context.operationId.match(/research-ch(\d+)$/);
      const chapterNumber = Number(chapterMatch?.[1] ?? 1);
      const chapterTitle = chapterNumber === 1 ? "Defining Moments" : "Thinking in Moments";
      const output = request.context.operationId === "research-bibliography"
        ? bibliography()
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
  return { port, request, runStore, candidates, operations, modelRoutes };
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

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
