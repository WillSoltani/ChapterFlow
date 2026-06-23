import type { ChapterV21 } from "../types.js";
import { canonicalJsonSha256 } from "./canonicalJson.js";

export const READER_CONTENT_STRIP_RULES_VERSION = "reader-content-strip-v1" as const;
export const READER_CONTENT_HASH_VERSION = "reader-content-canonical-sha256-v1" as const;

const AUTHORING_INTERNAL_KEYS = new Set(["sourceAnchorId", "planSpec"]);

function stripAuthoringKeysDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripAuthoringKeysDeep(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (AUTHORING_INTERNAL_KEYS.has(k)) continue;
      out[k] = stripAuthoringKeysDeep(v);
    }
    return out as T;
  }
  return value;
}

export function stripInternalFields(chapter: ChapterV21): ChapterV21 {
  return stripAuthoringKeysDeep(chapter);
}

export function containsAuthoringInternalField(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = containsAuthoringInternalField(item);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (AUTHORING_INTERNAL_KEYS.has(key)) return key;
      const hit = containsAuthoringInternalField(child);
      if (hit) return hit;
    }
  }
  return null;
}

export function readerContentHash(chapter: ChapterV21): string {
  return canonicalJsonSha256(stripInternalFields(chapter));
}
