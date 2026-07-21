import type { AgentTier, CallOptions, CallResult, Provider, ProviderName } from "./types.js";
import { defaultProviderName } from "./types.js";
import { LEGACY_ROUTE_DISABLED_CODE, legacyRouteDisabled } from "../runtime/legacyRouteInventory.js";

const DEFAULT_MODELS: Readonly<Record<ProviderName, Readonly<Record<AgentTier, string>>>> = Object.freeze({
  "anthropic-cli": Object.freeze({ writer: "claude-opus-4-7", researcher: "claude-sonnet-4-6", critic: "claude-haiku-4-5-20251001" }),
  "anthropic-api": Object.freeze({ writer: "claude-sonnet-4-6", researcher: "claude-sonnet-4-6", critic: "claude-haiku-4-5-20251001" }),
  "openai-api": Object.freeze({ writer: "gpt-4o", researcher: "gpt-4o-mini", critic: "gpt-4o-mini" }),
});

/** Pure compatibility helper. Legacy ambient provider selection is removed. */
export function resolveProviderName(opts: Pick<CallOptions, "provider">): ProviderName {
  return opts.provider ?? defaultProviderName();
}

/** Provider acquisition is permanently disabled; ModelGateway owns execution. */
export async function selectProvider(_opts: CallOptions): Promise<Provider> {
  throw legacyRouteDisabled("providers.selectProvider");
}

/** Pure compatibility helper. No environment-based model selection remains. */
export function resolveModel(opts: CallOptions, provider: Provider): string {
  return opts.model ?? provider.defaultModelForTier(opts.tier);
}

/** Legacy direct model route. ModelGateway/ModelTaskRunner is required. */
export async function callModel<T = string>(_opts: CallOptions): Promise<CallResult<T>> {
  throw legacyRouteDisabled("providers.callModel");
}

/** Stable no-call diagnostic for old ping consumers. */
export async function pingProvider(): Promise<{ ok: boolean; provider: ProviderName; model: string; message: string }> {
  return {
    ok: false,
    provider: defaultProviderName(),
    model: "disabled",
    message: `${LEGACY_ROUTE_DISABLED_CODE}:providers.pingProvider`,
  };
}

export function defaultModelForProviderName(provider: ProviderName, tier: AgentTier): string {
  return DEFAULT_MODELS[provider][tier];
}
