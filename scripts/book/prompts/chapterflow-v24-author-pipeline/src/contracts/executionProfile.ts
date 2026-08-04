/**
 * ExecutionProfileV1 — the frozen per-role Codex execution envelope contract
 * (IMP-00, master plan §8.2 / F-019 / F-020 / gate G0).
 *
 * Why this exists: `codex exec` resolves instructions and configuration from
 * layers OUTSIDE the ChapterFlow task card — global `$CODEX_HOME/AGENTS.md` +
 * `config.toml`, project `AGENTS.md` discovered from the repo root toward cwd,
 * rules/hooks/plugins, and the inherited process environment. The rolled-back
 * SOL campaign proved this concretely: the operator's personal config.toml set
 * `model = "gpt-5.6-sol"`, so every model-UNPINNED v24 call site (chapter
 * reviewers, acceptance readers, research, evidence) silently followed the
 * personal config while the code read as "baseline". A profile makes every one
 * of those inputs explicit, hashed, and fail-closed.
 *
 * Ownership: IMP-00 owns this schema. Later packages CONSUME it (IMP-01 binds
 * attempts to profile hashes, IMP-02 layers model policy on top, IMP-08 narrows
 * reviewer workspaces). Changing this shape requires a version bump + manifest
 * regeneration + a contract-change proposal (plan §12).
 */

import { ContractDescriptor, expectFields, isNonEmptyString, isStringArray } from "./contractUtil.js";

/** Every distinct agent role in the v24 pipeline (IMP-00 item 1 inventory).
 *  A role names ONE kind of model-bearing session with one authority envelope.
 *  Threading a role through a spawn is what activates the hermetic envelope. */
export type AgentRole =
  | "research"               // autopilot doResearch: index + source sidecars (workspace-write)
  | "source-repair"          // prewrite source-sidecar repair sessions (workspace-write)
  | "source-verify"          // read-only source verification / freshness scouts
  | "source-compiler"        // compilerRun section/validate sessions (workspace-write)
  | "compiler-polish"        // polishPass targeted rewrites (workspace-write)
  | "autopilot-repair"       // gate/variety repair sessions the conductor spawns (workspace-write)
  | "autopilot-scout"        // read-only advisory scouts (shadow QC / variety / readiness reads)
  | "qc-reviewer"            // v21/v23 QC reviewers in blind isolated workspaces (read-only)
  | "author-writer"          // whole-chapter writer + regeneration (workspace-write until IMP-01)
  | "author-repair"          // surgical repair sessions (workspace-write until IMP-01/07)
  | "chapter-reviewer"       // blinded chapter direct read (read-only)
  | "book-acceptance-reader" // three-reader book acceptance (read-only)
  | "author-evidence"        // key derivation / book sweep / confirmations (read-only)
  | "shipped-control"        // shipped-book control reads (read-only, doc dir)
  | "eval-reader"            // v23 eval reader proxy (read-only)
  | "eval-book"              // v23 eval book proxy (read-only)
  | "bakeoff-candidate"      // isolated bakeoff candidate writers
  | "bakeoff-judge"          // bakeoff blind judges (read-only)
  | "bakeoff-aux"            // bakeoff auxiliary sessions (research/source-repair/preflight)
  | "cli-adhoc";             // operator-invoked one-off verbs via cli.ts

export const AGENT_ROLES: readonly AgentRole[] = [
  "research", "source-repair", "source-verify", "source-compiler", "compiler-polish",
  "autopilot-repair", "autopilot-scout", "qc-reviewer", "author-writer", "author-repair",
  "chapter-reviewer", "book-acceptance-reader", "author-evidence", "shipped-control",
  "eval-reader", "eval-book", "bakeoff-candidate", "bakeoff-judge", "bakeoff-aux", "cli-adhoc",
];

export type CodexSandboxV1 = "read-only" | "workspace-write" | "danger-full-access";

/** Repo-local effort union — deliberately EXCLUDES API-only `max` (plan §4.3:
 *  never assume an API concept is available through the local CLI route). */
export type EffortLevelV1 = "minimal" | "low" | "medium" | "high" | "xhigh";

/** Where the agent's working directory comes from. v1 records the TRUTH of the
 *  current architecture rather than pretending: writer/repair still run at the
 *  pipeline root with workspace-write (narrowing them is IMP-01's package);
 *  reviewer isolation into built workspaces is IMP-08's. "isolated-workspace"
 *  is the mechanism this package ships for those packages to adopt. */
export type WorkingDirPolicyV1 =
  | "pipeline-root"        // legacy: full pipeline tree visible (recorded, to be narrowed)
  | "document-dir"         // cwd = the rendered document's own directory
  | "caller-cwd"           // caller-supplied cwd, recorded verbatim in the manifest
  | "isolated-workspace";  // roleWorkspace-built temp dir containing ONLY approved files

