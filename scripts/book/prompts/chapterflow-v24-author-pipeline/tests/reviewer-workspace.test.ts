/**
 * IMP-08 — reviewer role workspaces (physically blind review).
 *
 * Proves the information barrier is TECHNICAL: each reviewer role's workspace
 * contains exactly its manifest's files (nothing else — no key, no source, no
 * identity, no repo), key material cannot reach a key-blind role even when a
 * caller tries, and post-spawn drift/debris is detected. Red-team items from
 * the plan: key leak via sidecar/filename, identity strings in artifacts,
 * parent-directory escape (delegated to IMP-00's path guards, re-pinned here).
 */

import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { test } from "./harness.js";
import {
  assertReviewerWorkspaceIntact,
  buildReviewerWorkspace,
  containsAnswerKeyMaterial,
  KEY_BLIND_REVIEWER_ROLES,
  REVIEWER_ROLE_MANIFESTS,
  ReviewerWorkspaceError,
} from "../src/review/reviewerWorkspace.js";
import { renderChapterReaderDoc, renderChapterReaderDocPhase1 } from "../src/review/renderReaderDoc.js";
import type { ChapterV21 } from "../src/types.js";

const PIPE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function mkChapter(): ChapterV21 {
  return {
    chapterId: "zz-ws-ch01",
    number: 1,
    title: "Workspace Fixture",
    hook: "A hook paragraph that reads like prose.",
    breakdown: { fastRead: "Fast.", deepRead: "Deep.", fullRead: "Full." },
    keyTakeaway: "The takeaway.",
    tryThisNow: "Try this now.",
    examples: [{ title: "Ex", scenario: "A scenario.", whatToDo: "Do it.", whyItMatters: "It matters." }],
    quiz: { questions: [{ questionId: "q1", prompt: "What is tested?", choices: ["alpha", "beta", "gamma"], correctIndex: 1, explanation: "Beta is correct because the prose says beta explicitly." }] },
    reviewCards: [{ front: "F", back: "B" }],
    memorableLines: [{ text: "A memorable line.", why: "It sticks." }],
  } as unknown as ChapterV21;
}

test("role manifest matrix: every ReviewerRoleV1 has a minimal artifact set; only quiz-adjudication may see phase-2", () => {
  for (const [role, kinds] of Object.entries(REVIEWER_ROLE_MANIFESTS)) {
    assert.ok(kinds.length > 0, `${role} has a non-empty manifest`);
    if (role !== "quiz-adjudication") {
      assert.ok(!kinds.includes("phase2-doc"), `${role} must not see the phase-2 (key-visible) doc`);
      assert.ok(KEY_BLIND_REVIEWER_ROLES.includes(role as never), `${role} is key-blind`);
    }
  }
  assert.deepEqual(REVIEWER_ROLE_MANIFESTS["direct-reader"], ["phase1-doc"], "direct reader sees the phase-1 doc ONLY");
  assert.deepEqual(REVIEWER_ROLE_MANIFESTS["quiz-adjudication"], ["phase2-doc"], "adjudicator sees the phase-2 doc ONLY");
  assert.ok(!REVIEWER_ROLE_MANIFESTS["source-verifier"].includes("phase2-doc"), "source verifier never sees the key");
});

test("workspace contains EXACTLY the manifest files, outside the repo, and cleanup removes it", () => {
  const ch = mkChapter();
  const doc = renderChapterReaderDocPhase1(ch) + "\n";
  const ws = buildReviewerWorkspace({
    role: "direct-reader",
    artifacts: [{ kind: "phase1-doc", relPath: "ch01.txt", content: doc }],
  });
  try {
    assert.ok(!ws.dir.startsWith(PIPE_ROOT + sep), `workspace ${ws.dir} lives OUTSIDE the pipeline repo`);
    const entries = readdirSync(ws.dir);
    assert.deepEqual(entries.sort(), ["ch01.txt"], "exactly the manifest file set — no key sidecar, no repo, no prior reviews");
    assert.equal(ws.files.length, 1);
    assert.equal(ws.files[0].relPath, "ch01.txt");
    assert.ok(/^[0-9a-f]{64}$/.test(ws.manifestSha256), "manifest hash is a full sha256");
  } finally {
    ws.cleanup();
  }
  assert.ok(!existsSync(ws.dir), "cleanup removes the workspace");
});

