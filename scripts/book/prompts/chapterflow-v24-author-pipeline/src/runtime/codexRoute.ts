import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClaudeRoute } from "./claudeRoute.js";
import type { ExecutionProfile } from "./executionPolicyTypes.js";

export interface ModelProcessRoute {
  readonly id: string;
  build(profile: ExecutionProfile): Readonly<{
    command: string;
    args: readonly string[];
  }>;
  /** Optional: inspect raw stdout BEFORE schema validation; a non-null return
   *  marks the attempt FAILED with this code/message (API-side error envelopes,
   *  Task 11x). Absent = no classification, schema validation proceeds. */
  classifyStdout?(stdout: Uint8Array): { errorCode: "MODEL_PROCESS_FAILED"; message: string } | null;
  /** Optional route-supplied process env, a guarded additive channel: the
   *  gateway merges the result over the policy-built environment AFTER the
   *  env-strip and rejects any malformed name or forbidden provider key, so it
   *  can never reintroduce a stripped API key. Unused by the shipped routes
   *  today — the claude route conveys its effort tier via the `--effort` argv
   *  flag, not env (live probe 2026-07-22) — but retained as defense-in-depth
   *  for any future route that needs a non-secret env var. */
  env?(profile: ExecutionProfile): Readonly<Record<string, string>>;
  /** Optional stdout normalizer (Task 7: claude's `--output-format json`
   *  envelope is unwrapped to the inner-JSON contract the gateway validates —
   *  the same bare-object contract codex already emits). Identity when absent. */
  normalizeStdout?(stdout: Uint8Array): Uint8Array;
}

/** Route id, exported so callers (e.g. ModelGateway's model-CLI preflight) can
 *  identify "this is the real codex route" without a magic string literal. */
export const CODEX_ROUTE_ID = "codex-chatgpt-subscription-v1";

/** Task 6: parameterized (the FIXED_CODEX_MODEL/FIXED_REASONING_EFFORT consts
 *  are gone — every caller now supplies model/effort, sourced from
 *  per-role config via resolveRoleRoute()/createRouteForRoleRoute() below).
 *  Prompt never enters build(), so route cannot place prompt/source bytes in
 *  argv. Final '-' tells Codex to consume task on stdin. */
export function createCodexRoute(model: string, effort: RoleRoute["effort"]): ModelProcessRoute {
  return Object.freeze({
    id: CODEX_ROUTE_ID,
    build(profile: ExecutionProfile) {
      const sandbox = profile.mode === "READ_ONLY" ? "read-only" : "workspace-write";
      const args = [
        "exec",
        "--sandbox",
        sandbox,
        ...(profile.workDirPolicy === "ATTEMPT_ROOT" ? ["--skip-git-repo-check"] : []),
        "--ignore-user-config",
        "--ignore-rules",
        "-c",
        "project_doc_max_bytes=0",
        "-c",
        `model=${model}`,
        "-c",
        `model_reasoning_effort=${effort}`,
        "-",
      ] as const;
      return { command: "codex", args };
    },
  });
}

// ── Task 6: per-role model-routing config mechanism ─────────────────────────
//
// Route *selection* (claude vs codex, and which model/effort per pipeline
// role) lives here. Task 7 landed the claude route: selecting "claude-cli" now
// builds a real claude ModelProcessRoute (createClaudeRoute). The historical
// ClaudeRouteNotAvailableError is retained (exported) as the documented
// fail-closed contract for the pre-Task-7 window but is no longer thrown.

export interface RoleRoute {
  readonly route: "claude-cli" | "codex";
  readonly model: string;
  readonly effort: "low" | "medium" | "high" | "xhigh";
}

export interface ModelRoutingConfig {
  readonly defaultRoute: RoleRoute;
  readonly roles?: Readonly<Record<string, RoleRoute>>;
  /** Gate for the temporary gpt-5.5-as-author exception (D1). Must equal
   *  OWNER_OVERRIDE_SENTINEL for any gpt-5.5* model to validate. */
  readonly ownerOverride?: string;
}

