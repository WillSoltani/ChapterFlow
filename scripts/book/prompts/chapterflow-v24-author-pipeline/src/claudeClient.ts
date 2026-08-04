import type { CallOptions, CallResult } from "./providers/types.js";
import { LEGACY_ROUTE_DISABLED_CODE, legacyRouteDisabled } from "./runtime/legacyRouteInventory.js";

export type { AgentTier, CallOptions, CallResult, ProviderName } from "./providers/types.js";

/** Compatibility export only. ModelGateway/ModelTaskRunner owns execution. */
export async function callClaude<T = string>(_opts: CallOptions): Promise<CallResult<T>> {
  throw legacyRouteDisabled("claudeClient.callClaude");
}

/** Stable no-call diagnostic for old CLI consumers. */
export async function pingClaude(): Promise<{ ok: boolean; provider: string; model: string; message: string }> {
  return {
    ok: false,
    provider: "legacy-disabled",
    model: "disabled",
    message: `${LEGACY_ROUTE_DISABLED_CODE}:claudeClient.pingClaude`,
  };
}

export const MODEL_FOR_TIER: Record<string, string> = Object.freeze({});
