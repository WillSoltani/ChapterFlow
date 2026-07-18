/**
 * IMP-07 — typed transactional repair (F-010/F-011/F-020/F-021).
 *
 * Surgical and section repairs no longer return a whole chapter for the
 * conductor to splice: the repair agent returns a TYPED PATCH (the frozen
 * chapter-patch-v1 contract) pinned to the exact base bytes and source-plan
 * hash, and THIS module makes the scope enforceable in code:
 *
 *  - an explicit per-route PATH ALLOWLIST (leaf-only, replacement-only — there
 *    is no insert/delete operation, so array-index drift is structurally
 *    impossible and "identity change" simply has no allowlisted path);
 *  - deterministic route classification over structured findings, escalating
 *    on ambiguity or causal/thesis/architecture/source-plan territory instead
 *    of silently widening a patch;
 *  - in-memory apply with base-hash, plan-hash, old-value-hash, type, bounds,
 *    duplicate/overlap, no-op, and operation-count verification — a failed or
 *    stale patch rejects; it is never rebased;
 *  - a non-scope drift proof: every leaf OUTSIDE the touched paths must hash
 *    byte-identical before/after (byte equality is the v1 standard — an
 *    in-memory object apply has no formatting drift to excuse; no field on the
 *    patchable surface needs semantic-hash tolerance, documented here per
 *    instruction 11);
 *  - the named dependency-closure checks the validation battery must cover for
 *    a given touched set (the lane runs the FULL battery — gate composite,
 *    rubric preflight, write contract, plan-mutation scan, register advisories —
 *    so the closure is satisfied by construction; the names exist so logs and
 *    reports state WHAT the battery covered, not to skip anything).
 *
 * The conductor (authorRepair) owns spawn/validate/commit; this module is pure.
 */

import type { ChapterV21 } from "../types.js";
import type { SourceUsePlanV1 } from "../contracts/sourceUsePlan.js";
import { sourceUsePlanHash } from "../contracts/sourceUsePlan.js";
import {
  validateChapterPatch,
  validateRepairFinding,
  type ChapterPatchV1,
  type RepairFindingV1,
  type RepairRouteV1,
} from "../contracts/repairContracts.js";
import { sha256Hex } from "../contracts/contractUtil.js";

/** Regeneration disguised as a pile of patch operations is rejected outright. */
export const MAX_PATCH_OPERATIONS = 12;

/** Sentinel plan hash for legacy books with no compiler-owned plan — the patch
 *  must still STATE its lineage; an empty/missing hash never passes. */
export const LEGACY_NO_PLAN_HASH = "legacy-no-plan";

/** Minimum old-value hash prefix the conductor will verify (the card renders
 *  16-hex prefixes for the agent to copy; the conductor recomputes the full
 *  hash from its OWN canonical value, so the prefix only pins which value the
 *  agent saw — the whole-base hash pins the bytes). */
export const MIN_OLD_VALUE_HASH_PREFIX = 16;

// ── path allowlists (leaf-only; replacement-only) ─────────────────────────────

/** Isolated-leaf surface: reader-facing content fields with no structural or
 *  identity role. NOTE what is absent — every id (chapterId, questionId,
 *  exampleId, cardId), all source metadata (sourceAnchorId(s),
 *  keyEvidenceAnchorIds), planSpec, tags, blooms/depth levels,
 *  passingScorePercent, authoring, experiencePlan, title, number,
 *  schemaVersion: none of these has a patchable path on ANY route. */
export const SURGICAL_PATCH_PATHS: readonly RegExp[] = [
  /^quiz\.questions\[\d+\]\.(?:prompt|explanation)$/,
  /^quiz\.questions\[\d+\]\.choices\[\d+\]$/,
  /^quiz\.questions\[\d+\]\.correctIndex$/,
  /^examples\[\d+\]\.(?:scenario|whatToDo|whyItMatters|title)$/,
  /^memorableLines\[\d+\]\.(?:text|why)$/,
  /^reviewCards\[\d+\]\.(?:front|back)$/,
  /^keyTakeaway$/,
  /^tryThisNow$/,
  /^implementationPlan\.(?:coreSkill|twentyFourHourChallenge|weeklyPractice)$/,
  /^implementationPlan\.ifThenPlans\[\d+\]\.(?:context|plan)$/,
];

