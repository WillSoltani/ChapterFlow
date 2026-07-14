import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  after,
  test,
} from "node:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

import {
  assertNativeContractGitProvenance,
  type NativeContractGitProvenanceOptions,
} from "./native-contract-provenance";

const TRUSTED_MAIN_REF = "refs/remotes/origin/main";
const CORE_PATH = "contracts/native-contract-core.ts";
const GENERATOR_PATH = "scripts/generate-native-contract.ts";
const ROUTE_PATH = "app/api/book/route.ts";
const SERIALIZER_PATH = "app/api/book/serializer.ts";
const ARTIFACT_PATH = "contracts/native-ios/v1/contract-bundle.json";
const EXPECTED_MISSING_PATH = "app/api/book/missing/route.ts";
const REQUIRED_INPUT_PATHS = [CORE_PATH, GENERATOR_PATH, ROUTE_PATH, SERIALIZER_PATH] as const;

type ContractFixture = {
  root: string;
  baseRevision: string;
  sourceRevision: string;
};

const disposableRoots: string[] = [];

after(() => {
  for (const root of disposableRoots.reverse()) {
    rmSync(root, { recursive: true, force: true });
  }
});

function tempDirectory(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  disposableRoots.push(root);
  return root;
}

function runGit(repoRoot: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: "2026-07-13T12:00:00Z",
      GIT_COMMITTER_DATE: "2026-07-13T12:00:00Z",
    },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function writeRepoFile(repoRoot: string, path: string, contents: string): void {
  const absolutePath = join(repoRoot, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, contents, "utf8");
}

function commitAll(repoRoot: string, message: string): string {
  runGit(repoRoot, ["add", "--all"]);
  runGit(repoRoot, ["commit", "--quiet", "--message", message]);
  return runGit(repoRoot, ["rev-parse", "HEAD"]);
}

function createFeatureFixture(missingPaths: readonly string[] = []): ContractFixture {
  const root = tempDirectory("chapterflow-contract-provenance-");
  runGit(root, ["init", "--quiet", "--initial-branch=main"]);
  runGit(root, ["config", "user.name", "ChapterFlow Contract Test"]);
  runGit(root, ["config", "user.email", "contract-test@example.invalid"]);
  runGit(root, ["config", "commit.gpgsign", "false"]);

  const missing = new Set(missingPaths);
  const baseFiles: Array<[string, string]> = [
    [CORE_PATH, "export const contractVersion = 1;\n"],
    [GENERATOR_PATH, "export const generatorVersion = 1;\n"],
    [ROUTE_PATH, "export const method = 'GET';\n"],
    [SERIALIZER_PATH, "export const envelope = 'books';\n"],
    [ARTIFACT_PATH, "{\"version\":1}\n"],
  ];
  for (const [path, contents] of baseFiles) {
    if (!missing.has(path)) writeRepoFile(root, path, contents);
  }
  writeRepoFile(root, "README.md", "fixture\n");
  const baseRevision = commitAll(root, "contract base");
  runGit(root, ["update-ref", TRUSTED_MAIN_REF, baseRevision]);

  runGit(root, ["checkout", "--quiet", "-b", "feature"]);
  writeRepoFile(root, CORE_PATH, "export const contractVersion = 2;\n");
  if (!missing.has(ARTIFACT_PATH)) {
    writeRepoFile(root, ARTIFACT_PATH, "{\"version\":2}\n");
  }
  const sourceRevision = commitAll(root, "update native contract");
  return { root, baseRevision, sourceRevision };
}

function options(
  fixture: ContractFixture,
  overrides: Partial<NativeContractGitProvenanceOptions> = {}
): NativeContractGitProvenanceOptions {
  return {
    repoRoot: fixture.root,
    sourceRevision: fixture.sourceRevision,
    sourceRevisionPhase: "committed_backend_branch",
    trustedMainRef: TRUSTED_MAIN_REF,
    requiredInputPaths: REQUIRED_INPUT_PATHS,
    expectedMissingInputPaths: [EXPECTED_MISSING_PATH],
    contractArtifactPath: ARTIFACT_PATH,
    ...overrides,
  };
}

function createNormalMergeFixture(): ContractFixture & { mergeRevision: string } {
  const fixture = createFeatureFixture();
  runGit(fixture.root, ["checkout", "--quiet", "main"]);
  runGit(fixture.root, ["merge", "--quiet", "--no-ff", "--message", "merge contract", "feature"]);
  const mergeRevision = runGit(fixture.root, ["rev-parse", "HEAD"]);
  runGit(fixture.root, ["update-ref", TRUSTED_MAIN_REF, mergeRevision]);
  runGit(fixture.root, ["checkout", "--quiet", "--detach", fixture.sourceRevision]);
  return { ...fixture, mergeRevision };
}

