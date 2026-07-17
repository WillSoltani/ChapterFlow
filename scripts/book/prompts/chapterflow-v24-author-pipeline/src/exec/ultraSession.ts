/**
 * WP-E00 interface freeze / WP-E21 implementation — `ultraSession`: an
 * envelope-proven `codex exec` session at GPT-5.6 Sol with reasoning effort
 * "ultra", for the D7 operational reviewer and the canonical-evaluator
 * chapter-diagnostic workers.
 *
 * POLICY (owner assignment, docs/v25/CLAUDE_FABLE_5_ULTRACODE_V25_EVALUATOR_
 * IMPLEMENTATION_ORCHESTRATOR_PROMPT.md): D7 must route to GPT-5.6 Sol @ Ultra
 * through the real model-routing and execution envelope, and receipts/ledgers
 * must PROVE the selected route. No Claude-family model may rate a book or
 * chapter.
 *
 * DESIGN (frozen in Wave 0; see the execution plan §"D7 → Sol-Ultra"):
 *  - The pipeline's frozen `EffortLevelV1`/`ReasoningEffort` union (minimal…
 *    xhigh) is deliberately NOT extended: "ultra" exists only on this scoped
 *    route, requested via the codex config override the argv layer already
 *    supports (`-c model_reasoning_effort=<v>`, codexTransportConfig.ts).
 *  - Envelope proof reuses the exported primitives (`buildIsolatedSession`,
 *    `hermeticExecArgv`, effective-context manifest persistence): the manifest
 *    records the full argv, so the sidecar itself proves the ultra override
 *    was on the spawn. Subscription OAuth is asserted; API keys refused.
 *  - Because "ultra" acceptance by the installed codex binary is statically
 *    evidenced (.codex/agents/*.toml) but not runtime-proven, every campaign
 *    MUST run `runUltraAcceptanceProbe` once before any rating spawn and
 *    fail closed if the CLI rejects the value.
 *
 * Wave-0 state: types + signatures are the frozen cross-lane contract
 * (L1/L2 consume). Implementations land in WP-E21; until then they throw
 * ULTRA_SESSION_NOT_IMPLEMENTED so no caller can silently no-op.
 */

export const ULTRA_EFFORT = "ultra" as const;

/** The single authority-approved D7/evaluator rater route (see
 *  modelPolicy.resolveD7RaterRoute(), added in WP-E21). */
export type UltraRouteV1 = {
  model: string;
  effort: typeof ULTRA_EFFORT;
};

export type UltraSessionRequestV1 = {
  /** Which rating role this session serves (primary/verification/adjudicator
   *  for evaluator workers; d7-rater/d7-adjudicator for the D7 instrument). */
  role: string;
  /** Absolute path of the rendered task prompt the worker reads. */
  promptPath: string;
  /** Optional absolute path of a JSON schema to bind via --output-schema. */
  outputSchemaPath?: string | null;
  /** Isolated working directory for the spawn (empty-cwd discipline). */
  cwd: string;
  timeoutMs: number;
  /** Stable tag folded into the session id / ledger stage label. */
  sessionTag: string;
  /** Book/run identifiers for ledger attribution. */
  bookId: string;
  runId: string;
};

export type UltraSessionResultV1 = {
  ok: boolean;
  /** The RESOLVED route actually spawned (from the effective-context manifest,
   *  not the request). */
  model: string;
  effort: string;
  sessionId: string;
  /** Absolute path + sha256 of the persisted effective-context manifest that
   *  proves argv (including the ultra override), env, and auth mode. */
  manifestPath: string;
  manifestSha256: string;
  /** Absolute path of the raw reply artifact (preserved on failure too). */
  replyPath: string | null;
  latencyMs: number;
  /** ProviderOutcomeV1 value (frozen taxonomy). */
  outcome: string;
  failure?: string;
};

/** Persisted once per campaign BEFORE any rating spawn; receipts reference its
 *  sha256. `accepted:false` fail-closes the campaign. */
export type UltraAcceptanceProbeV1 = {
  schemaVersion: "ultra-acceptance-probe-v1";
  probedAt: string;
  model: string;
  effort: typeof ULTRA_EFFORT;
  accepted: boolean;
  detail: string;
  /** Absolute path of the probe's own effective-context manifest. */
  manifestPath: string | null;
  sidecarPath: string;
  sidecarSha256: string;
};

export const ULTRA_SESSION_NOT_IMPLEMENTED =
  "ultraSession: WP-E21 implementation has not landed on this branch" as const;

export async function runUltraSession(_req: UltraSessionRequestV1): Promise<UltraSessionResultV1> {
  throw new Error(ULTRA_SESSION_NOT_IMPLEMENTED);
}

export async function runUltraAcceptanceProbe(_args: {
  route: UltraRouteV1;
  probeDir: string;
  timeoutMs?: number;
}): Promise<UltraAcceptanceProbeV1> {
  throw new Error(ULTRA_SESSION_NOT_IMPLEMENTED);
}