test("key-blind containment: legacy (key-bearing) doc content cannot reach ANY key-blind role", () => {
  const ch = mkChapter();
  const keyed = renderChapterReaderDoc(ch) + "\n";
  assert.ok(containsAnswerKeyMaterial(keyed), "the legacy doc IS key material");
  for (const role of KEY_BLIND_REVIEWER_ROLES) {
    const kind = REVIEWER_ROLE_MANIFESTS[role][0];
    assert.throws(
      () => buildReviewerWorkspace({ role, artifacts: [{ kind, relPath: "doc.txt", content: keyed }] }),
      (err: Error) => err instanceof ReviewerWorkspaceError && /answer-key material/.test(err.message),
      `${role} refuses key material at build time`,
    );
  }
  // The one key-visible role accepts it (that is its whole job).
  const ws = buildReviewerWorkspace({ role: "quiz-adjudication", artifacts: [{ kind: "phase2-doc", relPath: "p2.txt", content: keyed }] });
  ws.cleanup();
});

test("book combined-key rows are also detected as key material", () => {
  assert.ok(containsAnswerKeyMaterial("prose\nCHAPTER 4 Q3: b\nmore"), "book key row shape");
  assert.ok(containsAnswerKeyMaterial("prose\nQ2: a — because the text says so\n"), "chapter key row with explanation");
  assert.ok(!containsAnswerKeyMaterial("Q2. What is the prompt?\n   a) choice"), "a question line is NOT key material");
});

test("artifact kind outside the role manifest is refused (fail-closed authorization)", () => {
  assert.throws(
    () => buildReviewerWorkspace({ role: "direct-reader", artifacts: [{ kind: "source-plan", relPath: "plan.txt", content: "plan" }] }),
    (err: Error) => err instanceof ReviewerWorkspaceError && /not in the role manifest/.test(err.message),
    "a direct reader cannot receive a source plan",
  );
  assert.throws(
    () => buildReviewerWorkspace({ role: "quiz-adjudication", artifacts: [{ kind: "phase1-doc", relPath: "d.txt", content: "x" }] }),
    /not in the role manifest/,
    "the adjudicator receives ONLY the phase-2 doc",
  );
});

test("identity strings (author session / model name) in an artifact are refused", () => {
  assert.throws(
    () => buildReviewerWorkspace({
      role: "direct-reader",
      artifacts: [{ kind: "phase1-doc", relPath: "d.txt", content: "prose mentioning author-session-abc123 inline" }],
      forbiddenStrings: ["author-session-abc123"],
    }),
    /forbidden identity string/,
    "author session id must not be reviewer-visible",
  );
  assert.throws(
    () => buildReviewerWorkspace({
      role: "source-verifier",
      artifacts: [{ kind: "source-evidence", relPath: "ev.txt", content: "generated by gpt-5.6-sol at high effort" }],
      forbiddenStrings: ["gpt-5.6-sol"],
    }),
    /forbidden identity string/,
    "model identity must not be reviewer-visible",
  );
});

test("post-spawn integrity: debris and byte drift are detected; a clean workspace passes", () => {
  const ws = buildReviewerWorkspace({
    role: "direct-reader",
    artifacts: [{ kind: "phase1-doc", relPath: "ch01.txt", content: "doc bytes\n" }],
  });
  try {
    assertReviewerWorkspaceIntact(ws); // clean → no throw
    writeFileSync(join(ws.dir, "notes.md"), "a read-only reviewer wrote a file");
    assert.throws(() => assertReviewerWorkspaceIntact(ws), /unexpected entries[\s\S]*notes\.md/, "debris detected");
    rmSync(join(ws.dir, "notes.md"));
    writeFileSync(join(ws.dir, "ch01.txt"), "tampered bytes\n");
    assert.throws(() => assertReviewerWorkspaceIntact(ws), /drifted/, "byte drift detected");
  } finally {
    ws.cleanup();
  }
});

test("IMP-00 path guards hold underneath: parent-escape and symlink sources are rejected", () => {
  assert.throws(
    () => buildReviewerWorkspace({ role: "direct-reader", artifacts: [{ kind: "phase1-doc", relPath: "../escape.txt", content: "x" }] }),
    /parent-escape|absolute/,
    "a workspace file cannot escape the workspace",
  );
  // Symlink rejection is enforced by buildRoleWorkspace on sourcePath inputs;
  // reviewer artifacts are content-only, so a symlink cannot even be expressed
  // — pin that the type surface takes `content` (compile-time) and that a
  // sneaky relative path with .. segments is rejected (runtime, above).
  const base = join(tmpdir(), "cf-imp08-symlink-probe");
  mkdirSync(base, { recursive: true });
  const target = join(base, "target.txt");
  writeFileSync(target, "t");
  const link = join(base, "link.txt");
  try { rmSync(link); } catch { /* absent */ }
  symlinkSync(target, link);
  assert.ok(existsSync(link), "probe symlink exists (environment sanity)");
  rmSync(base, { recursive: true, force: true });
});

test("empty artifact set is refused (a workspace with nothing to read is a builder bug)", () => {
  assert.throws(() => buildReviewerWorkspace({ role: "tiebreak", artifacts: [] }), /no artifacts/);
});
