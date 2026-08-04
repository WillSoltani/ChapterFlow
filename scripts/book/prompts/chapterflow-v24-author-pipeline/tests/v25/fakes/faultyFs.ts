import type { AtomicBookFileSeams, AtomicBookPoint } from "../../../src/books/atomicBookFiles.js";
import type { CandidateStoreSeams } from "../../../src/books/candidateStore.js";

export class FaultyFs {
  #armed: AtomicBookPoint | null = null;
  #suffix = 0;
  readonly hits: AtomicBookPoint[] = [];

  arm(point: AtomicBookPoint): void {
    this.#armed = point;
  }

  disarm(): void {
    this.#armed = null;
  }

  readonly point = (name: AtomicBookPoint): void => {
    this.hits.push(name);
    if (this.#armed === name) throw new Error(`injected filesystem crash at ${name}`);
  };

  atomicSeams(): AtomicBookFileSeams {
    return {
      point: this.point,
      tempSuffix: () => `walking-skeleton-${this.#suffix++}`,
    };
  }

  candidateSeams(): CandidateStoreSeams {
    return { atomic: this.atomicSeams() };
  }
}
