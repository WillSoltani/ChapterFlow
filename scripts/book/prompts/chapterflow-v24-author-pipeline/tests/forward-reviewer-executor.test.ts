/** Real forward reviewer executor: zero-call injected-spawn coverage. */

import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sha256Hex } from "../src/contracts/contractUtil.js";
import { resolveExecutionProfile } from "../src/exec/executionEnvelope.js";
import type { CodexAgentResult, SpawnCodexAgentOptions } from "../src/orchestrator/codexAgent.js";
import {
  FORWARD_REVIEW_EXECUTION_REQUEST_SCHEMA,
  FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA,
  type ForwardReviewArtifactV1,
  type ForwardReviewExecutionRequestV1,
  type ForwardReviewLane,
  type ForwardReviewerWorkspaceRole,
} from "../src/orchestrator/forwardChapterConductor.js";
import {
  ForwardReviewerExecutorError,
  createForwardReviewerExecutor,
  type ForwardReviewerSchemaMap,
} from "../src/orchestrator/forwardReviewerExecutor.js";
import { ROUTE_POLICY_VERSION } from "../src/orchestrator/modelPolicy.js";
import { test } from "./harness.js";
import { PIPELINE_DIR } from "./helpers.js";

const HASH = {
  role: "1".repeat(64),
  instrument: "2".repeat(64),
};

type Fixture = {
  root: string;
  workspaceBase: string;
  schemas: ForwardReviewerSchemaMap;
  schemaText: Record<ForwardReviewLane, string>;
  dispose: () => void;
};

