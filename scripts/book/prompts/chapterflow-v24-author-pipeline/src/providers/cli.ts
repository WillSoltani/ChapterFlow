import type { AgentTier, CallOptions, Provider, ProviderRawResult } from "./types.js";
import { defaultModelForProviderName } from "./router.js";
import { legacyRouteDisabled } from "../runtime/legacyRouteInventory.js";

/** Compatibility export only. Direct provider subprocess execution is removed. */
export const ClaudeCliProvider: Provider = Object.freeze({
  name: "anthropic-cli",
  defaultModelForTier(tier: AgentTier): string {
    return defaultModelForProviderName("anthropic-cli", tier);
  },
  isConfigured(): boolean {
    return false;
  },
  async call(_opts: CallOptions & { model: string }): Promise<ProviderRawResult> {
    throw legacyRouteDisabled("providers.ClaudeCliProvider.call");
  },
});