function createSquashMergeFixture(): ContractFixture & {
  featureRevision: string;
  squashRevision: string;
} {
  const fixture = createFeatureFixture();
  const featureRevision = fixture.sourceRevision;
  runGit(fixture.root, ["checkout", "--quiet", "main"]);
  runGit(fixture.root, ["merge", "--quiet", "--squash", "feature"]);
  const squashRevision = commitAll(fixture.root, "squash native contract");
  runGit(fixture.root, ["update-ref", TRUSTED_MAIN_REF, squashRevision]);
  return { ...fixture, featureRevision, squashRevision };
}

test("valid committed backend branch provenance verifies exact clean Git bytes", () => {
  const fixture = createFeatureFixture();
  const first = assertNativeContractGitProvenance(options(fixture));
  const second = assertNativeContractGitProvenance(options(fixture));

  assert.equal(first.sourceRevision, fixture.sourceRevision);
  assert.equal(first.sourceRevisionPhase, "committed_backend_branch");
  assert.equal(first.trustedMainRevision, fixture.baseRevision);
  assert.match(first.inputTreeDigest, /^[0-9a-f]{64}$/);
  assert.equal(first.inputTreeDigest, second.inputTreeDigest);
  assert.deepEqual(first.verifiedInputPaths, [...REQUIRED_INPUT_PATHS, ARTIFACT_PATH].sort());
  assert.deepEqual(first.verifiedMissingInputPaths, [EXPECTED_MISSING_PATH]);
});

test("stale complete ancestor is rejected when it does not equal HEAD", () => {
  const fixture = createFeatureFixture();
  assert.throws(
    () =>
      assertNativeContractGitProvenance(
        options(fixture, { sourceRevision: fixture.baseRevision })
      ),
    /HEAD .* does not equal contract source revision/
  );
});

test("source revision missing the generator is rejected", () => {
  const fixture = createFeatureFixture([GENERATOR_PATH]);
  assert.throws(
    () => assertNativeContractGitProvenance(options(fixture)),
    /required contract input is missing .*generate-native-contract\.ts/
  );
});

test("source revision missing the canonical bundle is rejected", () => {
  const fixture = createFeatureFixture([ARTIFACT_PATH]);
  assert.throws(
    () => assertNativeContractGitProvenance(options(fixture)),
    /required contract input is missing .*contract-bundle\.json/
  );
});

for (const [label, path] of [
  ["route", ROUTE_PATH],
  ["serializer", SERIALIZER_PATH],
  ["generator", GENERATOR_PATH],
] as const) {
  test(`dirty ${label} input is rejected`, () => {
    const fixture = createFeatureFixture();
    writeRepoFile(fixture.root, path, `// dirty ${label}\n`);
    assert.throws(
      () => assertNativeContractGitProvenance(options(fixture)),
      /relevant contract inputs are not clean/
    );
  });
}

test("staged relevant input is rejected even when worktree bytes equal HEAD", () => {
  const fixture = createFeatureFixture();
  const committedBytes = readFileSync(join(fixture.root, ROUTE_PATH));
  writeRepoFile(fixture.root, ROUTE_PATH, "// staged route\n");
  runGit(fixture.root, ["add", ROUTE_PATH]);
  runGit(fixture.root, ["restore", "--worktree", "--source=HEAD", "--", ROUTE_PATH]);
  assert.deepEqual(readFileSync(join(fixture.root, ROUTE_PATH)), committedBytes);

  assert.throws(
    () => assertNativeContractGitProvenance(options(fixture)),
    /relevant contract inputs are not clean/
  );
});

test("untracked expected-missing input is rejected", () => {
  const fixture = createFeatureFixture();
  writeRepoFile(fixture.root, EXPECTED_MISSING_PATH, "export const POST = true;\n");
  assert.throws(
    () => assertNativeContractGitProvenance(options(fixture)),
    /expected-missing contract input exists in the worktree/
  );
});

test("an expected-missing input tracked by the source revision is rejected", () => {
  const fixture = createFeatureFixture();
  writeRepoFile(fixture.root, EXPECTED_MISSING_PATH, "export const POST = true;\n");
  const sourceRevision = commitAll(fixture.root, "add formerly missing route");
  assert.throws(
    () =>
      assertNativeContractGitProvenance(
        options(fixture, { sourceRevision })
      ),
    /expected-missing contract input exists at/
  );
});

test("HEAD/source mismatch is rejected", () => {
  const fixture = createFeatureFixture();
  writeRepoFile(fixture.root, "README.md", "unrelated later commit\n");
  commitAll(fixture.root, "unrelated follow-up");
  assert.throws(
    () => assertNativeContractGitProvenance(options(fixture)),
    /HEAD .* does not equal contract source revision/
  );
});

test("an unrelated later HEAD cannot be presented as the contract-changing revision", () => {
  const fixture = createFeatureFixture();
  writeRepoFile(fixture.root, "README.md", "unrelated later commit\n");
  const unrelatedRevision = commitAll(fixture.root, "unrelated follow-up");
  assert.throws(
    () =>
      assertNativeContractGitProvenance(
        options(fixture, { sourceRevision: unrelatedRevision })
      ),
    /not the latest commit changing the supplied contract inputs/
  );
});