/** Resolves the route for `role`: that role's entry when present, else
 *  `config.defaultRoute`. `role` absent (or unknown) also falls through to
 *  the default. */
export function resolveRoleRoute(config: ModelRoutingConfig, role?: string): RoleRoute {
  if (role !== undefined) {
    const roleRoute = config.roles?.[role];
    if (roleRoute !== undefined) return roleRoute;
  }
  return config.defaultRoute;
}

export const CLAUDE_ROUTE_NOT_AVAILABLE_CODE = "CLAUDE_ROUTE_NOT_AVAILABLE" as const;

/** Historical fail-closed contract for the pre-Task-7 window, when selecting
 *  "claude-cli" had to hard-fail rather than silently fall back to codex.
 *  Task 7 shipped the real claude route, so this is no longer thrown by
 *  `createRouteForRoleRoute`; it is retained (exported) as documentation of the
 *  never-silently-fall-back invariant that still governs route selection. */
export class ClaudeRouteNotAvailableError extends Error {
  readonly code = CLAUDE_ROUTE_NOT_AVAILABLE_CODE;
  constructor(role?: string) {
    super(
      `claude-cli route selected${role !== undefined ? ` for role "${role}"` : ""} but no claude route `
      + "implementation exists yet (lands in Task 7); refusing to silently fall back to codex",
    );
    this.name = "ClaudeRouteNotAvailableError";
  }
}

/** Gateway-construction route selection: dispatches a resolved RoleRoute to
 *  its ModelProcessRoute implementation by the `route` field. "claude-cli"
 *  builds the Task 7 claude route; "codex" builds the parameterized codex
 *  route. Never falls back silently across route kinds. */
export function createRouteForRoleRoute(roleRoute: RoleRoute, _role?: string): ModelProcessRoute {
  if (roleRoute.route === "claude-cli") return createClaudeRoute(roleRoute.model, roleRoute.effort);
  return createCodexRoute(roleRoute.model, roleRoute.effort);
}

const VALID_ROUTE_VALUES: ReadonlySet<string> = new Set(["claude-cli", "codex"]);
const VALID_EFFORT_VALUES: ReadonlySet<string> = new Set(["low", "medium", "high", "xhigh"]);
const GPT_55_PATTERN = /^gpt-5\.5/;
/** The one D1-approved sentinel that lets a role route gpt-5.5* through the
 *  codex fallback. Any gpt-5.5* model without BOTH route:"codex" and this
 *  exact ownerOverride value fails validation — this is the NO-GPT-5.5
 *  tripwire (standing rule; see plan D1). */
export const MODEL_ROUTING_OWNER_OVERRIDE_SENTINEL = "D1-gpt-exception-approved" as const;

export interface ModelRoutingConfigError {
  readonly path: string;
  readonly message: string;
}

export type ModelRoutingConfigValidation =
  | { readonly ok: true; readonly value: ModelRoutingConfig }
  | { readonly ok: false; readonly errors: readonly ModelRoutingConfigError[] };

function validateRoleRouteShape(value: unknown, path: string, errors: ModelRoutingConfigError[]): void {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    errors.push({ path, message: "expected a role-route object ({route, model, effort})" });
    return;
  }
  const record = value as Record<string, unknown>;
  if (!VALID_ROUTE_VALUES.has(record.route as string)) {
    errors.push({ path: `${path}/route`, message: 'expected "claude-cli" | "codex"' });
  }
  if (typeof record.model !== "string" || record.model.length === 0) {
    errors.push({ path: `${path}/model`, message: "expected a nonempty model id string" });
  }
  if (!VALID_EFFORT_VALUES.has(record.effort as string)) {
    errors.push({ path: `${path}/effort`, message: 'expected "low" | "medium" | "high" | "xhigh"' });
  }
}

