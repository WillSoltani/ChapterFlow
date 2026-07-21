import type { CompilerApplicationPort } from "../app/compilerApplicationPort.js";
import { legacyRouteDisabled } from "../runtime/legacyRouteInventory.js";
import type { AutopilotDeps, AutopilotOutcome } from "./autopilot.js";

type CompilerWriteOptions = {
  maxParallel: number;
  heartbeat?: () => boolean;
  compiler?: Readonly<{
    port: CompilerApplicationPort;
    request: Omit<Parameters<CompilerApplicationPort["run"]>[0], "bookId">;
  }>;
};

export type CompilerPortBinding = NonNullable<CompilerWriteOptions["compiler"]>;

function halt(bookId: string, reason: string, category: "infra" | "content" = "content"): AutopilotOutcome {
  return { status: "halt", bookId, phase: "write", category, reason };
}

function reportOf(result: { stdout?: string; stderr?: string }): string {
  return (result.stdout || result.stderr || "").trim();
}

/**
 * Compatibility seam for retired pre-WP18 polish orchestration. `never` remains inert; mutation
 * modes fail before any verb, spawn, discovery, or filesystem access.
 */
export async function runPolishStage(
  bookId: string,
  deps: AutopilotDeps,
  maxParallel: number,
  heartbeat: () => boolean,
  ownerEnv: Record<string, string> = {},
  mode: "risk" | "never" | "always" = "risk",
): Promise<AutopilotOutcome | null> {
  void bookId;
  void deps;
  void maxParallel;
  void heartbeat;
  void ownerEnv;
  if (mode === "never") return null;
  throw legacyRouteDisabled("compilerRun.runPolishStage");
}

/** Rubric preflight remains independent from retired canonical-FS compiler repair orchestration. */
export const RUBRIC_GATE_MODE_ENV = "CHAPTERFLOW_RUBRIC_GATE";

export function rubricGateMode(env: NodeJS.ProcessEnv = process.env): "shadow" | "enforce" {
  return env[RUBRIC_GATE_MODE_ENV] === "enforce" ? "enforce" : "shadow";
}

export async function runRubricPreflight(
  bookId: string,
  deps: AutopilotDeps,
  ownerEnv: Record<string, string> = {},
  mode: "shadow" | "enforce" = rubricGateMode(),
): Promise<AutopilotOutcome | null> {
  const args = mode === "enforce" ? ["rubric-metrics", bookId, "--gate"] : ["rubric-metrics", bookId];
  const result = await deps.runVerb(args, ownerEnv);
  const report = reportOf(result);
  const summary = report.split(/\r?\n/).find((line) => line.trim().startsWith("rubric-metrics:")) ?? report.split(/\r?\n/)[0] ?? "";
  if (mode === "shadow") {
    if (result.code >= 2) deps.log(`[autopilot] compiler rubric-metrics (shadow): report errored (exit ${result.code}) — continuing, pre-flight is advisory`);
    else deps.log(`[autopilot] compiler rubric-metrics (shadow): ${summary}`);
    return null;
  }
  if (result.code === 0) {
    deps.log(`[autopilot] compiler rubric-metrics (enforce): ${summary}`);
    return null;
  }
  const category = result.code >= 2 ? "infra" : "content";
  return halt(bookId, `compiler rubric-metrics (enforce) failed (exit ${result.code}).\n${report.slice(0, 2000)}`, category);
}

/** Selected compiler entry. CandidateStore owns complete-successor locking and commit. */
export async function doCompilerWrite(bookId: string, deps: AutopilotDeps, opts: CompilerWriteOptions): Promise<AutopilotOutcome | null> {
  if (!opts.compiler) return halt(bookId, "compiler application port and explicit candidate inputs are required", "infra");
  try {
    const result = await opts.compiler.port.run({ ...opts.compiler.request, bookId });
    deps.log(`[autopilot] compiler successor staged: candidate=${result.candidateId} manifest=${result.manifestDigest}`);
    return {
      status: "ready",
      bookId,
      message: `compiler successor candidate ${result.candidateId}/${result.manifestDigest} staged; downstream review/QC required`,
    };
  } catch (error) {
    return halt(bookId, (error as Error).message, "infra");
  }
}