/** Linked-section surface: the surgical surface plus the prose tiers a
 *  section-level defect legitimately spans. */
export const SECTION_PATCH_PATHS: readonly RegExp[] = [
  ...SURGICAL_PATCH_PATHS,
  /^hook$/,
  /^counterintuition$/,
  /^breakdown\.(?:fastRead|deepRead|fullRead)$/,
];

export function allowlistForRoute(route: "surgical" | "section"): readonly RegExp[] {
  return route === "surgical" ? SURGICAL_PATCH_PATHS : SECTION_PATCH_PATHS;
}

export function pathAllowed(path: string, route: "surgical" | "section"): boolean {
  return allowlistForRoute(route).some((rx) => rx.test(path));
}

// ── route classification (instruction 5) ──────────────────────────────────────

/** Scope-prefix → the minimum route tier whose allowlist can host it. Prefixes
 *  are what findings carry (the IMP-04 critics and the complaint bridge emit
 *  top-level field prefixes, not full paths). */
const SURGICAL_SCOPE_PREFIXES = new Set([
  "quiz", "examples", "memorableLines", "reviewCards", "keyTakeaway",
  "tryThisNow", "implementationPlan", "practice",
]);
const SECTION_SCOPE_PREFIXES = new Set(["hook", "counterintuition", "breakdown"]);

const ESCALATION_RX = /(?:^|[.\-_])(causal|thesis|architecture)(?:$|[.\-_])/i;

export type RouteDecision = { route: RepairRouteV1; reason: string };

/** Deterministic route selection over structured findings. The lattice only
 *  ever ESCALATES: restore (nothing actionable) → surgical → section →
 *  regeneration → upstream-source; ambiguity or source/causal/thesis/
 *  architecture territory escalates rather than widening a patch silently. */
