import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FRONTEND_SSM_RUNTIME_SECRET_NAMES } from "../infra/lib/frontend-runtime-config";

const ROOT = process.cwd();
const SCRIPT = join(ROOT, "scripts/ci/sync-runtime-secrets.sh");
const WORKFLOW = join(ROOT, ".github/workflows/sync-runtime-secrets.yml");
const PREFIX = "/chapterflow/test";

const REQUIRED_NAMES = [
  "BOOK_STRIPE_SECRET_KEY",
  "BOOK_STRIPE_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
  "AUTH_STATE_SECRET",
] as const;
const OPTIONAL_NAMES = ["ELEVENLABS_API_KEY"] as const;
const ALL_NAMES = [...REQUIRED_NAMES, ...OPTIONAL_NAMES];

// A fake `aws` program. It records each call (arguments separated by a unit
// separator, one call per line) and, when a file named after the parameter
// exists under fail/, answers the way the real CLI does: exit 254 and one
// stderr line. The line and the success output both carry the value it was
// given, so the tests can prove the script never repeats CLI output verbatim.
const FAKE_AWS = `#!/bin/bash
dir="$(dirname "$0")"
printf '%s\\037' "$@" >> "$dir/calls.log"
printf '\\n' >> "$dir/calls.log"
name=""
value=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --name) name="$2"; shift ;;
    --value) value="$2"; shift ;;
  esac
  shift
done
short="\${name##*/}"
if [ -f "$dir/fail/$short" ]; then
  code="$(cat "$dir/fail/$short")"
  echo "An error occurred ($code) when calling the PutParameter operation: parameter $name with value $value was not written" >&2
  exit 254
fi
echo "{\\"Version\\": 1, \\"Tier\\": \\"Standard\\", \\"Echo\\": \\"$value\\"}"
`;

function valueFor(name: string): string {
  return `distinct-test-value-${name.toLowerCase()}-q7z`;
}

function allValues(): Record<string, string> {
  return Object.fromEntries(ALL_NAMES.map((name) => [name, valueFor(name)]));
}

type RunOptions = {
  values: Record<string, string>;
  mode?: string;
  prefix?: string;
  failures?: Record<string, string>;
};

type Call = { args: string[]; name: string | undefined };

type RunResult = {
  status: number | null;
  stdout: string;
  stderr: string;
  output: string;
  calls: Call[];
};

function runScript(options: RunOptions): RunResult {
  const dir = mkdtempSync(join(tmpdir(), "sync-runtime-secrets-"));
  try {
    writeFileSync(join(dir, "aws"), FAKE_AWS);
    chmodSync(join(dir, "aws"), 0o755);
    mkdirSync(join(dir, "fail"));
    for (const [name, code] of Object.entries(options.failures ?? {})) {
      writeFileSync(join(dir, "fail", name), code);
    }

    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      PATH: `${dir}:/usr/bin:/bin`,
      ...options.values,
    };
    if (options.mode !== undefined) env.SYNC_MODE = options.mode;

    const result = spawnSync("bash", [SCRIPT, options.prefix ?? PREFIX], {
      cwd: ROOT,
      env,
      encoding: "utf8",
    });

    const logPath = join(dir, "calls.log");
    const calls = existsSync(logPath)
      ? readFileSync(logPath, "utf8")
          .split("\n")
          .filter((line) => line.length > 0)
          .map((line) => {
            const args = line.split("\u001f").slice(0, -1);
            const nameIndex = args.indexOf("--name");
            return { args, name: nameIndex >= 0 ? args[nameIndex + 1] : undefined };
          })
      : [];

    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      output: `${result.stdout}\n${result.stderr}`,
      calls,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function lines(text: string): string[] {
  return text.split("\n").filter((line) => line.length > 0);
}

test("default mode creates every parameter as a SecureString without overwrite", () => {
  const result = runScript({ values: allValues() });

  assert.equal(result.status, 0, result.output);
  assert.deepEqual(
    result.calls.map((call) => call.name),
    ALL_NAMES.map((name) => `${PREFIX}/${name}`),
  );
  for (const call of result.calls) {
    assert.deepEqual(call.args.slice(0, 2), ["ssm", "put-parameter"]);
    const typeIndex = call.args.indexOf("--type");
    assert.equal(call.args[typeIndex + 1], "SecureString");
    assert.ok(!call.args.includes("--overwrite"), call.args.join(" "));
  }
  for (const name of ALL_NAMES) {
    assert.ok(lines(result.stdout).includes(`created ${PREFIX}/${name}`), result.output);
  }
});

test("default mode keeps the existing values and adds only the missing speech key", () => {
  const failures = Object.fromEntries(
    REQUIRED_NAMES.map((name) => [name, "ParameterAlreadyExists"]),
  );
  const result = runScript({ values: allValues(), failures });

  assert.equal(result.status, 0, result.output);
  assert.equal(result.calls.length, 5);
  for (const name of REQUIRED_NAMES) {
    assert.ok(lines(result.stdout).includes(`kept existing ${PREFIX}/${name}`), result.output);
  }
  assert.ok(
    lines(result.stdout).includes(`created ${PREFIX}/ELEVENLABS_API_KEY`),
    result.output,
  );
  assert.doesNotMatch(result.output, /::error::/);
});

test("overwrite mode passes --overwrite on every call", () => {
  const result = runScript({ values: allValues(), mode: "overwrite" });

  assert.equal(result.status, 0, result.output);
  assert.equal(result.calls.length, 5);
  for (const call of result.calls) {
    assert.ok(call.args.includes("--overwrite"), call.args.join(" "));
  }
  for (const name of ALL_NAMES) {
    assert.ok(lines(result.stdout).includes(`synced ${PREFIX}/${name}`), result.output);
  }
});

test("overwrite mode treats an existing-parameter answer as a failure", () => {
  const result = runScript({
    values: allValues(),
    mode: "overwrite",
    failures: { AUTH_STATE_SECRET: "ParameterAlreadyExists" },
  });

  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /::error::.*AUTH_STATE_SECRET.*ParameterAlreadyExists/);
});

