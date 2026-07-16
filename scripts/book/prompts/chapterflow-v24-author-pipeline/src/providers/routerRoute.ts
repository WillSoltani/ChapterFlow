/**
 * Provider-router route provenance (WP-304 — close the stack-A gap).
 *
 * The provider router (`router.ts`) is the LEGACY "stack A" model transport: the
 * v23 compiler agents (`generateChapter.ts`), the model-backed categorizer, the
 * live quiz-key judge, and the old research agents reach a model through it. The
 * author-first SHIP path never does — it spawns through the hermetic codex
 * envelope (`spawnCodexAgent` → `executionEnvelope`), which already resolves
 * model+effort through `modelPolicy.resolveRoute` and writes a `RouteResultV1`
 * sidecar per spawn. This module brings the provider-router path to ENVELOPE
 * PARITY where it remains live:
 *
 *   (1) GOVERNANCE — every router call resolves its model+effort DECISION through
 *       `modelPolicy.resolveRoute` (the one typed decision table), never through
 *       the ambient `CHAPTERFLOW_*_MODEL` env surface (killed in `router.ts` /
 *       `types.ts`). The policy is the single authority; an operator's personal
 *       env can no longer silently swap the model (the exact V25-15 / rolled-back
 *       campaign confound).
 *   (2) PROVENANCE — every router call emits a `ProviderRouteResultV1` record: the
 *       policy decision + the EFFECTIVE transport (provider + model actually
 *       dispatched) + the outcome + a drift fingerprint. This closes the
 *       "Claude-side calls unledgered" gap (V25-15).
 *
 * TRANSPORT/FAMILY REALITY (enumerated per the WP stop-condition, NOT a blocker):
 * `modelPolicy`'s matrix is a codex/GPT-5.6 authority (`normalRouteMatrix()` →
 * `gpt-5.6-sol` for every role). The provider router's live no-API-surviving
 * provider is the Anthropic subscription CLI, which serves the CLAUDE family; a
 * codex model id is not a valid `claude --model` value. So the policy model is
 * DISPATCHED only when the selected provider's family matches it (the mass-
 * production `openai-api` route, where `gpt-5.6-sol` is exactly right). For a
 * family-mismatched provider the EFFECTIVE model falls to that provider's
 * deterministic in-code default (`DEFAULT_MODELS`, ambient-free) — recorded
 * honestly as `modelSource:"provider-default"`, never a silent env-driven pick.
 * This is envelope parity of GOVERNANCE + PROVENANCE, not a claim that a codex
 * model runs on the claude CLI.
 *
 * This is a minimal provenance record — NOT the codex `RouteResultV1` (which
 * asserts a `codex_exec_chatgpt_subscription` execution route it would be a lie to
 * stamp on a claude-CLI/API call) and NOT a new orchestration layer.
 */

import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, writeFileSync } from "fs";

import type { AgentRole, EffortLevelV1 } from "../contracts/executionProfile.js";
import type { ProviderOutcomeV1, TaskClassV1 } from "../contracts/routeContracts.js";
import { type ResolvedRoute, routeDriftFingerprint } from "../orchestrator/modelPolicy.js";
import type { AgentTier, ProviderName } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url)); // src/providers
const PIPELINE_ROOT = resolve(__dirname, "../.."); // chapterflow-v24-author-pipeline/

/** The three provider-router tiers map to these central roles for policy
 *  governance + provenance. Deliberately NOT `author-writer`/`author-repair`:
 *  those roles are the codex author-first SHIP path exclusively — the provider
 *  router is the legacy stack-A transport (CLI verbs / opt-in `--compiler`), so a
 *  writer-tier call records the neutral `cli-adhoc` role, never the ship-path
 *  writer. A precise caller may override via `CallOptions.role`. */
export const PROVIDER_TIER_ROLE: Record<AgentTier, AgentRole> = {
  writer: "cli-adhoc",
  researcher: "research",
  critic: "qc-reviewer",
};

/** How the EFFECTIVE dispatched model was chosen (recorded, never guessed):
 *   - `call-explicit`   — the caller pinned `opts.model` (rides above the policy).
 *   - `policy`          — the policy model, dispatched because the provider serves
 *                          that family (e.g. `gpt-5.6-sol` on `openai-api`).
 *   - `provider-default`— the provider's deterministic in-code default, because
 *                          the policy model is a different family than the provider
 *                          serves (e.g. codex policy model on the claude CLI). */
export type RouterModelSource = "call-explicit" | "policy" | "provider-default";

/** Model families the router can reconcile. `other` never matches a provider so a
 *  surprising id fails safe to the provider default rather than being dispatched. */
export type ModelFamily = "claude" | "openai" | "other";

export function modelFamilyOf(modelId: string): ModelFamily {
  if (modelId.startsWith("claude-")) return "claude";
  if (/^(?:gpt-|o[0-9])/.test(modelId)) return "openai";
  return "other";
}

export function providerModelFamily(name: ProviderName): ModelFamily {
  return name === "openai-api" ? "openai" : "claude";
}

/** True iff a provider can serve a given model id's family. Used to decide
 *  whether the codex-family policy model is dispatchable on the selected
 *  transport, or the provider default must be used instead. */