/** Frozen-policy tripwire (Task 6 Step 1d): any configured route (default or
 *  per-role) whose model matches gpt-5.5* is only valid when its own route is
 *  "codex" AND config.ownerOverride is the exact approved sentinel. Encodes
 *  the standing NO-GPT-5.5 rule as a failing gate rather than a convention. */
export function checkModelRoutingTripwire(config: ModelRoutingConfig): string[] {
  const violations: string[] = [];
  const entries: Array<[string, RoleRoute]> = [
    ["defaultRoute", config.defaultRoute],
    ...Object.entries(config.roles ?? {}),
  ];
  for (const [name, roleRoute] of entries) {
    if (roleRoute === undefined || typeof roleRoute.model !== "string" || !GPT_55_PATTERN.test(roleRoute.model)) continue;
    if (roleRoute.route !== "codex" || config.ownerOverride !== MODEL_ROUTING_OWNER_OVERRIDE_SENTINEL) {
      violations.push(
        `${name}: model "${roleRoute.model}" requires route:"codex" and `
        + `ownerOverride:"${MODEL_ROUTING_OWNER_OVERRIDE_SENTINEL}" (NO-GPT-5.5 tripwire)`,
      );
    }
  }
  return violations;
}

/** Structural validation + the tripwire above, over an untyped JSON value. */
export function validateModelRoutingConfig(raw: unknown): ModelRoutingConfigValidation {
  const errors: ModelRoutingConfigError[] = [];
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: [{ path: "/", message: "expected a model-routing config object" }] };
  }
  const record = raw as Record<string, unknown>;
  validateRoleRouteShape(record.defaultRoute, "/defaultRoute", errors);
  if (record.roles !== undefined) {
    if (record.roles === null || typeof record.roles !== "object" || Array.isArray(record.roles)) {
      errors.push({ path: "/roles", message: "expected an object of role routes when present" });
    } else {
      for (const [key, value] of Object.entries(record.roles as Record<string, unknown>)) {
        validateRoleRouteShape(value, `/roles/${key}`, errors);
      }
    }
  }
  if (record.ownerOverride !== undefined && typeof record.ownerOverride !== "string") {
    errors.push({ path: "/ownerOverride", message: "expected a string when present" });
  }
  if (errors.length > 0) return { ok: false, errors };

  const config = record as unknown as ModelRoutingConfig;
  const tripwireViolations = checkModelRoutingTripwire(config);
  if (tripwireViolations.length > 0) {
    return { ok: false, errors: tripwireViolations.map((message) => ({ path: "/", message })) };
  }
  return { ok: true, value: config };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MODEL_ROUTING_CONFIG_PATH = resolve(__dirname, "../../config/model-routing.json");

/** Reads + validates config/model-routing.json (or an explicit path, for
 *  tests). Fail-closed: throws on unreadable/malformed JSON, structural
 *  violations, or a tripwire violation — never returns a partially-trusted
 *  config. */
export function loadModelRoutingConfig(configPath: string = DEFAULT_MODEL_ROUTING_CONFIG_PATH): ModelRoutingConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (err) {
    throw new Error(`model-routing config unreadable at ${configPath}: ${(err as Error).message}`);
  }
  const validated = validateModelRoutingConfig(raw);
  if (!validated.ok) {
    const detail = validated.errors.map((e) => `${e.path}: ${e.message}`).join("; ");
    throw new Error(`model-routing config invalid at ${configPath}: ${detail}`);
  }
  return validated.value;
}

/** Default production route for callers that construct a gateway without an
 *  explicit `route`: resolved from config/model-routing.json (defaultRoute),
 *  never from a source literal — the baseline-model static scan permits the
 *  literal only in this policy module and in that config file. */
export function createDefaultModelRoute(): ModelProcessRoute {
  return createRouteForRoleRoute(resolveRoleRoute(loadModelRoutingConfig()));
}
