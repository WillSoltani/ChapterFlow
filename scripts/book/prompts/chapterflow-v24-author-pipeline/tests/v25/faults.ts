import { byteSorted } from "./determinism.js";

export class InjectedFault extends Error {
  readonly point: string;
  readonly reachCount: number;

  constructor(point: string, reachCount: number) {
    super(`injected fault: ${point} (reach ${reachCount})`);
    this.name = "InjectedFault";
    this.point = point;
    this.reachCount = reachCount;
  }
}

type ArmedFault = { readonly atReach: number };

export type FaultReport = {
  readonly name: string;
  readonly reachCount: number;
  readonly armedAtReach: number | null;
};

export class FaultInjector {
  readonly #armed = new Map<string, ArmedFault>();
  readonly #reached = new Map<string, number>();

  arm(name: string, atReach = 1): void {
    this.#requireName(name);
    if (!Number.isSafeInteger(atReach) || atReach < 1) {
      throw new Error(`fault reach must be a positive safe integer: ${atReach}`);
    }
    if (this.#armed.has(name)) throw new Error(`fault already armed: ${name}`);
    this.#armed.set(name, { atReach });
  }

  reach(name: string): void {
    this.#requireName(name);
    const reachCount = (this.#reached.get(name) ?? 0) + 1;
    this.#reached.set(name, reachCount);
    if (this.#armed.get(name)?.atReach === reachCount) {
      throw new InjectedFault(name, reachCount);
    }
  }

  report(): readonly FaultReport[] {
    const names = byteSorted([...new Set([...this.#reached.keys(), ...this.#armed.keys()])]);
    return names.map((name) => ({
      name,
      reachCount: this.#reached.get(name) ?? 0,
      armedAtReach: this.#armed.get(name)?.atReach ?? null,
    }));
  }

  #requireName(name: string): void {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(name)) {
      throw new Error(`invalid fault name: ${name}`);
    }
  }
}
