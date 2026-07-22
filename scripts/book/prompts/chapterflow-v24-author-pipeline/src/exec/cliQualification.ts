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

/** CLI-agnostic qualification shape. `schema` distinguishes which CLI was
 *  probed (`codex-cli-qualification-v1` | `claude-cli-qualification-v1`); the
 *  rest is identical across routes. */
export interface CliQualificationV1 {
  schema: string;
  binPath: string;
  binSize: number;
  binMtimeMs: number;
  version: string;
  /** flag literal (as documented in the CLI's `--help`) → supported. */
  flags: Record<string, boolean>;
  probedAtIso: string;
  /** true = constructed for an injected-runner test double, NOT a real probe.
   *  Synthetic qualifications are recorded as such in every manifest. */
  synthetic: boolean;
}

/** Historical name — the qualification shape is now CLI-agnostic
 *  (`CliQualificationV1`); this alias is retained for the many codex-side
 *  consumers that import it as a field type. */
export type CodexCliQualificationV1 = CliQualificationV1;

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

/** Flags the live codex route (`codexRoute.ts`'s `build()`) actually places on
 *  `codex exec` argv — the minimal set a preflight (doctor, ModelGateway) must
 *  prove the installed CLI supports before any process is spawned. */
export const CODEX_ROUTE_REQUIRED_FLAGS: readonly string[] = ["--sandbox", "--skip-git-repo-check", "--ignore-user-config", "--ignore-rules", "-c"];

/** Every flag the claude route (`claudeRoute.ts`'s `build()`) places on the
 *  `claude -p` argv — probed and required (all are load-bearing). Live-probe
 *  spellings 2026-07-22 (`claude --help`, v2.1.197): `-p, --print`,
 *  `--output-format <format>`, `--model <model>`, `--effort <level>`,
 *  `--disallowedTools, --disallowed-tools <tools...>`, `--permission-mode <mode>`. */
export const CLAUDE_PROBED_FLAGS: readonly string[] = ["-p", "--output-format", "--model", "--effort", "--disallowedTools", "--permission-mode"];

/** Flags the live claude route actually emits — the minimal set a preflight
 *  (doctor, ModelGateway) must prove the installed `claude` supports before any
 *  spawn. Identical to CLAUDE_PROBED_FLAGS today (every probed flag is required). */
export const CLAUDE_ROUTE_REQUIRED_FLAGS: readonly string[] = CLAUDE_PROBED_FLAGS;

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

/** Parse `claude --help` for flag support. Claude's help lists options
 *  verbatim as word-bounded option tokens (`-p, --print`, `--output-format
 *  <format>`, `--disallowedTools, --disallowed-tools <tools...>`, …), so a
 *  simple word-bounded presence check per required flag is sufficient — no
 *  per-flag special cases like codex's `-c`/`--cd`. */