export function classifyRepairRoute(findings: RepairFindingV1[]): RouteDecision {
  if (findings.length === 0) return { route: "restore", reason: "no actionable findings — nothing to repair" };
  for (const f of findings) {
    const errors = validateRepairFinding(f);
    if (errors.length > 0) {
      return { route: "restore", reason: `finding ${f?.findingId ?? "?"} fails the frozen contract (${errors[0]}) — refuse to route on invalid input` };
    }
  }
  const wantsUpstream = findings.find((f) => f.recommendedRoute === "upstream-source" || f.category.startsWith("source-plan"));
  if (wantsUpstream) {
    return { route: "upstream-source", reason: `finding ${wantsUpstream.findingId} requires a source-plan change — routes upstream, never through repair` };
  }
  const wantsRegen = findings.find((f) => f.recommendedRoute === "regeneration");
  if (wantsRegen) return { route: "regeneration", reason: `finding ${wantsRegen.findingId} recommends regeneration` };
  const escalated = findings.find((f) => f.severity === "must_fix" && ESCALATION_RX.test(f.category));
  if (escalated) {
    return { route: "regeneration", reason: `must-fix ${escalated.category} defect (${escalated.findingId}) — causal/thesis/architecture changes escalate, never patch` };
  }
  let needsSection = findings.some((f) => f.recommendedRoute === "section");
  for (const f of findings) {
    for (const scope of f.permittedRepairScope) {
      const prefix = scope.split(/[.[]/, 1)[0];
      if (SURGICAL_SCOPE_PREFIXES.has(prefix)) continue;
      if (SECTION_SCOPE_PREFIXES.has(prefix)) { needsSection = true; continue; }
      return { route: "regeneration", reason: `scope "${scope}" (finding ${f.findingId}) is outside the patchable surface — escalate` };
    }
  }
  return needsSection
    ? { route: "section", reason: "scopes span prose sections — linked-section patch" }
    : { route: "surgical", reason: "all scopes are isolated leaves" };
}

// ── path resolution ───────────────────────────────────────────────────────────

type Segment = { key: string; index: number | null };

/** Parse `a.b[3].c` → segments. Rejects anything but simple identifier keys and
 *  non-negative integer indices (the frozen validator already rejected
 *  prototype-pollution and absolute/parent paths; this parser is the belt). */
export function parsePatchPath(path: string): Segment[] | null {
  if (typeof path !== "string" || path.length === 0 || path.length > 200) return null;
  const segs: Segment[] = [];
  for (const raw of path.split(".")) {
    const m = /^([A-Za-z][A-Za-z0-9_]*)(?:\[(\d+)\])?$/.exec(raw);
    if (!m) return null;
    segs.push({ key: m[1], index: m[2] === undefined ? null : parseInt(m[2], 10) });
  }
  return segs.length > 0 ? segs : null;
}

type Resolved = { container: Record<string, unknown> | unknown[]; finalKey: string | number; value: unknown };

/** Strict resolve: every intermediate must exist; array indices must be in
 *  bounds (replacement-only — an index === length would be an APPEND, which is
 *  an insert in disguise and is rejected). */
function resolveStrict(root: ChapterV21, segs: Segment[]): Resolved | { error: string } {
  let node: unknown = root;
  let container: Record<string, unknown> | unknown[] | null = null;
  let finalKey: string | number = "";
  for (let i = 0; i < segs.length; i++) {
    const { key, index } = segs[i];
    if (node === null || typeof node !== "object" || Array.isArray(node)) return { error: `segment "${key}": parent is not an object` };
    const obj = node as Record<string, unknown>;
    if (!(key in obj)) return { error: `segment "${key}": missing on the chapter` };
    if (index === null) {
      container = obj;
      finalKey = key;
      node = obj[key];
    } else {
      const arr = obj[key];
      if (!Array.isArray(arr)) return { error: `segment "${key}": not an array` };
      if (index >= arr.length) return { error: `segment "${key}[${index}]": index out of bounds (length ${arr.length}) — appends are inserts and inserts are not patch operations` };
      container = arr;
      finalKey = index;
      node = arr[index];
    }
  }
  return { container: container!, finalKey, value: node };
}

/** Canonical hash of a leaf value — what expectedOldValueHash pins. */
export function patchValueHash(value: unknown): string {
  return sha256Hex(JSON.stringify(value));
}

// ── apply ─────────────────────────────────────────────────────────────────────

export type PatchApplyResult =
  | { ok: true; chapter: ChapterV21; touchedPaths: string[] }
  | { ok: false; reason: string };

/** Verify + apply a typed patch entirely in memory. Every failure is a plain
 *  rejection — stale patches are never rebased; the caller's original object is
 *  never mutated (apply happens on a deep clone). */
export function applyChapterPatch(args: {
  originalBytes: string;
  original: ChapterV21;
  patch: ChapterPatchV1;
  route: "surgical" | "section";
  plan: SourceUsePlanV1 | null;
  /** Finding ids the conductor actually issued this round — a patch may not
   *  cite findings it was never given. */
  issuedFindingIds?: string[];
}): PatchApplyResult {
  const { original, patch, route, plan } = args;
  const schemaErrors = validateChapterPatch(patch);
  if (schemaErrors.length > 0) return { ok: false, reason: `patch fails the frozen contract: ${schemaErrors.slice(0, 3).join("; ")}` };

  if (patch.chapterId !== original.chapterId) {
    return { ok: false, reason: `patch targets ${patch.chapterId} but the base chapter is ${original.chapterId}` };
  }
  const baseHash = sha256Hex(args.originalBytes);
  if (patch.expectedBaseHash !== baseHash) {
    return { ok: false, reason: `stale patch: expectedBaseHash ${patch.expectedBaseHash.slice(0, 16)}… does not match the canonical base ${baseHash.slice(0, 16)}… — rejected, never rebased` };
  }
  const planHash = plan ? sourceUsePlanHash(plan) : LEGACY_NO_PLAN_HASH;
  if (patch.sourcePlanHash !== planHash) {
    return { ok: false, reason: `source-plan mismatch: patch was built under ${patch.sourcePlanHash.slice(0, 20)}, the chapter's lineage is ${planHash.slice(0, 20)} — plan changes route upstream` };
  }
  if (patch.findingIds.length === 0) return { ok: false, reason: "patch cites no findings — a repair must trace to the defects it fixes" };
  if (args.issuedFindingIds) {
    const issued = new Set(args.issuedFindingIds);
    const foreign = patch.findingIds.filter((id) => !issued.has(id));
    if (foreign.length > 0) return { ok: false, reason: `patch cites finding(s) never issued this round: ${foreign.slice(0, 3).join(", ")}` };
  }
  if (patch.operations.length > MAX_PATCH_OPERATIONS) {
    return { ok: false, reason: `${patch.operations.length} operations exceeds the ${MAX_PATCH_OPERATIONS}-op ceiling — a rewrite disguised as patches must go through regeneration` };
  }

  // Path-level verification against the ORIGINAL before any mutation.
  const seen = new Set<string>();
  for (const op of patch.operations) {
    if (seen.has(op.path)) return { ok: false, reason: `duplicate operation on "${op.path}"` };
    for (const prior of seen) {
      if (op.path.startsWith(`${prior}.`) || op.path.startsWith(`${prior}[`) || prior.startsWith(`${op.path}.`) || prior.startsWith(`${op.path}[`)) {
        return { ok: false, reason: `overlapping operations: "${prior}" and "${op.path}"` };
      }
    }
    seen.add(op.path);
    if (!pathAllowed(op.path, route)) {
      return { ok: false, reason: `path "${op.path}" is not on the ${route} allowlist — out-of-scope edits are rejected, not spliced` };
    }
    const segs = parsePatchPath(op.path);
    if (!segs) return { ok: false, reason: `unparseable path "${op.path}"` };
    const resolved = resolveStrict(original, segs);
    if ("error" in resolved) return { ok: false, reason: `path "${op.path}": ${resolved.error}` };
    const oldType = typeof resolved.value;
    const newType = typeof op.replacement;
    if (oldType !== "string" && oldType !== "number") {
      return { ok: false, reason: `path "${op.path}": current value is ${oldType} — only string/number leaves are patchable` };
    }
    if (newType !== oldType) {
      return { ok: false, reason: `path "${op.path}": replacement type ${newType} does not match the ${oldType} leaf (structure changes are not patch operations)` };
    }
    const oldHash = patchValueHash(resolved.value);
    const prefix = op.expectedOldValueHash;
    if (typeof prefix !== "string" || prefix.length < MIN_OLD_VALUE_HASH_PREFIX || !oldHash.startsWith(prefix)) {
      return { ok: false, reason: `path "${op.path}": expectedOldValueHash does not match the current value — the value changed since the patch was built (stale), or the agent edited a value it was not shown` };
    }
    if (JSON.stringify(op.replacement) === JSON.stringify(resolved.value)) {
      return { ok: false, reason: `path "${op.path}": no-op replacement (identical value)` };
    }
  }

  // Apply on a deep clone; the caller's original is never mutated.
  const chapter = structuredClone(original);
  for (const op of patch.operations) {
    const resolved = resolveStrict(chapter, parsePatchPath(op.path)!);
    if ("error" in resolved) return { ok: false, reason: `apply: path "${op.path}": ${resolved.error}` };
    (resolved.container as Record<string | number, unknown>)[resolved.finalKey as never] = op.replacement as never;
  }
  if (JSON.stringify(chapter) === JSON.stringify(original)) {
    return { ok: false, reason: "whole-patch no-op: the chapter is byte-identical after apply" };
  }
  return { ok: true, chapter, touchedPaths: [...seen] };
}

// ── non-scope drift proof (instruction 11) ────────────────────────────────────

/** Enumerate every LEAF path of a chapter object (dotted/bracket form). */
function leafPaths(node: unknown, prefix: string, out: string[]): void {
  if (node === null || typeof node !== "object") {
    out.push(prefix);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => leafPaths(v, `${prefix}[${i}]`, out));
    if (node.length === 0) out.push(prefix);
    return;
  }
  const obj = node as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) { out.push(prefix); return; }
  for (const k of keys) leafPaths(obj[k], prefix ? `${prefix}.${k}` : k, out);
}