export function providerServesModel(name: ProviderName, modelId: string): boolean {
  return providerModelFamily(name) === modelFamilyOf(modelId);
}

/** The per-call provider-router route record — the RouteResult-equivalent
 *  provenance for a stack-A call. Carries BOTH the policy governance decision and
 *  the effective transport, so a family-mismatch is auditable, never silent. */
export type ProviderRouteResultV1 = {
  schema: "provider-route-result-v1";
  role: AgentRole;
  tier: AgentTier;
  taskClass: TaskClassV1;
  profileName: string;
  routePolicyVersion: string;
  /** The model the central policy resolved (governance authority). */
  policyModel: string;
  policyEffort: EffortLevelV1;
  /** Which precedence decided the policy values (call-explicit vs normal matrix). */
  routeTier: ResolvedRoute["tier"];
  /** How the EFFECTIVE dispatched model was chosen. */
  modelSource: RouterModelSource;
  effectiveProvider: ProviderName;
  effectiveModel: string;
  outcome: ProviderOutcomeV1;
  /** Metered-key transport is never reached from here (the no-API guard refuses
   *  billed providers under the ship invariant); recorded for parity with the
   *  codex sidecar's honesty about auth. */
  apiKeyPresent: boolean;
  executionRoute: string; // "provider_router:<provider>"
  driftFingerprint: string;
  createdAtIso: string;
  telemetry?: {
    stage?: string;
    runId?: string;
    bookId?: string;
    chapterId?: string;
    costCenter?: string;
  };
};

export function buildProviderRouteResult(args: {
  tier: AgentTier;
  role: AgentRole;
  resolved: ResolvedRoute;
  modelSource: RouterModelSource;
  effectiveProvider: ProviderName;
  effectiveModel: string;
  outcome: ProviderOutcomeV1;
  apiKeyPresent: boolean;
  telemetry?: ProviderRouteResultV1["telemetry"];
}): ProviderRouteResultV1 {
  const telemetry = compactTelemetry(args.telemetry);
  return {
    schema: "provider-route-result-v1",
    role: args.role,
    tier: args.tier,
    taskClass: args.resolved.taskClass,
    profileName: args.resolved.profileName,
    routePolicyVersion: args.resolved.routePolicyVersion,
    policyModel: args.resolved.model,
    policyEffort: args.resolved.effort,
    routeTier: args.resolved.tier,
    modelSource: args.modelSource,
    effectiveProvider: args.effectiveProvider,
    effectiveModel: args.effectiveModel,
    outcome: args.outcome,
    apiKeyPresent: args.apiKeyPresent,
    executionRoute: `provider_router:${args.effectiveProvider}`,
    // The drift fingerprint keys on the EFFECTIVE model (what actually ran) +
    // the policy effort/task/version + the transport in the codex fields' slots:
    // executionProfileHash="provider-router" (there is no ExecutionProfileV1 here)
    // and cliVersion=<provider> (the transport identity). A change to provider,
    // effective model, effort, task class, or policy version re-fingerprints.
    driftFingerprint: routeDriftFingerprint({
      model: args.effectiveModel,
      effort: args.resolved.effort,
      taskClass: args.resolved.taskClass,
      routePolicyVersion: args.resolved.routePolicyVersion,
      executionProfileHash: "provider-router",
      cliVersion: args.effectiveProvider,
    }),
    createdAtIso: new Date().toISOString(),
    ...(telemetry ? { telemetry } : {}),
  };
}

function compactTelemetry(t: ProviderRouteResultV1["telemetry"]): ProviderRouteResultV1["telemetry"] | undefined {
  if (!t) return undefined;
  const entries = Object.entries(t).filter(([, v]) => v !== undefined && v !== "");
  return entries.length > 0 ? (Object.fromEntries(entries) as ProviderRouteResultV1["telemetry"]) : undefined;
}

/** Destination for the per-call sidecars. Default lives UNDER the already-
 *  gitignored `logs/exec/` (generated evidence never enters the corpus). The
 *  destination-only override env cannot influence model/provider selection — it
 *  is purely where the record is written (parity with `CHAPTERFLOW_EVIDENCE_ROOT`
 *  style destination envs). */
export function providerRouteSinkDir(): string {
  const override = process.env.CHAPTERFLOW_PROVIDER_ROUTE_SINK;
  if (override && override.trim() !== "") return override;
  return resolve(PIPELINE_ROOT, "logs", "exec", "provider-router");
}

/** Persist one route record. Best-effort like the codex `persistRouteResult`: the
 *  model call already happened, so a sidecar-write failure is logged-by-returning-
 *  null, never a crash that would convert successful work into an error. */
export function persistProviderRouteResult(record: ProviderRouteResultV1, sinkDir = providerRouteSinkDir()): string | null {
  try {
    mkdirSync(sinkDir, { recursive: true });
    const ts = record.createdAtIso.replace(/[:.]/g, "").replace("T", "-").slice(0, 17);
    const safeRole = record.role.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = join(sinkDir, `${ts}-${safeRole}-${process.pid}-${routeSeq()}.provider-route.json`);
    writeFileSync(path, JSON.stringify(record, null, 2) + "\n");
    return path;
  } catch {
    return null;
  }
}

let _seq = 0;
function routeSeq(): number {
  _seq += 1;
  return _seq;
}
