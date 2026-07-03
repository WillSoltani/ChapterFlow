/**
 * v22 RunPolicy — one explicit cost/quality contract for generation.
 *
 * The final publish gates remain strict regardless of policy. Policies only
 * decide how much model/QC work happens before the deterministic gates make
 * the publish decision.
 */

export type RunPolicyName = "economy" | "standard" | "premium" | "publish";

export type ExampleStrategy = "fixed" | "adaptive";
export type CuratorPolicy = "never" | "tie" | "risk" | "always";
export type LineEditorPolicy = "never" | "risk" | "always";
export type MemorableLinesPolicy = "deterministic" | "model" | "model-on-weak";
export type SupportGenerationPolicy = "separate" | "batched-ready";
export type QcModePolicy = "none" | "incremental" | "full";

export type RunPolicy = {
  name: RunPolicyName;
  description: string;
  examples: {
    strategy: ExampleStrategy;
    minCandidates: number;
    maxCandidates: number;
    /** Deterministic score at or above this accepts the first candidate. */
    acceptScore: number;
    /** Score below this forces more candidates instead of curator. */
    retryScore: number;
    /** Minimum winner margin needed to skip curator when multiple candidates exist. */
    deterministicMargin: number;
    curator: CuratorPolicy;
  };
  prose: {
    voicePass: "always" | "risk";
    maxVoicePasses: number;
    lineEditor: LineEditorPolicy;
    /** Run the line editor when deterministic prose risk is at or above this. */
    lineEditorRiskThreshold: number;
  };
  support: {
    generation: SupportGenerationPolicy;
    memorableLines: MemorableLinesPolicy;
    /** Keep separate in v22.0; validators repair sections independently. */
    repair: "section-only" | "whole-pack";
  };
  qc: {
    mode: QcModePolicy;
    barBatchSize: number;
    confirm: "changed-only" | "risk" | "all";
    keyJudge: "single" | "dual-on-disagreement" | "full";
  };
  gates: {
    enforcement: "draft" | "editorial" | "publish";
    publishGateAlwaysStrict: true;
  };
};

const POLICIES: Record<RunPolicyName, RunPolicy> = {
  economy: {
    name: "economy",
    description: "Lowest token spend that still preserves strict final gates. Best for known-clean books and iteration.",
    examples: {
      strategy: "adaptive",
      minCandidates: 1,
      maxCandidates: 2,
      acceptScore: 88,
      retryScore: 72,
      deterministicMargin: 12,
      curator: "tie",
    },
    prose: {
      voicePass: "always",
      maxVoicePasses: 2,
      lineEditor: "risk",
      lineEditorRiskThreshold: 3,
    },
    support: {
      generation: "separate",
      memorableLines: "deterministic",
      repair: "section-only",
    },
    qc: {
      mode: "incremental",
      barBatchSize: 4,
      confirm: "changed-only",
      keyJudge: "dual-on-disagreement",
    },
    gates: { enforcement: "publish", publishGateAlwaysStrict: true },
  },

  standard: {
    name: "standard",
    description: "Default autonomous production policy. Adaptive examples, risk-gated polish, incremental QC.",
    examples: {
      strategy: "adaptive",
      minCandidates: 1,
      maxCandidates: 3,
      acceptScore: 86,
      retryScore: 70,
      deterministicMargin: 10,
      curator: "risk",
    },
    prose: {
      voicePass: "always",
      maxVoicePasses: 3,
      lineEditor: "risk",
      lineEditorRiskThreshold: 2,
    },
    support: {
      generation: "separate",
      memorableLines: "model-on-weak",
      repair: "section-only",
    },
    qc: {
      mode: "incremental",
      barBatchSize: 3,
      confirm: "risk",
      keyJudge: "dual-on-disagreement",
    },
    gates: { enforcement: "publish", publishGateAlwaysStrict: true },
  },

  premium: {
    name: "premium",
    description: "Maximum authoring scrutiny for thin-source, high-risk, or flagship books.",
    examples: {
      strategy: "adaptive",
      minCandidates: 2,
      maxCandidates: 3,
      acceptScore: 92,
      retryScore: 78,
      deterministicMargin: 14,
      curator: "risk",
    },
    prose: {
      voicePass: "always",
      maxVoicePasses: 3,
      lineEditor: "always",
      lineEditorRiskThreshold: 0,
    },
    support: {
      generation: "separate",
      memorableLines: "model",
      repair: "section-only",
    },
    qc: {
      mode: "full",
      barBatchSize: 2,
      confirm: "all",
      keyJudge: "full",
    },
    gates: { enforcement: "publish", publishGateAlwaysStrict: true },
  },

  publish: {
    name: "publish",
    description: "Strict final validation. Does not lower any gate or carry stale QC.",
    examples: {
      strategy: "fixed",
      minCandidates: 3,
      maxCandidates: 3,
      acceptScore: 100,
      retryScore: 100,
      deterministicMargin: 999,
      curator: "always",
    },
    prose: {
      voicePass: "always",
      maxVoicePasses: 3,
      lineEditor: "always",
      lineEditorRiskThreshold: 0,
    },
    support: {
      generation: "separate",
      memorableLines: "model",
      repair: "section-only",
    },
    qc: {
      mode: "full",
      barBatchSize: 1,
      confirm: "all",
      keyJudge: "full",
    },
    gates: { enforcement: "publish", publishGateAlwaysStrict: true },
  },
};

export function runPolicy(name: RunPolicyName | undefined | null): RunPolicy {
  return POLICIES[name ?? "standard"];
}

export function isRunPolicyName(value: unknown): value is RunPolicyName {
  return value === "economy" || value === "standard" || value === "premium" || value === "publish";
}

export function parseRunPolicyName(value: unknown): RunPolicyName {
  if (value === undefined || value === null || value === false) return "standard";
  if (typeof value !== "string" || !isRunPolicyName(value)) {
    throw new Error(`Unknown --policy ${String(value)}. Use economy, standard, premium, or publish.`);
  }
  return value;
}

export function formatRunPolicy(policy: RunPolicy): string {
  return [
    `policy=${policy.name}: ${policy.description}`,
    `  examples: ${policy.examples.strategy}, ${policy.examples.minCandidates}-${policy.examples.maxCandidates} candidate(s), curator=${policy.examples.curator}`,
    `  prose: voicePassMax=${policy.prose.maxVoicePasses}, lineEditor=${policy.prose.lineEditor}`,
    `  support: memorableLines=${policy.support.memorableLines}, repair=${policy.support.repair}`,
    `  qc: ${policy.qc.mode}, barBatchSize=${policy.qc.barBatchSize}, confirm=${policy.qc.confirm}`,
    `  gates: final publish law remains strict`,
  ].join("\n");
}
