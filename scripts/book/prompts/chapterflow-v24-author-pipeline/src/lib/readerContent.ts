import type { ChapterV21 } from "../types.js";
import { canonicalJsonSha256 } from "./canonicalJson.js";
import { MACHINERY_BEAT_SURFACES } from "../critics/machineryPhrases.js";

/**
 * reader-content-strip-v3 (WS1 / K2).
 *
 * v3 removes MORE authoring-internal fields than v2 so the shipped distribution
 * package carries reader content only (owner requirement: "should not contain
 * the hashes and attestation or anything other than the book/chapter content").
 * Two removal mechanisms:
 *   1) deep key-name removal (AUTHORING_INTERNAL_KEYS) — for keys whose NAME is
 *      unique to internals, so removing them anywhere in the tree is safe.
 *   2) path-aware removal (stripPathAwareInternalFields) — for keys whose name is
 *      too generic for blanket deep removal (`title`, `location`, `why`,
 *      `schemaVersion`): these are removed only at their KNOWN internal locations,
 *      never where the same name is reader content (examples[].title,
 *      chapters[].title, examples[].whyItMatters all SURVIVE).
 *
 * ⚠️ This strip is DISTINCT from the QC attestation content hash
 * (qcAttestation.ts `chapterContentHash` / V2_EXCLUDE_* — a frozen algorithm that
 * MUST NOT change). The v3 keys removed here (implementationPlan.title, per-chapter
 * schemaVersion, memorableLines[].location/why, depthLevel, namedCaseIds,
 * sourceFactIds) ARE inside the attestation hash's scope, so callers that verify
 * QC freshness MUST hash the LOOSE (un-v3-stripped) chapter — never the output of
 * this function. See productionManifest.ts gatherCommonPayload.
 */
export const READER_CONTENT_STRIP_RULES_VERSION = "reader-content-strip-v3" as const;
export const READER_CONTENT_HASH_VERSION = "reader-content-canonical-sha256-v1" as const;

const AUTHORING_INTERNAL_KEYS = new Set([
  "authoring",
  "planSpec",
  "sourceAnchorId",
  "sourceAnchorIds",
  "keyEvidenceAnchorIds",
  "titleSourceAnchorIds",
  "coreSkillSourceAnchorIds",
  "twentyFourHourChallengeSourceAnchorIds",
  "weeklyPracticeSourceAnchorIds",
  "hookSourceAnchorIds",
  "counterintuitionSourceAnchorIds",
  "keyTakeawaySourceAnchorIds",
  "tryThisNowSourceAnchorIds",
  // v3 additions — names unique to internals, safe for deep removal.
  "namedCaseIds",
  "sourceFactIds",
  "depthLevel",
]);

/** Any key ending in SourceAnchorId(s) is authoring provenance, whatever prefix the
 *  writer chose. The verifier (verifyProductionPackage.ts FORBIDDEN_SOURCE_ANCHOR_RE)
 *  has always rejected by this SUFFIX, but the strip only removed the enumerated
 *  names above — a writer-invented variant ("breakdownSourceAnchorIds", live:
 *  high-output-management ch10) passed the strip and fail-closed the promote. The
 *  strip must remove a superset of what the verifier rejects. */
const AUTHORING_INTERNAL_KEY_RE = /SourceAnchorIds?$/;

function isAuthoringInternalKey(key: string): boolean {
  return AUTHORING_INTERNAL_KEYS.has(key) || AUTHORING_INTERNAL_KEY_RE.test(key);
}

function stripAuthoringKeysDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripAuthoringKeysDeep(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isAuthoringInternalKey(k)) continue;
      out[k] = stripAuthoringKeysDeep(v);
    }
    return out as T;
  }
  return value;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Path-aware removal of generic-named internal keys. Operates on a chapter object
 * (already deep-key-stripped). Removes ONLY:
 *   - chapters[].schemaVersion (per-chapter; the top-level PACKAGE schemaVersion
 *     lives on the package object, not the chapter, and is untouched)
 *   - implementationPlan.title (writer skill label; examples[].title/chapters[].title survive)
 *   - memorableLines[].location and memorableLines[].why (never rendered; .text survives)
 */
function stripPathAwareInternalFields(chapter: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...chapter };

  // Per-chapter schemaVersion (top-level of the CHAPTER object only).
  delete out.schemaVersion;

  if (isObject(out.implementationPlan)) {
    const plan = { ...(out.implementationPlan as Record<string, unknown>) };
    delete plan.title;
    out.implementationPlan = plan;
  }

  if (Array.isArray(out.memorableLines)) {
    out.memorableLines = (out.memorableLines as unknown[]).map((line) => {
      if (!isObject(line)) return line;
      const next = { ...line };
      delete next.location;
      delete next.why;
      return next;
    });
  }

  return out;
}