/** Prove every leaf OUTSIDE the touched paths is byte-identical before/after.
 *  Returns the drifted paths ([] = proof holds). Byte (canonical-JSON) equality
 *  is the v1 standard for every non-scope field — the in-memory apply gives no
 *  field a reason to reformat, so no semantic-hash tolerance is needed. */
export function nonScopeDrift(original: ChapterV21, patched: ChapterV21, touchedPaths: string[]): string[] {
  const touched = touchedPaths;
  const inTouched = (path: string): boolean =>
    touched.some((t) => path === t || path.startsWith(`${t}.`) || path.startsWith(`${t}[`));
  const before: string[] = [];
  leafPaths(original as unknown, "", before);
  const drifted: string[] = [];
  for (const path of before) {
    if (inTouched(path)) continue;
    const segs = parsePatchPath(path);
    if (!segs) continue; // unreachable for real chapters; parser-hostile keys are caught elsewhere
    const a = resolveStrict(original, segs);
    const b = resolveStrict(patched, segs);
    const av = "error" in a ? `«${a.error}»` : JSON.stringify(a.value);
    const bv = "error" in b ? `«${b.error}»` : JSON.stringify(b.value);
    if (av !== bv) drifted.push(path);
  }
  return drifted;
}

// ── dependency closure names (instruction 9/10) ───────────────────────────────

