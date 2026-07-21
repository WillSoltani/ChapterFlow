import type { AgentTier, CallOptions, Provider, ProviderRawResult } from "./types.js";
import { defaultModelForProviderName } from "./router.js";
import { legacyRouteDisabled } from "../runtime/legacyRouteInventory.js";

/** Compatibility export only. Direct OpenAI SDK execution is removed. */
export const OpenAiApiProvider: Provider = Object.freeze({
  name: "openai-api",
  defaultModelForTier(tier: AgentTier): string {
    return defaultModelForProviderName("openai-api", tier);
  },
  isConfigured(): boolean {
    return false;
  },
  async call(_opts: CallOptions & { model: string }): Promise<ProviderRawResult> {
    throw legacyRouteDisabled("providers.OpenAiApiProvider.call");
  },
});