test("a blank optional value prints a warning, makes no call for it and succeeds", () => {
  const result = runScript({ values: { ...allValues(), ELEVENLABS_API_KEY: "" } });

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /::warning::.*ELEVENLABS_API_KEY/);
  assert.deepEqual(
    result.calls.map((call) => call.name),
    REQUIRED_NAMES.map((name) => `${PREFIX}/${name}`),
  );
});

test("a missing optional value is treated like a blank one", () => {
  const values = allValues();
  delete values.ELEVENLABS_API_KEY;
  const result = runScript({ values });

  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /::warning::.*ELEVENLABS_API_KEY/);
  assert.equal(result.calls.length, 4);
});

test("a blank required value prints an error, still processes the others and exits 1", () => {
  const result = runScript({ values: { ...allValues(), ANTHROPIC_API_KEY: "  \t " } });

  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /::error::.*ANTHROPIC_API_KEY/);
  assert.deepEqual(
    result.calls.map((call) => call.name),
    ALL_NAMES.filter((name) => name !== "ANTHROPIC_API_KEY").map(
      (name) => `${PREFIX}/${name}`,
    ),
  );
});

test("another AWS failure reports the error code, continues and exits 1", () => {
  const result = runScript({
    values: allValues(),
    failures: { BOOK_STRIPE_WEBHOOK_SECRET: "AccessDeniedException" },
  });

  assert.equal(result.status, 1, result.output);
  assert.equal(result.calls.length, 5);
  assert.match(
    result.output,
    /::error::.*\/chapterflow\/test\/BOOK_STRIPE_WEBHOOK_SECRET.*AccessDeniedException/,
  );
  assert.ok(
    lines(result.stdout).includes(`created ${PREFIX}/ELEVENLABS_API_KEY`),
    result.output,
  );
});

test("no value ever appears in the script output", () => {
  const scenarios: RunOptions[] = [
    { values: allValues() },
    { values: allValues(), mode: "overwrite" },
    {
      values: allValues(),
      failures: Object.fromEntries(
        REQUIRED_NAMES.map((name) => [name, "ParameterAlreadyExists"]),
      ),
    },
    {
      values: allValues(),
      failures: Object.fromEntries(ALL_NAMES.map((name) => [name, "AccessDeniedException"])),
    },
    {
      values: allValues(),
      mode: "overwrite",
      failures: Object.fromEntries(ALL_NAMES.map((name) => [name, "AccessDeniedException"])),
    },
  ];

  for (const scenario of scenarios) {
    const result = runScript(scenario);
    assert.ok(result.calls.length > 0, "the fake aws program must have run");
    assert.doesNotMatch(result.output, /distinct-test-value/);
    for (const name of ALL_NAMES) {
      assert.ok(!result.output.includes(valueFor(name)), `${name} value leaked`);
    }
  }
});

test("a prefix outside /chapterflow/<env> is a usage error with no AWS call", () => {
  for (const prefix of ["/chapterflow/", "/other/prod", "/chapterflow/prod/extra", "chapterflow/prod", "/chapterflow/Prod"]) {
    const result = runScript({ values: allValues(), prefix });
    assert.equal(result.status, 2, `${prefix}: ${result.output}`);
    assert.equal(result.calls.length, 0, prefix);
    assert.notEqual(result.stderr.trim(), "", prefix);
  }
});