/** The named semantic checks the post-apply battery must cover for a touched
 *  set. The lane runs the FULL battery unconditionally (a local patch never
 *  exempts unrelated blocker checks); these names document coverage per patch. */
export function dependencyClosureChecks(touchedPaths: string[]): string[] {
  const checks = new Set<string>([
    "chapter-schema", "gate-composite", "rubric-preflight", "author-write-contract",
    "embedded-plan-mutation-scan",
  ]);
  for (const path of touchedPaths) {
    if (path.startsWith("quiz")) { checks.add("quiz-key-integrity"); checks.add("quiz-explanation-consistency"); }
    if (path.startsWith("examples")) { checks.add("source-register-advisories"); checks.add("example-arc-outcomes"); }
    if (path.startsWith("keyTakeaway") || path.startsWith("breakdown") || path.startsWith("memorableLines") || path.startsWith("hook")) {
      checks.add("claim-strength-register");
    }
    if (path.startsWith("implementationPlan") || path.startsWith("tryThisNow")) checks.add("practice-timer-consistency");
  }
  return [...checks].sort();
}

// ── card op-menu enumeration ──────────────────────────────────────────────────

/** Scope prefix → the chapter path prefixes it covers ("practice" is the
 *  eligibility vocabulary's name for the implementation-plan surface). */
function scopePathPrefixes(scope: string): string[] {
  if (scope === "practice") return ["implementationPlan", "tryThisNow"];
  return [scope];
}

/** The CONCRETE patchable paths for a chapter under a route + scope set, with
 *  each path's current-value hash prefix — the card's OP MENU. The agent copies
 *  hashes from here; the conductor re-verifies against its own canonical value,
 *  so the menu is a pinning convenience, never an authority. */
export function enumeratePatchablePaths(
  chapter: ChapterV21,
  route: "surgical" | "section",
  scopes: string[],
): Array<{ path: string; valueHashPrefix: string }> {
  const all: string[] = [];
  leafPaths(chapter as unknown, "", all);
  const prefixes = scopes.flatMap(scopePathPrefixes);
  const out: Array<{ path: string; valueHashPrefix: string }> = [];
  for (const path of all) {
    if (!pathAllowed(path, route)) continue;
    if (!prefixes.some((p) => path === p || path.startsWith(`${p}.`) || path.startsWith(`${p}[`))) continue;
    const segs = parsePatchPath(path);
    if (!segs) continue;
    const resolved = resolveStrict(chapter, segs);
    if ("error" in resolved) continue;
    const t = typeof resolved.value;
    if (t !== "string" && t !== "number") continue;
    out.push({ path, valueHashPrefix: patchValueHash(resolved.value).slice(0, MIN_OLD_VALUE_HASH_PREFIX) });
  }
  return out;
}

// ── complaint → structured-finding bridge ─────────────────────────────────────

/** Bridge the existing complaint-string eligibility (classifyRepairEligibility)
 *  into frozen findings, so the route classifier and the patch contract run on
 *  structured data while reviewer prose stays evidence-only. */
export function findingsFromComplaints(complaints: string[], scopes: string[]): RepairFindingV1[] {
  return complaints.map((complaint, i): RepairFindingV1 => ({
    schema: "repair-finding-v1",
    findingId: `review.must-fix#${i}`,
    category: "review.must-fix",
    severity: "must_fix",
    unitIds: [],
    evidenceQuotes: [complaint.slice(0, 500)],
    violatedInvariantIds: [],
    permittedRepairScope: [...scopes],
    prohibitedChanges: ["origin", "form", "claimStrength", "detailSufficiency", "framingRequired"],
    sourcePlanDependencies: [],
    recommendedRoute: "surgical",
  }));
}
