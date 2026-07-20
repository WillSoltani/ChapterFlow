import { createHash } from "node:crypto";

import type { UtcIso } from "../../src/contracts/v4Core.js";

export function compareBytes(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

export function byteSorted(values: readonly string[]): string[] {
  return [...values].sort(compareBytes);
}

function requireUtcIso(value: string): number {
  const millis = Date.parse(value);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== value) {
    throw new Error(`fixed clock requires canonical UTC ISO time: ${value}`);
  }
  return millis;
}

export class FixedClock {
  readonly #initial: UtcIso;
  #millis: number;
  readonly #observed: UtcIso[] = [];

  constructor(initial: UtcIso = "2026-01-01T00:00:00.000Z") {
    this.#millis = requireUtcIso(initial);
    this.#initial = initial;
  }

  now(): UtcIso {
    const value = new Date(this.#millis).toISOString();
    this.#observed.push(value);
    return value;
  }

  advance(milliseconds: number): UtcIso {
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
      throw new Error(`fixed clock advance must be a non-negative safe integer: ${milliseconds}`);
    }
    this.#millis += milliseconds;
    if (!Number.isSafeInteger(this.#millis)) throw new Error("fixed clock overflow");
    return new Date(this.#millis).toISOString();
  }

  report(): { readonly initial: UtcIso; readonly current: UtcIso; readonly observed: readonly UtcIso[] } {
    return {
      initial: this.#initial,
      current: new Date(this.#millis).toISOString(),
      observed: [...this.#observed],
    };
  }
}

export class SeededIds {
  readonly #seed: string;
  #counter = 0;
  readonly #generated: string[] = [];

  constructor(seed: string) {
    if (seed.length === 0) throw new Error("deterministic ID seed must not be empty");
    this.#seed = seed;
  }

  next(namespace = "id"): string {
    if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(namespace)) {
      throw new Error(`invalid deterministic ID namespace: ${namespace}`);
    }
    const ordinal = this.#counter++;
    const digest = createHash("sha256")
      .update(this.#seed)
      .update("\0")
      .update(namespace)
      .update("\0")
      .update(String(ordinal))
      .digest("hex")
      .slice(0, 24);
    const value = `${namespace}-${digest}`;
    this.#generated.push(value);
    return value;
  }

  report(): { readonly seed: string; readonly count: number; readonly generated: readonly string[] } {
    return { seed: this.#seed, count: this.#counter, generated: [...this.#generated] };
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const input = value as Record<string, unknown>;
    return Object.fromEntries(byteSorted(Object.keys(input)).map((key) => [key, canonicalize(input[key])]));
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("deterministic summary rejects non-finite numbers");
  }
  if (typeof value === "bigint" || typeof value === "function" || typeof value === "symbol" || value === undefined) {
    throw new Error(`deterministic summary rejects ${typeof value}`);
  }
  return value;
}

export function deterministicSummary(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}
