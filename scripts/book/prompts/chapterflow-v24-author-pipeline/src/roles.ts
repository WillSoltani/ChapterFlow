/**
 * Role registry (WS-3/WS-4). Reads roles/ROLE-DEFINITIONS.json — the single source of
 * truth for the pipeline's operator-driven roles. The pipeline EMITS each role's persona
 * (the fanout card / review packet) and a one-line reasoning/verbosity HINT header so a
 * Codex/GPT operator runs every subagent with the right depth (writer/reviewer = high
 * reasoning; orchestrator/publish = minimal). The pipeline is no-API: it recommends; the
 * operator applies the actual GPT reasoning-effort/verbosity per session. `promptPath`
 * points to the canonical prompt — nothing is duplicated here.
 */

import { readFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url)); // .../src
const ROLE_DEFINITIONS_PATH = resolve(__dirname, "../roles/ROLE-DEFINITIONS.json");

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";
export type Verbosity = "low" | "medium" | "high";

export type RoleDefinition = {
  roleId: string;
  title: string;
  reasoningEffort: ReasoningEffort;
  verbosity: Verbosity;
  modelHint: string;
  boundaries: string[];
  promptPath: string;
};

let cache: RoleDefinition[] | null = null;

export function loadRoleDefinitions(): RoleDefinition[] {
  if (cache) return cache;
  let raw: { roles?: unknown };
  try {
    raw = JSON.parse(readFileSync(ROLE_DEFINITIONS_PATH, "utf8"));
  } catch (err) {
    throw new Error(`role definitions unreadable at ${ROLE_DEFINITIONS_PATH}: ${(err as Error).message}`);
  }
  if (!Array.isArray(raw.roles)) throw new Error(`role definitions: "roles" must be an array`);
  cache = raw.roles as RoleDefinition[];
  return cache;
}

export function getRole(roleId: string): RoleDefinition | null {
  return loadRoleDefinitions().find((r) => r.roleId === roleId) ?? null;
}

/** The one-line hint the pipeline prepends to a role's dispatch prompt. Returns "" for an
 *  unknown role OR if the registry is unreadable — it's called from hot paths (the fanout
 *  card, the review packet), so a missing/malformed registry must degrade to no header, not
 *  crash the dispatch. */
export function roleHintHeader(roleId: string): string {
  let r: RoleDefinition | null = null;
  try {
    r = getRole(roleId);
  } catch {
    return "";
  }
  if (!r) return "";
  return `[ROLE: ${r.roleId} · reasoning: ${r.reasoningEffort} · verbosity: ${r.verbosity} · ${r.modelHint}]`;
}

/** Human-readable profile for the `roles` CLI command. */
export function formatRoleProfile(roleId: string): string {
  const r = getRole(roleId);
  if (!r) {
    const ids = loadRoleDefinitions().map((x) => x.roleId).join(", ");
    return `Unknown role "${roleId}". Known roles: ${ids}`;
  }
  return [
    `${r.roleId} — ${r.title}`,
    `  reasoning: ${r.reasoningEffort}   verbosity: ${r.verbosity}`,
    `  model hint: ${r.modelHint}`,
    `  prompt: ${r.promptPath}`,
    `  boundaries:`,
    ...r.boundaries.map((b) => `    - ${b}`),
  ].join("\n");
}