test("an unknown mode is a usage error with no AWS call", () => {
  const result = runScript({ values: allValues(), mode: "replace" });

  assert.equal(result.status, 2, result.output);
  assert.equal(result.calls.length, 0);
  assert.notEqual(result.stderr.trim(), "");
});

test("an empty mode falls back to the default missing mode", () => {
  const result = runScript({ values: allValues(), mode: "" });

  assert.equal(result.status, 0, result.output);
  assert.equal(result.calls.length, 5);
  for (const call of result.calls) {
    assert.ok(!call.args.includes("--overwrite"), call.args.join(" "));
  }
});

test("the script copies exactly the runtime secret names the server reads from SSM", () => {
  assert.deepEqual([...ALL_NAMES].sort(), [...FRONTEND_SSM_RUNTIME_SECRET_NAMES].sort());

  const source = readFileSync(SCRIPT, "utf8");
  const listed = (variable: string): string[] => {
    const match = source.match(new RegExp(`^${variable}=\\(([^)]*)\\)`, "m"));
    assert.ok(match?.[1] !== undefined, `${variable} array not found in the script`);
    return match[1].trim().split(/\s+/);
  };
  assert.deepEqual(listed("REQUIRED_NAMES"), [...REQUIRED_NAMES]);
  assert.deepEqual(listed("OPTIONAL_NAMES"), [...OPTIONAL_NAMES]);

  assert.notEqual(statSync(SCRIPT).mode & 0o111, 0, "the script must be executable");
});

function stepBlock(workflow: string, stepName: string): string {
  const stepLines = workflow.split("\n");
  const start = stepLines.findIndex((line) => line.trim() === `- name: ${stepName}`);
  assert.ok(start >= 0, `step "${stepName}" not found`);
  const indent = (stepLines[start] ?? "").indexOf("-");
  const end = stepLines.findIndex(
    (line, index) =>
      index > start && line.trim().length > 0 && line.search(/\S/) <= indent,
  );
  return stepLines.slice(start, end < 0 ? undefined : end).join("\n");
}

function runBlocks(workflow: string): string[] {
  const workflowLines = workflow.split("\n");
  const blocks: string[] = [];
  workflowLines.forEach((line, index) => {
    const match = line.match(/^(\s*)(?:- )?run:\s*(.*)$/);
    if (!match) return;
    const indent = (match[1] ?? "").length;
    const body = [match[2] ?? ""];
    for (const next of workflowLines.slice(index + 1)) {
      if (next.trim().length > 0 && next.search(/\S/) <= indent) break;
      body.push(next);
    }
    blocks.push(body.join("\n"));
  });
  return blocks;
}

test("the workflow maps every secret into the write step and calls the script", () => {
  const workflow = readFileSync(WORKFLOW, "utf8");
  const step = stepBlock(workflow, "Write SecureString parameters");

  for (const name of FRONTEND_SSM_RUNTIME_SECRET_NAMES) {
    assert.ok(
      step.includes(`${name}: ` + "${{ secrets." + name + " }}"),
      `the write step must map ${name} from the GitHub secret of the same name`,
    );
  }
  assert.ok(step.includes("TARGET_ENV: ${{ inputs.environment }}"), step);
  assert.ok(step.includes("SYNC_MODE: ${{ inputs.mode }}"), step);
  assert.match(step, /run:[\s\S]*scripts\/ci\/sync-runtime-secrets\.sh "\/chapterflow\/\$\{TARGET_ENV\}"/);
});

test("the workflow offers a mode input that defaults to missing", () => {
  const workflow = readFileSync(WORKFLOW, "utf8");
  const inputStart = workflow.indexOf("\n      mode:\n");
  assert.ok(inputStart >= 0, "mode input not found");
  const inputBlock = workflow.slice(inputStart, workflow.indexOf("\npermissions:"));
  assert.match(inputBlock, /type: choice/);
  assert.match(inputBlock, /options: \[missing, overwrite\]/);
  assert.match(inputBlock, /default: missing/);
  assert.match(inputBlock, /description: ".+"/);
});

test("the workflow checks out the repository without persisted credentials before writing", () => {
  const workflow = readFileSync(WORKFLOW, "utf8");
  const checkout = workflow.indexOf("uses: actions/checkout@v7");
  assert.ok(checkout >= 0, "checkout step not found");
  assert.ok(checkout < workflow.indexOf("- name: Write SecureString parameters"));
  assert.match(
    workflow.slice(checkout, workflow.indexOf("- name:", checkout)),
    /persist-credentials: false/,
  );
});

test("no run block in the workflow contains a GitHub expression", () => {
  const workflow = readFileSync(WORKFLOW, "utf8");
  const blocks = runBlocks(workflow);
  assert.ok(blocks.length > 0, "no run block found");
  for (const block of blocks) {
    assert.ok(!block.includes("${{"), `run block contains a GitHub expression:\n${block}`);
  }
});