/**
 * Machinery-tag hygiene (CF-I, 2026-07-09). Example display `tags` are reader
 * content and ship in the package, but the writers stamped the dealt BEAT LABELS
 * into them verbatim (live: multipliers ch07 tags "early signal" / "return point";
 * shipped: high-output-management ch1/2/3/5, execution ch3). A dealt label as a
 * display tag is the same machinery leak C33 charges in prose, one surface over —
 * so the reader-content strip filters any example tag matching a
 * machineryPhrases.ts watchlist surface, and the verifier mirrors the rule
 * (strip ⊇ verifier, the planSpec precedent).
 *
 * MATCHING (measured 2026-07-09 over all 137 shipped packages + the v24 state
 * corpora):
 *   - MULTI-WORD surfaces ("early signal", "return point", "late catch", "caught
 *     late", "return moment", "first sign nobody", "set but not yet met") match
 *     case-insensitively with word boundaries anywhere in the tag — zero false
 *     positives measured; every hit is a verbatim dealt label.
 *   - SINGLE-WORD surfaces ("reckoning") match only when they ARE the whole tag
 *     (trimmed, case-folded). Measured false positive that forces the scoping:
 *     dare-to-lead ch8 ships the tag "reckoning, rumble, revolution" — the book's
 *     OWN framework vocabulary (legitimate reader content), which a bare contains
 *     rule would destroy.
 */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
const MACHINERY_TAG_MULTIWORD_RE: RegExp | null = (() => {
  const multi = MACHINERY_BEAT_SURFACES.filter((s) => s.includes(" "));
  return multi.length > 0 ? new RegExp(`\\b(?:${multi.map(escapeRegex).join("|")})\\b`, "i") : null;
})();
const MACHINERY_TAG_WHOLE = new Set(
  MACHINERY_BEAT_SURFACES.filter((s) => !s.includes(" ")).map((s) => s.toLowerCase()),
);

/** Is this example display tag a machinery watchlist surface? Pure. */
export function isMachineryExampleTag(tag: unknown): boolean {
  if (typeof tag !== "string") return false;
  if (MACHINERY_TAG_MULTIWORD_RE?.test(tag)) return true;
  return MACHINERY_TAG_WHOLE.has(tag.trim().toLowerCase());
}

/** Drop machinery watchlist tags from examples[].tags (the rest of each tag list —
 *  and everything else — survives; an emptied list stays an empty array). */
function stripMachineryExampleTags(chapter: Record<string, unknown>): Record<string, unknown> {
  if (!Array.isArray(chapter.examples)) return chapter;
  return {
    ...chapter,
    examples: (chapter.examples as unknown[]).map((ex) => {
      if (!isObject(ex) || !Array.isArray(ex.tags)) return ex;
      return { ...ex, tags: (ex.tags as unknown[]).filter((t) => !isMachineryExampleTag(t)) };
    }),
  };
}

/** First machinery example tag anywhere in `value` (a chapter or array of chapters),
 *  or null — the verifier-side mirror of stripMachineryExampleTags, so
 *  `stripInternalFields(x)` provably satisfies `firstMachineryExampleTag(...) === null`. */
export function firstMachineryExampleTag(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = firstMachineryExampleTag(item);
      if (hit) return hit;
    }
    return null;
  }
  if (!isObject(value) || !Array.isArray(value.examples)) return null;
  for (const ex of value.examples as unknown[]) {
    if (!isObject(ex) || !Array.isArray(ex.tags)) continue;
    for (const t of ex.tags as unknown[]) {
      if (isMachineryExampleTag(t)) return t as string;
    }
  }
  return null;
}

export function stripInternalFields(chapter: ChapterV21): ChapterV21 {
  const deep = stripAuthoringKeysDeep(chapter) as unknown as Record<string, unknown>;
  return stripMachineryExampleTags(stripPathAwareInternalFields(deep)) as unknown as ChapterV21;
}

/**
 * Returns the first authoring-internal FIELD found anywhere in `value`, or null.
 * Detects both deep-key internals (AUTHORING_INTERNAL_KEYS) and the path-aware
 * internal locations, so the verifier's forbidden-field gate (PPKG.forbidden_field)
 * can reject a package that still carries any of them. Reported as a dotted path
 * for path-aware hits so the finding names WHERE it leaked.
 */
export function containsAuthoringInternalField(value: unknown): string | null {
  const deep = containsDeepAuthoringInternalField(value);
  if (deep) return deep;
  return containsPathAwareInternalField(value);
}

function containsDeepAuthoringInternalField(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = containsDeepAuthoringInternalField(item);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (isAuthoringInternalKey(key)) return key;
      const hit = containsDeepAuthoringInternalField(child);
      if (hit) return hit;
    }
  }
  return null;
}

/**
 * Path-aware forbidden-field detection over a single CHAPTER object. Mirrors
 * stripPathAwareInternalFields exactly, so `stripInternalFields(x)` provably
 * satisfies `containsAuthoringInternalField(...) === null`.
 */
function containsPathAwareInternalField(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = containsPathAwareChapterField(item);
      if (hit) return hit;
    }
    return null;
  }
  return containsPathAwareChapterField(value);
}

function containsPathAwareChapterField(chapter: unknown): string | null {
  if (!isObject(chapter)) return null;
  if ("schemaVersion" in chapter) return "schemaVersion (per-chapter)";
  if (isObject(chapter.implementationPlan) && "title" in (chapter.implementationPlan as Record<string, unknown>)) {
    return "implementationPlan.title";
  }
  if (Array.isArray(chapter.memorableLines)) {
    for (const line of chapter.memorableLines as unknown[]) {
      if (isObject(line) && "location" in line) return "memorableLines[].location";
      if (isObject(line) && "why" in line) return "memorableLines[].why";
    }
  }
  return null;
}

export function readerContentHash(chapter: ChapterV21): string {
  return canonicalJsonSha256(stripInternalFields(chapter));
}
