/**
 * Contract utilities — canonical JSON + hashing for the Phase-0 frozen integration
 * contracts (GPT-5.6 SOL migration master plan §8.2 / IMP-00 item 12).
 *
 * Every shared cross-package interface (execution profile, candidate transaction,
 * source-use plan, repair finding/patch, attempt evidence, review outputs, route
 * result, worker report) is declared as BOTH a TypeScript type (compile-time face)
 * and a JSON descriptor (the freeze face). The descriptor's canonical-JSON sha256
 * is pinned in `contract-manifest.json`; the contracts-freeze test recomputes the
 * hashes so a schema edit without a version bump + regenerated manifest is a test
 * FAILURE, not a silent drift (plan §12 contract-change rule).
 */

import { createHash } from "crypto";

/** Deterministic JSON: objects with sorted keys, arrays in order. Rejects
 *  undefined/functions/cycles by construction (JSON-serializable input only). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = sortValue(v);
    }
    return out;
  }
  return value;
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hashCanonical(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

/** One frozen contract: name + integer version + owning implementation prompt +
 *  a JSON descriptor of the shape. The descriptor is documentation-grade (field →
 *  type string), hashed for freeze detection; the TS types are the compile face. */
export type ContractDescriptor = {
  name: string;
  version: number;
  ownerPrompt: string;
  description: string;
  /** field name → compact type description (string). Nested shapes inline. */
  fields: Record<string, unknown>;
};

export function contractHash(c: ContractDescriptor): string {
  return hashCanonical({ name: c.name, version: c.version, fields: c.fields });
}

/** Tiny validation helpers for the hand-rolled runtime validators (repo carries
 *  no schema dependency; validators return an error-string list, [] = valid). */
export function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.length > 0;
}

export function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

export function expectFields(value: Record<string, unknown>, required: string[], errors: string[], where: string): void {
  for (const f of required) {
    if (!(f in value) || value[f] === undefined) errors.push(`${where}: missing required field "${f}"`);
  }
}