function makeFixture(): Fixture {
  const root = mkdtempSync(join(tmpdir(), "cf-forward-reviewer-exec-"));
  const schemaDir = join(root, "schemas");
  const workspaceBase = join(root, "workspaces");
  mkdirSync(schemaDir, { recursive: true });
  mkdirSync(workspaceBase, { recursive: true });
  const schemaText: Record<ForwardReviewLane, string> = {
    reader: `${JSON.stringify({ $schema: "http://json-schema.org/draft-07/schema#", title: "reader", type: "object", additionalProperties: true }, null, 2)}\n`,
    source: `${JSON.stringify({ $schema: "http://json-schema.org/draft-07/schema#", title: "source", type: "object", additionalProperties: true }, null, 2)}\n`,
    quiz: `${JSON.stringify({ $schema: "http://json-schema.org/draft-07/schema#", title: "quiz", type: "object", additionalProperties: true }, null, 2)}\n`,
  };
  const schemas: Record<ForwardReviewLane, string> = {
    reader: join(schemaDir, "reader.json"),
    source: join(schemaDir, "source.json"),
    quiz: join(schemaDir, "quiz.json"),
  };
  for (const lane of ["reader", "source", "quiz"] as const) writeFileSync(schemas[lane], schemaText[lane]);
  return {
    root,
    workspaceBase,
    schemas,
    schemaText,
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
}

const ROLE: Record<ForwardReviewLane, ForwardReviewerWorkspaceRole> = {
  reader: "direct-reader",
  source: "source-verifier",
  quiz: "quiz-adjudication",
};

function artifact(kind: ForwardReviewArtifactV1["kind"], relPath: string, content: string): ForwardReviewArtifactV1 {
  return { kind, relPath, content, sha256: sha256Hex(content) };
}

function laneArtifacts(lane: ForwardReviewLane): ForwardReviewArtifactV1[] {
  if (lane === "reader") return [artifact("phase1-doc", "chapter.md", "# Reader-visible chapter\n")];
  if (lane === "source") {
    return [
      artifact("phase1-doc", "chapter.md", "# Source-visible chapter\n"),
      artifact("source-evidence", "source-evidence.json", "{\"evidence\":[]}"),
      artifact("source-plan", "source-plan.json", "{\"units\":[]}"),
    ];
  }
  return [artifact("phase2-doc", "quiz-phase2.md", "# Quiz adjudication packet\n")];
}

function request(fixture: Fixture, lane: ForwardReviewLane = "reader"): ForwardReviewExecutionRequestV1 {
  const { profileHash } = resolveExecutionProfile("chapter-reviewer");
  const model = lane === "source" ? "gpt-5.6-sol" : "gpt-5.5";
  const effort = lane === "quiz" ? "xhigh" : "high";
  return {
    schema: FORWARD_REVIEW_EXECUTION_REQUEST_SCHEMA,
    lane,
    workspaceRole: ROLE[lane],
    profileId: `${model}@${effort}`,
    model,
    effort,
    schemaSha256: sha256Hex(readFileSync(fixture.schemas[lane])),
    instrumentVersion: `${lane}-instrument-v1`,
    roleAssignmentSha256: HASH.role,
    instrumentManifestSha256: HASH.instrument,
    executionProfileHash: profileHash,
    routePolicyVersion: ROUTE_POLICY_VERSION,
    task: `Read the ${lane} packet and return the bound JSON object.`,
    artifacts: laneArtifacts(lane),
  };
}

function okResult(options: SpawnCodexAgentOptions, output = "{}"): CodexAgentResult {
  return {
    ok: true,
    exitCode: 0,
    finalMessage: output,
    stdout: output,
    stderr: "",
    durationMs: 1,
    sessionId: options.sessionId,
    finalMessageSource: "output-file",
  };
}

test("artifact tamper fails before workspace spawn", async () => {
  const fixture = makeFixture();
  let calls = 0;
  try {
    const req = request(fixture);
    (req.artifacts as ForwardReviewArtifactV1[])[0].content += "tampered";
    const execute = createForwardReviewerExecutor({
      schemaMap: fixture.schemas,
      workspaceBaseDir: fixture.workspaceBase,
      spawn: async () => { calls += 1; throw new Error("must not spawn"); },
    });
    await assert.rejects(execute(req), /artifact chapter\.md hash mismatch/);
    assert.equal(calls, 0);
    assert.deepEqual(readdirSync(fixture.workspaceBase), [], "preflight refusal creates no workspace");
  } finally {
    fixture.dispose();
  }
});

test("schema drift fails both before and after spawn, with no trusted receipt", async () => {
  const fixture = makeFixture();
  try {
    const pre = request(fixture);
    writeFileSync(fixture.schemas.reader, "{\"type\":\"array\"}\n");
    let calls = 0;
    const preExecutor = createForwardReviewerExecutor({
      schemaMap: fixture.schemas,
      workspaceBaseDir: fixture.workspaceBase,
      spawn: async () => { calls += 1; throw new Error("must not spawn"); },
    });
    await assert.rejects(preExecutor(pre), /pre-spawn schema hash drift/);
    assert.equal(calls, 0);

    writeFileSync(fixture.schemas.reader, fixture.schemaText.reader);
    const post = request(fixture);
    let workspace = "";
    const postExecutor = createForwardReviewerExecutor({
      schemaMap: fixture.schemas,
      workspaceBaseDir: fixture.workspaceBase,
      spawn: async (options) => {
        workspace = options.cwd;
        writeFileSync(fixture.schemas.reader, "{\"type\":\"number\"}\n");
        return okResult(options);
      },
      clock: () => 10,
      sessionIdFactory: () => "schema-drift-session",
    });
    await assert.rejects(postExecutor(post), /post-spawn schema hash drift/);
    assert.equal(existsSync(workspace), false, "workspace is cleaned after post-spawn schema drift");
  } finally {
    fixture.dispose();
  }
});

test("lane-to-role artifact violations fail closed before spawn", async () => {
  const fixture = makeFixture();
  let calls = 0;
  try {
    const req = request(fixture, "reader");
    req.artifacts = [artifact("source-plan", "source-plan.json", "{\"units\":[]}")];
    const execute = createForwardReviewerExecutor({
      schemaMap: fixture.schemas,
      workspaceBaseDir: fixture.workspaceBase,
      spawn: async () => { calls += 1; throw new Error("must not spawn"); },
    });
    await assert.rejects(execute(req), /artifact kind "source-plan".*not in the role manifest/);
    assert.equal(calls, 0);
    assert.deepEqual(readdirSync(fixture.workspaceBase), []);
  } finally {
    fixture.dispose();
  }
});

test("exact route, model, effort, schema, read-only workspace, and no-API envelope are enforced", async () => {
  const fixture = makeFixture();
  const calls: SpawnCodexAgentOptions[] = [];
  try {
    const execute = createForwardReviewerExecutor({
      schemaMap: fixture.schemas,
      workspaceBaseDir: fixture.workspaceBase,
      clock: () => 1234,
      sessionIdFactory: ({ request: seen, nowMs, sequence }) => `forward-${seen.lane}-${nowMs}-${sequence}`,
      spawn: async (options) => {
        calls.push(options);
        assert.ok(existsSync(options.cwd));
        return okResult(options, "{\"result\":\"PASS\"}");
      },
    });
    const req = request(fixture, "source");
    const receipt = await execute(req);

    assert.equal(calls.length, 1);
    const call = calls[0];
    assert.equal(call.role, "chapter-reviewer");
    assert.equal(call.sandbox, "read-only");
    assert.deepEqual(call.writableRoots, []);
    assert.equal(call.skipGitRepoCheck, true);
    assert.equal(call.model, req.model);
    assert.equal(call.reasoningEffort, req.effort);
    assert.equal(call.outputSchemaPath, fixture.schemas.source);
    assert.equal(call.sessionId, "forward-source-1234-1");
    assert.equal(call.cwd.startsWith(PIPELINE_DIR), false, "reviewer cwd is outside the repository");
    assert.equal(call.env, undefined, "no API/provider environment is injected by the adapter");
    assert.equal(existsSync(call.cwd), false, "workspace is always cleaned after success");

    assert.deepEqual(receipt, {
      schema: FORWARD_REVIEW_EXECUTION_RESULT_SCHEMA,
      executionId: call.sessionId,
      lane: req.lane,
      workspaceRole: req.workspaceRole,
      profileId: req.profileId,
      model: req.model,
      effort: req.effort,
      schemaSha256: req.schemaSha256,
      instrumentVersion: req.instrumentVersion,
      roleAssignmentSha256: req.roleAssignmentSha256,
      instrumentManifestSha256: req.instrumentManifestSha256,
      executionProfileHash: req.executionProfileHash,
      routePolicyVersion: req.routePolicyVersion,
      output: "{\"result\":\"PASS\"}",
    });
  } finally {
    fixture.dispose();
  }
});

test("nonzero, safeguard/refusal, and missing final output all fail closed and clean up", async () => {
  const fixture = makeFixture();
  try {
    const cases: Array<{ name: string; result: (options: SpawnCodexAgentOptions) => CodexAgentResult; expected: RegExp }> = [
      {
        name: "nonzero",
        result: (options) => ({ ...okResult(options), ok: false, exitCode: 7, stderr: "worker failed" }),
        expected: /codex exec failed/,
      },
      {
        name: "refusal",
        result: (options) => ({ ...okResult(options), finalMessage: "I cannot comply with this request.", stdout: "" }),
        expected: /final output is a refusal/,
      },
      {
        name: "missing",
        result: (options) => ({ ...okResult(options), finalMessage: "", stdout: "" }),
        expected: /missing final output/,
      },
    ];

    for (const entry of cases) {
      let cwd = "";
      const execute = createForwardReviewerExecutor({
        schemaMap: fixture.schemas,
        workspaceBaseDir: fixture.workspaceBase,
        clock: () => 20,
        sessionIdFactory: () => `failure-${entry.name}`,
        spawn: async (options) => { cwd = options.cwd; return entry.result(options); },
      });
      await assert.rejects(
        execute(request(fixture)),
        (error: unknown) => error instanceof ForwardReviewerExecutorError && entry.expected.test(error.message),
      );
      assert.equal(existsSync(cwd), false, `${entry.name}: workspace must be cleaned`);
    }
  } finally {
    fixture.dispose();
  }
});

test("workspace tamper is detected after spawn and cleanup still runs", async () => {
  const fixture = makeFixture();
  let cwd = "";
  try {
    const execute = createForwardReviewerExecutor({
      schemaMap: fixture.schemas,
      workspaceBaseDir: fixture.workspaceBase,
      clock: () => 30,
      sessionIdFactory: () => "tamper-session",
      spawn: async (options) => {
        cwd = options.cwd;
        writeFileSync(join(options.cwd, "unexpected.txt"), "writable-route breach");
        return okResult(options);
      },
    });
    await assert.rejects(execute(request(fixture)), /post-spawn integrity failure.*unexpected entries/s);
    assert.equal(existsSync(cwd), false);
    assert.deepEqual(readdirSync(fixture.workspaceBase), []);
  } finally {
    fixture.dispose();
  }
});

test("session ids are unique within an executor and a broken factory cannot silently reuse one", async () => {
  const fixture = makeFixture();
  let calls = 0;
  const cwds: string[] = [];
  try {
    const execute = createForwardReviewerExecutor({
      schemaMap: fixture.schemas,
      workspaceBaseDir: fixture.workspaceBase,
      clock: () => 40,
      sessionIdFactory: () => "reused-session",
      spawn: async (options) => {
        calls += 1;
        cwds.push(options.cwd);
        return okResult(options);
      },
    });
    await execute(request(fixture, "reader"));
    await assert.rejects(execute(request(fixture, "reader")), /session id reused/);
    assert.equal(calls, 1, "duplicate session is refused before a second spawn");
    assert.ok(cwds.every((cwd) => !existsSync(cwd)));
    assert.deepEqual(readdirSync(fixture.workspaceBase), []);
  } finally {
    fixture.dispose();
  }
});
