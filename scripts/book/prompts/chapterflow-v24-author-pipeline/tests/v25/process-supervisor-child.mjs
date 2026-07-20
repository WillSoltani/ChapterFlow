import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const helperPath = fileURLToPath(import.meta.url);
const mode = process.argv[2];

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    process.stdin.once("end", () => resolve(Buffer.concat(chunks)));
    process.stdin.once("error", reject);
  });
}

function linger() {
  setInterval(() => {}, 1_000);
}

function spawnDescendant() {
  return spawn(process.execPath, [helperPath, "linger"], {
    detached: false,
    shell: false,
    stdio: "ignore",
  });
}

if (mode === "echo") {
  const stdin = await readStdin();
  process.stdout.write(`${JSON.stringify({
    argv: process.argv.slice(2),
    cwd: process.cwd(),
    stdinBase64: stdin.toString("base64"),
    providerEnvironment: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? null,
      CODEX_API_KEY: process.env.CODEX_API_KEY ?? null,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? null,
      CHAPTERFLOW_PROVIDER: process.env.CHAPTERFLOW_PROVIDER ?? null,
    },
  })}\n`);
} else if (mode === "linger") {
  linger();
} else if (mode === "tree-timeout" || mode === "tree-cancel") {
  const descendant = spawnDescendant();
  process.stdout.write(`DESCENDANT_PID=${descendant.pid}\n`);
  linger();
} else if (mode === "tree-stdout-overflow") {
  const descendant = spawnDescendant();
  process.stderr.write(`DESCENDANT_PID=${descendant.pid}\n`);
  process.stdout.write(Buffer.alloc(256 * 1024, 120));
  linger();
} else if (mode === "tree-stderr-overflow") {
  const descendant = spawnDescendant();
  process.stdout.write(`DESCENDANT_PID=${descendant.pid}\n`);
  process.stderr.write(Buffer.alloc(256 * 1024, 121));
  linger();
} else if (mode === "tree-root-exit") {
  const descendant = spawnDescendant();
  process.stdout.write(`DESCENDANT_PID=${descendant.pid}\n`, () => process.exit(0));
} else {
  process.stderr.write("UNKNOWN_SYNTHETIC_MODE\n");
  process.exitCode = 2;
}
