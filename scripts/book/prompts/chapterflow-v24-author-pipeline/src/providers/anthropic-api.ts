import type { AgentTier, CallOptions, Provider, ProviderRawResult } from "./types.js";
import { defaultModelForProviderName } from "./router.js";
import { legacyRouteDisabled } from "../runtime/legacyRouteInventory.js";

export function anthropicModelOmitsSamplingFields(model: string): boolean {
  const normalized = model.toLowerCase();
  return normalized.includes("opus-4-7") || normalized.includes("opus-4.7");
}

/** Compatibility export only. Direct Anthropic SDK execution is removed. */
export const AnthropicApiProvider: Provider = Object.freeze({
  name: "anthropic-api",
  defaultModelForTier(tier: AgentTier): string {
    return defaultModelForProviderName("anthropic-api", tier);
  },
  isConfigured(): boolean {
    return false;
  },
  async call(_opts: CallOptions & { model: string }): Promise<ProviderRawResult> {
    throw legacyRouteDisabled("providers.AnthropicApiProvider.call");
  },
});