test("false merged phase is rejected for an unmerged feature head", () => {
  const fixture = createFeatureFixture();
  assert.throws(
    () =>
      assertNativeContractGitProvenance(
        options(fixture, { sourceRevisionPhase: "merged_backend" })
      ),
    /merged backend revision is not reachable from trusted main/
  );
});

test("missing trusted-main ref is rejected", () => {
  const fixture = createFeatureFixture();
  runGit(fixture.root, ["update-ref", "-d", TRUSTED_MAIN_REF]);
  assert.throws(
    () => assertNativeContractGitProvenance(options(fixture)),
    /trusted main ref does not exist/
  );
});

test("shallow history is rejected before ancestry is classified", () => {
  const fixture = createFeatureFixture();
  const cloneParent = tempDirectory("chapterflow-contract-shallow-");
  const cloneRoot = join(cloneParent, "repo");
  execFileSync(
    "git",
    [
      "clone",
      "--quiet",
      "--depth",
      "1",
      "--branch",
      "feature",
      pathToFileURL(fixture.root).href,
      cloneRoot,
    ],
    { stdio: "ignore" }
  );
  const shallowRevision = runGit(cloneRoot, ["rev-parse", "HEAD"]);
  assert.throws(
    () =>
      assertNativeContractGitProvenance({
        ...options(fixture),
        repoRoot: cloneRoot,
        sourceRevision: shallowRevision,
      }),
    /requires complete non-shallow Git history/
  );
});

test("branch phase rejects a normally merged source revision", () => {
  const fixture = createNormalMergeFixture();
  assert.throws(
    () => assertNativeContractGitProvenance(options(fixture)),
    /already reachable from trusted main/
  );
});

test("branch phase rejects a squash-integrated contract artifact", () => {
  const fixture = createSquashMergeFixture();
  runGit(fixture.root, ["checkout", "--quiet", "--detach", fixture.featureRevision]);
  assert.throws(
    () =>
      assertNativeContractGitProvenance(
        options(fixture, { sourceRevision: fixture.featureRevision })
      ),
    /contract artifact is already integrated into trusted main/
  );
});

test("branch phase still rejects squash integration after a later main contract change", () => {
  const fixture = createSquashMergeFixture();
  writeRepoFile(fixture.root, ARTIFACT_PATH, "{\"version\":3}\n");
  const laterMainRevision = commitAll(fixture.root, "later main contract change");
  runGit(fixture.root, ["update-ref", TRUSTED_MAIN_REF, laterMainRevision]);
  runGit(fixture.root, ["checkout", "--quiet", "--detach", fixture.featureRevision]);

  assert.throws(
    () =>
      assertNativeContractGitProvenance(
        options(fixture, { sourceRevision: fixture.featureRevision })
      ),
    /contract artifact is already integrated into trusted main/
  );
});

test("merged phase rejects a source revision on a divergent history", () => {
  const fixture = createFeatureFixture();
  runGit(fixture.root, ["checkout", "--quiet", "main"]);
  writeRepoFile(fixture.root, CORE_PATH, "export const contractVersion = 99;\n");
  writeRepoFile(fixture.root, ARTIFACT_PATH, "{\"version\":99}\n");
  const divergentMain = commitAll(fixture.root, "divergent main contract");
  runGit(fixture.root, ["update-ref", TRUSTED_MAIN_REF, divergentMain]);
  runGit(fixture.root, ["checkout", "--quiet", "--detach", fixture.sourceRevision]);

  assert.throws(
    () =>
      assertNativeContractGitProvenance(
        options(fixture, { sourceRevisionPhase: "merged_backend" })
      ),
    /merged backend revision is not reachable from trusted main/
  );
});

test("valid normal-merge provenance accepts the exact reachable feature commit", () => {
  const fixture = createNormalMergeFixture();
  const verified = assertNativeContractGitProvenance(
    options(fixture, { sourceRevisionPhase: "merged_backend" })
  );
  assert.equal(verified.sourceRevision, fixture.sourceRevision);
  assert.equal(verified.sourceRevisionPhase, "merged_backend");
  assert.equal(verified.trustedMainRevision, fixture.mergeRevision);
});

test("valid squash-merge provenance accepts the exact reachable squash commit", () => {
  const fixture = createSquashMergeFixture();
  const verified = assertNativeContractGitProvenance(
    options(fixture, {
      sourceRevision: fixture.squashRevision,
      sourceRevisionPhase: "merged_backend",
    })
  );
  assert.equal(verified.sourceRevision, fixture.squashRevision);
  assert.equal(verified.sourceRevisionPhase, "merged_backend");
  assert.equal(verified.trustedMainRevision, fixture.squashRevision);
});

test("abbreviated and nonexistent source revisions are rejected", () => {
  const fixture = createFeatureFixture();
  assert.throws(
    () =>
      assertNativeContractGitProvenance(
        options(fixture, { sourceRevision: fixture.sourceRevision.slice(0, 12) })
      ),
    /must be a full lowercase Git SHA/
  );
  assert.throws(
    () =>
      assertNativeContractGitProvenance(
        options(fixture, { sourceRevision: "f".repeat(40) })
      ),
    /contract source revision does not exist/
  );
});
