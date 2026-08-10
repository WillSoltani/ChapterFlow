import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const V25_DIR = dirname(fileURLToPath(import.meta.url));
const FORBIDDEN_PROVIDER_ENV = [
  "OPENAI_API_KEY",
  "CODEX_API_KEY",
  "OPENAI_BASE_URL",
  "OPENAI_API_BASE",
  "OPENAI_ORGANIZATION",
  "OPENAI_PROJECT",
  "AZURE_OPENAI_API_KEY",
  "AZURE_OPENAI_ENDPOINT",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_BASE_URL",
  "CHAPTERFLOW_PROVIDER",
] as const;

function compareBytes(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function assertNoLiveRouteEnvironment(): void {
  const present: string[] = FORBIDDEN_PROVIDER_ENV.filter((name) => process.env[name] !== undefined);
  if (process.env.CHAPTERFLOW_ALLOW_MODEL_GEN === "1") present.push("CHAPTERFLOW_ALLOW_MODEL_GEN");
  if (process.env.CHAPTERFLOW_NO_API_CODEX_QC !== "1") {
    throw new Error("V25 runner requires CHAPTERFLOW_NO_API_CODEX_QC=1 before test discovery");
  }
  if (present.length > 0) {
    throw new Error(`V25 runner refuses live model/provider environment before test discovery: ${present.sort(compareBytes).join(", ")}`);
  }
}

function childEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CHAPTERFLOW_NO_API_CODEX_QC: "1",
    CHAPTERFLOW_ALLOW_MODEL_GEN: "0",
    CHAPTERFLOW_LEAK_GUARD: "1",
  };
}

function main(): number {
  assertNoLiveRouteEnvironment();
  const filters = process.argv.slice(2).map((filter) => filter.toLowerCase());
  const discovered = readdirSync(V25_DIR)
    .filter((name) => name.endsWith(".test.ts"))
    .sort(compareBytes);
  const selected = discovered.filter(
    (name) => filters.length === 0 || filters.some((filter) => name.toLowerCase().includes(filter)),
  );

  console.log(`V25 RUNNER discovered=${discovered.length} selected=${selected.length}`);
  console.log(`V25 RUNNER order=${JSON.stringify(selected)}`);
  if (selected.length === 0) {
    console.error(`V25 RUNNER EMPTY FILTER: ${filters.length === 0 ? "no tests/v25/*.test.ts files" : filters.join(", ")}`);
    return 1;
  }

  let failed = 0;
  for (const file of selected) {
    console.log(`\n── V25 ${file}`);
    const result = spawnSync(process.execPath, [...process.execArgv, resolve(V25_DIR, file)], {
      cwd: resolve(V25_DIR, "..", ".."),
      env: childEnvironment(),
      encoding: "utf8",
      // Per-file wall-clock ceiling. Sized against MEASURED worst-case runtime,
      // not guessed: v4-candidate-repair-application-port runs 16 required cases
      // that each stage a full candidate to disk (write, digest, atomic rename)
      // under real write-lock polling, and clocks ~262s on an idle machine —
      // 87% of the previous 300s budget, so ordinary variance tipped it into
      // SIGTERM/ETIMEDOUT roughly half the time even when run alone. 600s keeps
      // a genuine hang bounded while leaving that file ~2.3x headroom.
      // If this file grows further it should be split rather than re-raised.
      timeout: 600_000,
      maxBuffer: 32 * 1024 * 1024,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    const exitCode = result.status;
    const protocolLines = (result.stdout ?? "")
      .split("\n")
      .filter((line) => line.startsWith("V25_RESULT "));
    let protocolValid = false;
    if (protocolLines.length === 1) {
      try {
        const protocol = JSON.parse(protocolLines[0].slice("V25_RESULT ".length)) as {
          schemaVersion?: unknown;
          file?: unknown;
          requiredCases?: unknown;
          requiredBlockers?: unknown;
        };
        protocolValid = protocol.schemaVersion === "1"
          && protocol.file === file
          && typeof protocol.requiredCases === "number"
          && protocol.requiredCases > 0
          && protocol.requiredBlockers === 0;
      } catch {
        protocolValid = false;
      }
    }
    const passed = exitCode === 0
      && result.error === undefined
      && result.signal === null
      && protocolValid;
    console.log(`V25 FILE ${file} exit=${exitCode ?? "NONE"} signal=${result.signal ?? "NONE"} ${passed ? "PASS" : "FAIL"}`);
    if (!passed) {
      failed++;
      if (result.error) console.error(`V25 FILE ERROR ${file}: ${result.error.message}`);
      if (!protocolValid) console.error(`V25 FILE ERROR ${file}: missing or invalid V25_RESULT protocol`);
    }
  }

  console.log(`\nV25 RUNNER summary files=${selected.length} failed=${failed}`);
  return failed === 0 ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
  process.exitCode = 1;
}
