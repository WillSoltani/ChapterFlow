/**
 * Public client interface used by every agent.
 *
 * Now thin: delegates to the provider router. Agents call `callClaude(opts)`
 * (kept for legacy naming) which dispatches to whichever provider is active —
 * Anthropic CLI (default), Anthropic API, or OpenAI API — based on env vars.
 *
 * See [src/providers/router.ts](src/providers/router.ts) for selection logic
 * and [README.md](README.md) for mass-production configuration.
 */

import { CallOptions, CallResult } from "./providers/types.js";
import { callModel, pingProvider } from "./providers/router.js";

// Re-export so existing imports `import { AgentTier, ... } from "./claudeClient"` keep working.
export type { AgentTier, CallOptions, CallResult, ProviderName } from "./providers/types.js";

/** Single-call wrapper. Provider is resolved per call from env or override.
 *  Same name kept for legacy callers; underneath it routes through any provider. */
export async function callClaude<T = string>(opts: CallOptions): Promise<CallResult<T>> {
  return callModel<T>(opts);
}

/** Ping whatever provider is active. Used by `cli.ts ping`. */
export async function pingClaude(): Promise<{ ok: boolean; provider: string; model: string; message: string }> {
  return pingProvider();
}

// Legacy export — some files reference MODEL_FOR_TIER. Keep an empty stub
// so old imports don't break, with a clear pointer to the new home.
export const MODEL_FOR_TIER: Record<string, string> = {
  // Models are now resolved per-tier via env vars and provider defaults.
  // See src/providers/router.ts → resolveModel.
};
