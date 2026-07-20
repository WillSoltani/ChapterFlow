import type { UtcIso } from "../../../src/contracts/v4Core.js";
import type { ChapterFlowClock } from "../../../src/app/pipeline.js";

function canonicalMilliseconds(value: UtcIso): number {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new Error(`FakeClock requires canonical UTC ISO time: ${value}`);
  }
  return milliseconds;
}

export class FakeClock implements ChapterFlowClock {
  #milliseconds: number;
  readonly #stepMilliseconds: number;
  readonly #observed: UtcIso[] = [];

  constructor(initial: UtcIso = "2026-07-20T12:00:00.000Z", stepMilliseconds = 1_000) {
    this.#milliseconds = canonicalMilliseconds(initial);
    if (!Number.isSafeInteger(stepMilliseconds) || stepMilliseconds < 1) {
      throw new Error("FakeClock step must be a positive safe integer");
    }
    this.#stepMilliseconds = stepMilliseconds;
  }

  now(): UtcIso {
    const value = new Date(this.#milliseconds).toISOString();
    this.#observed.push(value);
    this.#milliseconds += this.#stepMilliseconds;
    return value;
  }

  advance(milliseconds: number): UtcIso {
    if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
      throw new Error("FakeClock advance must be a non-negative safe integer");
    }
    this.#milliseconds += milliseconds;
    return new Date(this.#milliseconds).toISOString();
  }

  peek(): UtcIso {
    return new Date(this.#milliseconds).toISOString();
  }

  report(): Readonly<{ current: UtcIso; observed: readonly UtcIso[] }> {
    return { current: this.peek(), observed: [...this.#observed] };
  }
}