export function parseClaudeHelpForFlags(helpText: string): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  for (const flag of CLAUDE_PROBED_FLAGS) {
    flags[flag] = new RegExp(`(^|\\s)${flag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "m").test(helpText);
  }
  return flags;
}

const memoCache = new Map<string, CliQualificationV1>();

/** Per-CLI probe recipe: how to version/help-probe a binary and which flag
 *  parser + on-disk schema/filename its qualification uses. Lets one probe+cache
 *  core (`qualifyCli`) serve both the codex and claude routes. */
interface CliProbeSpec {
  readonly schema: string;
  readonly cacheFileName: string;
  readonly versionArgs: readonly string[];
  readonly helpArgs: readonly string[];
  readonly probedFlags: readonly string[];
  readonly parseHelp: (help: string) => Record<string, boolean>;
  readonly cliName: string;
}

const CODEX_PROBE_SPEC: CliProbeSpec = {
  schema: "codex-cli-qualification-v1",
  cacheFileName: "cli-qualification.json",
  versionArgs: ["--version"],
  helpArgs: ["exec", "--help"],
  probedFlags: PROBED_FLAGS,
  parseHelp: parseHelpForFlags,
  cliName: "codex",
};

const CLAUDE_PROBE_SPEC: CliProbeSpec = {
  schema: "claude-cli-qualification-v1",
  cacheFileName: "claude-cli-qualification.json",
  versionArgs: ["--version"],
  helpArgs: ["--help"],
  probedFlags: CLAUDE_PROBED_FLAGS,
  parseHelp: parseClaudeHelpForFlags,
  cliName: "claude",
};

function cacheKey(binPath: string, size: number, mtimeMs: number): string {
  return `${binPath}|${size}|${mtimeMs}`;
}

function diskCachePath(cacheDir: string, fileName = "cli-qualification.json"): string {
  return join(cacheDir, fileName);
}

export interface QualifyCliOpts {
  bin: string;
  cacheDir?: string;
  prober?: CliProber;
  now?: () => Date;
}

/** Qualify an installed CLI binary against a per-CLI probe recipe. Probes at
 *  most once per (path,size,mtime) per process (shared memo, keyed by binary
 *  identity so distinct binaries never collide); persists to
 *  `<cacheDir>/<spec.cacheFileName>` so an operator can inspect exactly what the
 *  envelope believes about the CLI. */
async function qualifyCli(opts: QualifyCliOpts, spec: CliProbeSpec): Promise<CliQualificationV1> {
  const prober = opts.prober ?? defaultProber;
  let size = 0;
  let mtimeMs = 0;
  try {
    const st = statSync(opts.bin);
    size = st.size;
    mtimeMs = st.mtimeMs;
  } catch {
    // bare "codex"/"claude" resolved via PATH — no stat identity; identity is version-only.
  }
  const key = cacheKey(opts.bin, size, mtimeMs);
  const memo = memoCache.get(key);
  if (memo && memo.schema === spec.schema) return memo;

  if (opts.cacheDir) {
    try {
      const disk = JSON.parse(readFileSync(diskCachePath(opts.cacheDir, spec.cacheFileName), "utf8")) as CliQualificationV1;
      if (disk.schema === spec.schema && cacheKey(disk.binPath, disk.binSize, disk.binMtimeMs) === key && !disk.synthetic) {
        memoCache.set(key, disk);
        return disk;
      }
    } catch { /* absent/corrupt cache → fresh probe */ }
  }

  let version = "";
  let helpText = "";
  try {
    version = (await prober(opts.bin, [...spec.versionArgs])).stdout.trim();
    helpText = (await prober(opts.bin, [...spec.helpArgs])).stdout;
  } catch (err) {
    throw new ExecPreflightError(`${spec.cliName} CLI qualification probe failed for "${opts.bin}": ${(err as Error).message}`);
  }
  const qual: CliQualificationV1 = {
    schema: spec.schema,
    binPath: opts.bin,
    binSize: size,
    binMtimeMs: mtimeMs,
    version,
    flags: spec.parseHelp(helpText),
    probedAtIso: (opts.now?.() ?? new Date()).toISOString(),
    synthetic: false,
  };
  memoCache.set(key, qual);
  if (opts.cacheDir) {
    try {
      mkdirSync(opts.cacheDir, { recursive: true });
      writeFileSync(diskCachePath(opts.cacheDir, spec.cacheFileName), JSON.stringify(qual, null, 2) + "\n");
    } catch { /* cache persistence is best-effort; the memo already holds it */ }
  }
  return qual;
}

/** Qualify the installed codex binary (`codex --version` + `codex exec --help`).
 *  Persists to `<cacheDir>/cli-qualification.json`. */
export function qualifyCodexCli(opts: QualifyCliOpts): Promise<CliQualificationV1> {
  return qualifyCli(opts, CODEX_PROBE_SPEC);
}

/** Qualify the installed claude binary (`claude --version` + `claude --help`).
 *  Persists to `<cacheDir>/claude-cli-qualification.json`. */
export function qualifyClaudeCli(opts: QualifyCliOpts): Promise<CliQualificationV1> {
  return qualifyCli(opts, CLAUDE_PROBE_SPEC);
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

export function assertFlagsSupported(qual: CliQualificationV1, required: readonly string[]): void {
  const missing = required.filter((f) => !qual.flags[f]);
  if (missing.length > 0) {
    throw new ExecPreflightError(
      `installed model CLI (${qual.version || qual.binPath}) lacks required flag(s) ${missing.join(", ")} — ` +
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