export type ExecutionProfileV1 = {
  schema: "execution-profile-v1";
  profileVersion: 1;
  role: AgentRole;
  workingDir: WorkingDirPolicyV1;
  /** v1 permits exactly one CODEX_HOME policy: a per-spawn temp home holding the
   *  copied auth material and NOTHING else (no personal config/AGENTS.md/rules). */
  codexHome: "isolated-auth-only";
  /** `--ignore-user-config`: `$CODEX_HOME/config.toml` must never load. */
  ignoreUserConfig: true;
  /** `--ignore-rules`: user/project execpolicy `.rules` files must never load. */
  ignoreRules: true;
  /** `-c project_doc_max_bytes=0`: project AGENTS.md discovery is neutralized.
   *  The discovered chain is still HASHED into the manifest as evidence. */
  neutralizeProjectDocs: boolean;
  /** Process-env names allowed through to the child (everything else dropped —
   *  the pre-IMP-00 spawn spread the ENTIRE parent environment). */
  envAllowlist: readonly string[];
  /** Sandboxes a call site may request for this role; anything else fails closed. */
  allowedSandboxes: readonly CodexSandboxV1[];
  /** Explicit model — NO ambient inheritance. Baseline-preserving values only;
   *  IMP-02's central policy supersedes these defaults (it overrides per task). */
  defaultModel: string;
  defaultReasoningEffort: EffortLevelV1;
  /** v1 output protocol: plain text stdout + authoritative `-o` last-message
   *  file. JSONL event adoption is IMP-10's evidence package. */
  outputMode: "text";
  captureLastMessage: true;
  /** CLI flags this profile cannot run without (qualification fails closed). */
  requiredCliFlags: readonly string[];
  cleanup: "always";
};

export function validateExecutionProfile(p: unknown): string[] {
  const errors: string[] = [];
  if (p === null || typeof p !== "object") return ["profile: not an object"];
  const v = p as Record<string, unknown>;
  expectFields(v, [
    "schema", "profileVersion", "role", "workingDir", "codexHome", "ignoreUserConfig",
    "ignoreRules", "neutralizeProjectDocs", "envAllowlist", "allowedSandboxes",
    "defaultModel", "defaultReasoningEffort", "outputMode", "captureLastMessage",
    "requiredCliFlags", "cleanup",
  ], errors, "profile");
  if (v.schema !== "execution-profile-v1") errors.push(`profile: schema must be "execution-profile-v1"`);
  if (v.profileVersion !== 1) errors.push("profile: profileVersion must be 1");
  if (!AGENT_ROLES.includes(v.role as AgentRole)) errors.push(`profile: unknown role "${String(v.role)}"`);
  if (!["pipeline-root", "document-dir", "caller-cwd", "isolated-workspace"].includes(v.workingDir as string)) {
    errors.push(`profile: unknown workingDir "${String(v.workingDir)}"`);
  }
  if (v.codexHome !== "isolated-auth-only") errors.push("profile: codexHome must be isolated-auth-only");
  if (v.ignoreUserConfig !== true) errors.push("profile: ignoreUserConfig must be true");
  if (v.ignoreRules !== true) errors.push("profile: ignoreRules must be true");
  if (typeof v.neutralizeProjectDocs !== "boolean") errors.push("profile: neutralizeProjectDocs must be boolean");
  if (!isStringArray(v.envAllowlist)) errors.push("profile: envAllowlist must be string[]");
  if (!isStringArray(v.allowedSandboxes) || (v.allowedSandboxes as string[]).length === 0) {
    errors.push("profile: allowedSandboxes must be a non-empty string[]");
  } else if ((v.allowedSandboxes as string[]).includes("danger-full-access")) {
    errors.push("profile: danger-full-access is never an allowed production sandbox");
  }
  if (!isNonEmptyString(v.defaultModel)) errors.push("profile: defaultModel must be an explicit non-empty string (no ambient inheritance)");
  if (!["minimal", "low", "medium", "high", "xhigh"].includes(v.defaultReasoningEffort as string)) {
    errors.push(`profile: unknown defaultReasoningEffort "${String(v.defaultReasoningEffort)}"`);
  }
  if (v.outputMode !== "text") errors.push("profile: outputMode must be \"text\" in v1");
  if (v.captureLastMessage !== true) errors.push("profile: captureLastMessage must be true");
  if (!isStringArray(v.requiredCliFlags)) errors.push("profile: requiredCliFlags must be string[]");
  if (v.cleanup !== "always") errors.push("profile: cleanup must be \"always\"");
  return errors;
}

export const EXECUTION_PROFILE_CONTRACT: ContractDescriptor = {
  name: "execution-profile",
  version: 1,
  ownerPrompt: "IMP-00",
  description: "Per-role hermetic Codex execution envelope: working-dir policy, isolated CODEX_HOME, instruction neutralization, env allowlist, sandbox bounds, explicit model/effort, output protocol, CLI requirements, cleanup.",
  fields: {
    schema: "\"execution-profile-v1\"",
    profileVersion: "1",
    role: "research|source-repair|source-verify|source-compiler|compiler-polish|autopilot-repair|autopilot-scout|qc-reviewer|author-writer|author-repair|chapter-reviewer|book-acceptance-reader|author-evidence|shipped-control|eval-reader|eval-book|bakeoff-candidate|bakeoff-judge|bakeoff-aux|cli-adhoc",
    workingDir: "\"pipeline-root\"|\"document-dir\"|\"caller-cwd\"|\"isolated-workspace\"",
    codexHome: "\"isolated-auth-only\"",
    ignoreUserConfig: "true",
    ignoreRules: "true",
    neutralizeProjectDocs: "boolean",
    envAllowlist: "string[]",
    allowedSandboxes: "(\"read-only\"|\"workspace-write\")[]",
    defaultModel: "string (explicit; no ambient)",
    defaultReasoningEffort: "\"minimal\"|\"low\"|\"medium\"|\"high\"|\"xhigh\"",
    outputMode: "\"text\"",
    captureLastMessage: "true",
    requiredCliFlags: "string[]",
    cleanup: "\"always\"",
  },
};
