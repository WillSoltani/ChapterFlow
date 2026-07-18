/**
 * Codex CLI qualification (IMP-00 items 5, 11) — prove the INSTALLED binary
 * supports every flag a hermetic profile depends on BEFORE any model work.
 *
 * The probe is `codex --version` + `codex exec --help` (no model call, no
 * network beyond what the binary itself does for --help: nothing). Results are
 * cached in-memory and on disk keyed by (binPath, size, mtime, version) so a
 * CLI upgrade re-qualifies automatically — a version change is exactly the
 * drift moment the plan says must not pass silently (F-024).
 *
 * Fail-closed rule: a required flag that is absent from the installed CLI is a
 * `policy_preflight_failure` BEFORE process creation. We never "run anyway
 * without isolation" — that is the pre-IMP-00 world.
 */

import { execFile } from "child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";

export type CodexCliQualificationV1 = {
  schema: "codex-cli-qualification-v1";
  binPath: string;
  binSize: number;
  binMtimeMs: number;
  version: string;
  /** flag literal (as documented in `codex exec --help`) → supported. */
  flags: Record<string, boolean>;
  probedAtIso: string;
  /** true = constructed for an injected-runner test double, NOT a real probe.
   *  Synthetic qualifications are recorded as such in every manifest. */
  synthetic: boolean;
};

/** Every flag the v1 envelope can emit. Profiles declare which subset they
 *  REQUIRE; the rest are recorded capabilities (e.g. --output-schema is needed
 *  by IMP-01's structured-output spike, probed now, required later). */
export const PROBED_FLAGS: readonly string[] = [
  "--sandbox",
  "--skip-git-repo-check",
  "-c",
  "--add-dir",
  "--ignore-user-config",
  "--ignore-rules",
  "--output-last-message",
  "--output-schema",
  "--json",
  "--ephemeral",
  "--cd",
];

export type CliProber = (bin: string, args: string[]) => Promise<{ stdout: string; stderr: string }>;

const defaultProber: CliProber = (bin, args) =>
  new Promise((resolvePromise, rejectPromise) => {
    execFile(bin, args, { timeout: 15_000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) rejectPromise(err);
      else resolvePromise({ stdout: String(stdout), stderr: String(stderr) });
    });
  });

/** Parse `codex exec --help` for flag support. A flag counts as supported when
 *  it appears as a word-bounded option token in the help text. `-c` is special:
 *  the help renders it as `-c, --config`. */
export function parseHelpForFlags(helpText: string): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  for (const flag of PROBED_FLAGS) {
    if (flag === "-c") {
      flags[flag] = /-c,\s*--config\b/.test(helpText);
    } else if (flag === "--cd") {
      flags[flag] = /-C,\s*--cd\b/.test(helpText) || /(^|\s)--cd\b/.test(helpText);
    } else {
      flags[flag] = new RegExp(`(^|\\s)${flag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "m").test(helpText);
    }
  }
  return flags;
}

const memoCache = new Map<string, CodexCliQualificationV1>();

function cacheKey(binPath: string, size: number, mtimeMs: number): string {
  return `${binPath}|${size}|${mtimeMs}`;
}

function diskCachePath(cacheDir: string): string {
  return join(cacheDir, "cli-qualification.json");
}

/** Qualify the installed codex binary. Probes at most once per (path,size,mtime)
 *  per process; persists to `<cacheDir>/cli-qualification.json` so an operator
 *  can inspect exactly what the envelope believes about the CLI. */
export async function qualifyCodexCli(opts: {
  bin: string;
  cacheDir?: string;
  prober?: CliProber;
  now?: () => Date;
}): Promise<CodexCliQualificationV1> {
  const prober = opts.prober ?? defaultProber;
  let size = 0;
  let mtimeMs = 0;
  try {
    const st = statSync(opts.bin);
    size = st.size;
    mtimeMs = st.mtimeMs;
  } catch {
    // bare "codex" resolved via PATH — no stat identity; identity is version-only.
  }
  const key = cacheKey(opts.bin, size, mtimeMs);
  const memo = memoCache.get(key);
  if (memo) return memo;

  if (opts.cacheDir) {
    try {
      const disk = JSON.parse(readFileSync(diskCachePath(opts.cacheDir), "utf8")) as CodexCliQualificationV1;
      if (disk.schema === "codex-cli-qualification-v1" && cacheKey(disk.binPath, disk.binSize, disk.binMtimeMs) === key && !disk.synthetic) {
        memoCache.set(key, disk);
        return disk;
      }
    } catch { /* absent/corrupt cache → fresh probe */ }
  }

  let version = "";
  let helpText = "";
  try {
    version = (await prober(opts.bin, ["--version"])).stdout.trim();
    helpText = (await prober(opts.bin, ["exec", "--help"])).stdout;
  } catch (err) {
    throw new ExecPreflightError(`codex CLI qualification probe failed for "${opts.bin}": ${(err as Error).message}`);
  }
  const qual: CodexCliQualificationV1 = {
    schema: "codex-cli-qualification-v1",
    binPath: opts.bin,
    binSize: size,
    binMtimeMs: mtimeMs,
    version,
    flags: parseHelpForFlags(helpText),
    probedAtIso: (opts.now?.() ?? new Date()).toISOString(),
    synthetic: false,
  };
  memoCache.set(key, qual);
  if (opts.cacheDir) {
    try {
      mkdirSync(opts.cacheDir, { recursive: true });
      writeFileSync(diskCachePath(opts.cacheDir), JSON.stringify(qual, null, 2) + "\n");
    } catch { /* cache persistence is best-effort; the memo already holds it */ }
  }
  return qual;
}

/** Synthetic qualification for injected-runner test doubles (no real binary).
 *  Marked synthetic in every manifest so evidence can never confuse a test
 *  double's capabilities with a probed CLI. */
export function syntheticQualification(): CodexCliQualificationV1 {
  const flags: Record<string, boolean> = {};
  for (const f of PROBED_FLAGS) flags[f] = true;
  return {
    schema: "codex-cli-qualification-v1",
    binPath: "<injected-runner>",
    binSize: 0,
    binMtimeMs: 0,
    version: "synthetic",
    flags,
    probedAtIso: new Date().toISOString(),
    synthetic: true,
  };
}

/** Fail-closed preflight error — classified per the frozen route contract's
 *  `policy_preflight_failure` outcome (the spawn never happens). */
export class ExecPreflightError extends Error {
  readonly classification = "policy_preflight_failure" as const;
}

export function assertFlagsSupported(qual: CodexCliQualificationV1, required: readonly string[]): void {
  const missing = required.filter((f) => !qual.flags[f]);
  if (missing.length > 0) {
    throw new ExecPreflightError(
      `installed codex CLI (${qual.version || qual.binPath}) lacks required flag(s) ${missing.join(", ")} — ` +
      `hermetic execution cannot be proven; refusing to run with ambient context (IMP-00 fail-closed rule)`,
    );
  }
}

/** Test hook: clear the in-process qualification memo. */
export function __clearQualificationMemo(): void {
  memoCache.clear();
}

export function qualificationCachePathFor(cacheDir: string): string {
  return diskCachePath(cacheDir);
}
