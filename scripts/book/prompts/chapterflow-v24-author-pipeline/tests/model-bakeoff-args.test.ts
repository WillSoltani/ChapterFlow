/**
 * Model bake-off — model/effort argument construction, prompt equivalence,
 * draft intake hashing, and blinding-leak guards.
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { test } from "./harness.js";
import { codexExecArgv } from "../src/orchestrator/codexAgent.js";
import { authorWriteOneChapter, buildAuthorCard, resolveAuthorIo } from "../src/orchestrator/authorRun.js";
import type { AutopilotDeps } from "../src/orchestrator/autopilot.js";
import { bakeoffRoots, combineHashes, sha256Hex, PIPELINE_DIR, pipelineRel, modelSlug } from "../src/bakeoff/paths.js";
import { intakeDraft, inferDraftIdentity, titleToBookId, DraftIntakeError } from "../src/bakeoff/intake.js";
import { assertNoIdentityLeak, assignBlindLabels, forbiddenReviewTokens, BlindingLeakError } from "../src/bakeoff/review.js";
import { CARD_OUTPUT_PLACEHOLDER } from "../src/bakeoff/freeze.js";
import type { CandidateSpec } from "../src/bakeoff/types.js";
import { fixtureChapter, fixturePacket, tmpRoot, fakeAutopilotDeps } from "./model-bakeoff-helpers.js";

const SPECS: CandidateSpec[] = [
  { model: "gpt-5.6-sol", slug: "gpt-5-6-sol", slot: "w1", effort: "xhigh" },
  { model: "gpt-5.6-terra", slug: "gpt-5-6-terra", slot: "w2", effort: "xhigh" },
  { model: "gpt-5.6-luna", slug: "gpt-5-6-luna", slot: "w3", effort: "xhigh" },
];

// ── 1. exact model/effort argv construction ───────────────────────────────────

test("codexExecArgv pins -c model=<id> and -c model_reasoning_effort=xhigh before the prompt", () => {
  const argv = codexExecArgv("TASK", "workspace-write", [], false, "xhigh", "gpt-5.6-sol");
  const modelIdx = argv.indexOf("model=gpt-5.6-sol");
  const effortIdx = argv.indexOf("model_reasoning_effort=xhigh");
  assert.ok(modelIdx > 0 && argv[modelIdx - 1] === "-c", "-c model=gpt-5.6-sol present");
  assert.ok(effortIdx > 0 && argv[effortIdx - 1] === "-c", "-c model_reasoning_effort=xhigh present");
  assert.equal(argv[argv.length - 1], "TASK", "prompt stays positional-last");
});

test("authorWriteOneChapter passes the candidate model/effort/output overrides to the spawn", async () => {
  const bookId = "zz-bakeoff-args";
  const root = tmpRoot("cf-bakeoff-args-");
  const outputRelPath = pipelineRel(join(root, "chapters", `${bookId}-ch01.v21-native.chapter.json`));
  const spawned: Array<{ model?: string; reasoningEffort?: string; task: string }> = [];
  const verbs: string[][] = [];
  const chapter = fixtureChapter(bookId, 1);
  let bytes: string | null = null;

  const gateKeys: string[] = [];
  const deps = fakeAutopilotDeps({
    runVerb: async (args) => {
      verbs.push(args);
      return { code: 0, stdout: "", stderr: "" };
    },
    // IMP-01: the writer lands the candidate in its attempt workspace (spawn cwd)
    // ONLY — the canonical closure (`bytes`) changes solely via writeChapterFile,
    // exactly like the real store (a spawn-time mutation would fake a CAS race).
    spawn: (async (o: { model?: string; reasoningEffort?: string; task: string; sessionId: string; cwd?: string }) => {
      spawned.push(o);
      if (o.cwd) writeFileSync(join(o.cwd, `${bookId}-ch01.v21-native.chapter.json`), JSON.stringify(chapter, null, 2));
      return { ok: true, exitCode: 0, finalMessage: "done", stdout: "", stderr: "", durationMs: 4, sessionId: o.sessionId };
    }) as unknown as AutopilotDeps["spawn"],
  }) as AutopilotDeps;

  const r = await authorWriteOneChapter(bookId, 1, deps, {
    totalChapters: 1,
    outputRelPath,
    model: "gpt-5.6-terra",
    effort: "xhigh",
    io: {
      readBriefMd: () => "# BRIEF ch01",
      readBrief: () => null,
      readPacket: () => fixturePacket(bookId, 1),
      voiceCard: () => null,
      chapterExists: () => bytes !== null,
      readChapterFile: () => bytes,
      writeChapterFile: (_b, _n, b) => { bytes = b; },
      removeChapterFile: () => { bytes = null; },
      loadChapters: () => (bytes ? [chapter] : []),
      authorSessionOf: () => undefined,
      recordProvenance: () => {},
      readLeadOverride: () => null,
      writeLeadOverride: () => {},
      attemptsRoot: () => join(root, "attempts"),
      gateCandidate: async (_c, _abs, attemptKey) => { gateKeys.push(attemptKey); return { code: 0, stdout: "Gate verdict: PASS — 0 blockers", stderr: "" }; },
      rubricWithCandidate: async () => ({ code: 0, stdout: "ch01: PASS", stderr: "" }),
    },
  });
  assert.equal(r.ok, true, `write should succeed: ${r.ok ? "" : (r as { reason: string }).reason}`);
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0].model, "gpt-5.6-terra", "candidate model pinned on the spawn");
  assert.equal(spawned[0].reasoningEffort, "xhigh", "candidate effort pinned on the spawn");
  // IMP-01: the card's OUTPUT names the workspace candidate FILE; the isolated
  // slot path keys the gate history + sibling context instead.
  assert.ok(spawned[0].task.includes(`Write EXACTLY one file: ${bookId}-ch01.v21-native.chapter.json,`), "card OUTPUT uses the workspace candidate file");
  assert.ok(!spawned[0].task.includes("npx tsx src/cli.ts"), "no repository-command instruction rides the card");
  assert.deepEqual(gateKeys, [outputRelPath], "conductor gates the candidate keyed by the isolated path");
});

// ── 6. candidate prompt equivalence (byte-equal modulo the output path) ───────

test("candidate author cards are byte-equivalent in substantive content — only the output path differs, and no model name appears", () => {
  const bookId = "zz-bakeoff-equiv";
  const packet = fixturePacket(bookId, 1);
  const mk = (outputRelPath: string): string =>
    buildAuthorCard({ bookId, chapterNumber: 1, totalChapters: 9, briefMd: "# BRIEF", packet, voice: null, brief: null, outputRelPath });
  const cards = ["state/model-bakeoffs/b/r/work/w1/chapters/f.json", "state/model-bakeoffs/b/r/work/w2/chapters/f.json", "state/model-bakeoffs/b/r/work/w3/chapters/f.json"].map(mk);
  const normalized = cards.map((c, i) => c.split(`work/w${i + 1}/`).join(`work/${CARD_OUTPUT_PLACEHOLDER}/`));
  assert.equal(normalized[0], normalized[1]);
  assert.equal(normalized[1], normalized[2]);
  for (const card of cards) {
    for (const tell of ["gpt-5.6", "sol", "terra", "luna", "flagship", "cheap", "expensive"]) {
      assert.ok(!new RegExp(`(^|[^a-z0-9])${tell}($|[^a-z0-9])`, "i").test(card), `card must not mention "${tell}"`);
    }
  }
  // The template hash (placeholder path) is identical by construction.
  const tpl = cards.map((c, i) => sha256Hex(c.split(`state/model-bakeoffs/b/r/work/w${i + 1}/chapters/f.json`).join(CARD_OUTPUT_PLACEHOLDER)));
  assert.equal(new Set(tpl).size, 1, "card template hash equal across candidates");
});

// ── 4. immutable input hashing (draft intake) ─────────────────────────────────

test("intakeDraft copies the draft immutably, hashes original + extraction, and resolves identity from front matter", () => {
  const dir = tmpRoot("cf-bakeoff-intake-");
  const draftPath = join(dir, "My Book.md");
  const body = "---\ntitle: The Spacing Effect\nauthor: Ada Writer\n---\n# The Spacing Effect\n\n" + "Spaced retrieval beats massed rereading. ".repeat(20);
  writeFileSync(draftPath, body);
  const roots = bakeoffRoots("the-spacing-effect", "bo-test", join(dir, "state"));
  const intake = intakeDraft(draftPath, roots);
  assert.equal(intake.title, "The Spacing Effect");
  assert.equal(intake.author, "Ada Writer");
  assert.equal(intake.bookId, "the-spacing-effect");
  assert.equal(intake.identitySource, "front-matter");
  assert.equal(intake.identityConfident, true);
  assert.equal(intake.sha256, sha256Hex(readFileSync(draftPath)));
  const stored = resolve(PIPELINE_DIR, intake.storedDraftRelPath);
  assert.ok(existsSync(stored), "immutable draft copy exists");
  assert.equal(readFileSync(stored, "utf8"), body, "copy is byte-exact");
  assert.equal(readFileSync(draftPath, "utf8"), body, "original never altered");
  // Idempotent re-intake; a DIFFERENT draft under the same run is refused.
  const again = intakeDraft(draftPath, roots);
  assert.equal(again.extractedTextSha256, intake.extractedTextSha256);
  writeFileSync(draftPath, body + "\nEDITED");
  assert.throws(() => intakeDraft(draftPath, roots), DraftIntakeError);
});

test("draft identity: heading+by is confident; filename fallback is provisional", () => {
  const confident = inferDraftIdentity("# Deep Work\n\nby Cal Author\n\ntext", "x.md");
  assert.equal(confident.title, "Deep Work");
  assert.equal(confident.author, "Cal Author");
  assert.equal(confident.confident, true);
  const provisional = inferDraftIdentity("no headings here at all", "my-great-book.md");
  assert.equal(provisional.title, "My Great Book");
  assert.equal(provisional.confident, false);
  assert.equal(titleToBookId("The 7 Habits of Highly Effective People!"), "the-7-habits-of-highly-effective-people");
});

// ── 7 + 8. blind label randomization + leak guard ─────────────────────────────

test("assignBlindLabels randomly permutes candidates under opaque labels", () => {
  const seq = [0.9, 0.1, 0.5];
  let i = 0;
  const map = assignBlindLabels(SPECS, () => seq[i++ % seq.length]);
  assert.deepEqual(Object.keys(map).sort(), ["A", "B", "C"]);
  assert.deepEqual(Object.values(map).sort(), SPECS.map((s) => s.model).sort());
  // A different rng yields a different permutation (randomization is real).
  const map2 = assignBlindLabels(SPECS, () => 0);
  assert.notDeepEqual(map, map2);
});

test("assertNoIdentityLeak trips on model ids, family names, and slots — not on ordinary words", () => {
  const forbidden = forbiddenReviewTokens(SPECS);
  assert.throws(() => assertNoIdentityLeak("this doc mentions gpt-5.6-sol somewhere", forbidden, "doc"), BlindingLeakError);
  assert.throws(() => assertNoIdentityLeak("the sol candidate was fastest", forbidden, "doc"), BlindingLeakError);
  assert.throws(() => assertNoIdentityLeak("output of w2 follows", forbidden, "doc"), BlindingLeakError);
  assert.throws(() => assertNoIdentityLeak("our flagship pick", forbidden, "doc"), BlindingLeakError);
  // Word-boundary safety: "solution", "console", "lunar" must NOT trip "sol"/"luna".
  assertNoIdentityLeak("the solution lives in the console under lunar terrain", forbidden, "doc");
  assertNoIdentityLeak("an ordinary chapter about territory and craft", forbidden, "doc");
});

test("modelSlug + combineHashes are stable and order-independent", () => {
  assert.equal(modelSlug("gpt-5.6-sol"), "gpt-5-6-sol");
  const a = combineHashes([{ relPath: "b", sha256: "2" }, { relPath: "a", sha256: "1" }]);
  const b = combineHashes([{ relPath: "a", sha256: "1" }, { relPath: "b", sha256: "2" }]);
  assert.equal(a, b);
});

// resolveAuthorIo default path shape stays canonical (guards the seam we added).
test("authorRun default io still targets canonical state/chapters when no override is given", () => {
  const io = resolveAuthorIo();
  assert.equal(typeof io.chapterExists, "function");
  const card = buildAuthorCard({ bookId: "zz-x", chapterNumber: 2, briefMd: "# B", packet: fixturePacket("zz-x", 2), voice: null, brief: null });
  assert.ok(card.includes("Write EXACTLY one file: state/chapters/zz-x-ch02.v21-native.chapter.json,"), "default OUTPUT path unchanged");
});
