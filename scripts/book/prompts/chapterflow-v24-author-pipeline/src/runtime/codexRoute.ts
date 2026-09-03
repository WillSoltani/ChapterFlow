import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CLAUDE_EFFORT_TIERS, createClaudeRoute, type ClaudeEffort } from "./claudeRoute.js";
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
   *  can never reintroduce a stripped API key. The claude route uses it for
   *  CLAUDE_CODE_MAX_OUTPUT_TOKENS (its effort tier still travels via the
   *  `--effort` argv flag, live probe 2026-07-22); see createClaudeRoute for
   *  the live evidence behind that value. */
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
 *  argv. Final '-' tells Codex to consume task on stdin.
 *
 *  The effort tier vocabulary is claudeRoute's (R-227) and is passed through
 *  verbatim as `model_reasoning_effort`; only the claude route's tiers have
 *  been live-probed, so a codex-routed config naming a tier codex rejects
 *  fails at the CLI rather than being silently rewritten. */
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

/** The pipeline roles a task may declare. Closed set: `model-routing.json`
 *  may key `roles` only by these (R-218 — a typo'd key used to be accepted and
 *  then silently ignored at resolve time), and a ModelTask may carry only
 *  these as its `role`. */
export const PIPELINE_ROLES = Object.freeze(["research", "author", "repair", "review", "qc"] as const);

export type PipelineRole = (typeof PIPELINE_ROLES)[number];

export function isPipelineRole(role: unknown): role is PipelineRole {
  return typeof role === "string" && (PIPELINE_ROLES as readonly string[]).includes(role);
}

export interface RoleRoute {
  readonly route: "claude-cli" | "codex";
  readonly model: string;
  /** R-227: the tier vocabulary is claudeRoute's, not a second private copy. */
  readonly effort: ClaudeEffort;
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
export function resolveRoleRoute(config: ModelRoutingConfig, role?: PipelineRole | string): RoleRoute {
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
 *  route. Never falls back silently across route kinds.
 *
 *  R-205: the former `_role` parameter was accepted and discarded — a false
 *  affordance suggesting the role reached the built route. The role now
 *  travels on the ModelTask and is used by `ModelRouteSelector` below to pick
 *  WHICH RoleRoute is passed in here; it deliberately does not enter the route
 *  id, which keys the gateway's per-route CLI preflight table. */
export function createRouteForRoleRoute(roleRoute: RoleRoute): ModelProcessRoute {
  if (roleRoute.route === "claude-cli") return createClaudeRoute(roleRoute.model, roleRoute.effort);
  return createCodexRoute(roleRoute.model, roleRoute.effort);
}

const VALID_ROUTE_VALUES: ReadonlySet<string> = new Set(["claude-cli", "codex"]);
const VALID_EFFORT_VALUES: ReadonlySet<string> = new Set<string>(CLAUDE_EFFORT_TIERS);
const VALID_ROLE_KEYS: ReadonlySet<string> = new Set<string>(PIPELINE_ROLES);
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
    errors.push({ path: `${path}/effort`, message: `expected one of ${CLAUDE_EFFORT_TIERS.join(" | ")}` });
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
        // R-218: an unknown key is a config defect, not a no-op. Before this,
        // `roles.reviw` validated and then resolved to defaultRoute forever.
        if (!VALID_ROLE_KEYS.has(key)) {
          errors.push({ path: `/roles/${key}`, message: `unknown pipeline role; expected one of ${PIPELINE_ROLES.join(" | ")}` });
        }
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

/** Same load, plus a sha256 of the exact file bytes the config came from, so a
 *  run can journal WHICH routing config produced it (R-207). */
export function loadModelRoutingConfigWithDigest(
  configPath: string = DEFAULT_MODEL_ROUTING_CONFIG_PATH,
): Readonly<{ config: ModelRoutingConfig; digest: string }> {
  let bytes: Buffer;
  try {
    bytes = readFileSync(configPath);
  } catch (err) {
    throw new Error(`model-routing config unreadable at ${configPath}: ${(err as Error).message}`);
  }
  const digest = createHash("sha256").update(bytes).digest("hex");
  return Object.freeze({ config: loadModelRoutingConfig(configPath), digest });
}

/** What the gateway learns when it asks for a task's route: the built process
 *  route AND the routing decision behind it, so the attempt can be attributed
 *  and reproduced (R-207). `roleRoute` is absent only for a directly-injected
 *  route (tests, ad-hoc wiring) that came from no config at all. */
export interface RouteSelection {
  readonly route: ModelProcessRoute;
  readonly roleRoute?: RoleRoute;
  readonly role?: PipelineRole;
  readonly configDigest?: string;
}

export interface ModelRouteSelector {
  /** Resolves the route for a task's role. An unknown role is NOT silently
   *  downgraded to the default here — the gateway rejects it before this is
   *  reached; `undefined` legitimately means "no role declared". */
  select(role?: PipelineRole): RouteSelection;
}

/** Per-role route selection over one validated config. Routes are built once
 *  per role and reused, so the gateway's per-route CLI preflight cache is hit
 *  once per route id per process, exactly as before. */
export function createModelRouteSelector(config: ModelRoutingConfig, configDigest?: string): ModelRouteSelector {
  const cache = new Map<string, RouteSelection>();
  return Object.freeze({
    select(role?: PipelineRole): RouteSelection {
      const key = role ?? "";
      const cached = cache.get(key);
      if (cached !== undefined) return cached;
      const roleRoute = resolveRoleRoute(config, role);
      const selection: RouteSelection = Object.freeze({
        route: createRouteForRoleRoute(roleRoute),
        roleRoute,
        ...(role === undefined ? {} : { role }),
        ...(configDigest === undefined ? {} : { configDigest }),
      });
      cache.set(key, selection);
      return selection;
    },
  });
}

/** Default production selector for callers that construct a gateway without an
 *  explicit route: resolved from config/model-routing.json, never from a source
 *  literal — the baseline-model static scan permits the literal only in this
 *  policy module and in that config file. */
export function createDefaultModelRouteSelector(): ModelRouteSelector {
  const loaded = loadModelRoutingConfigWithDigest();
  return createModelRouteSelector(loaded.config, loaded.digest);
}

// `createDefaultModelRoute()` (a single defaultRoute-only route) used to live
// here as the gateway's fallback. Per-role selection replaced its last caller,
// and an exported-but-unused route factory is the same false affordance R-205
// removed from createRouteForRoleRoute, so it is gone rather than retained.
