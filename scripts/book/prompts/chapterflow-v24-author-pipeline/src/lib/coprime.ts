/**
 * Coprimality helpers for the librarian "deal" allocators.
 *
 * The deals rotate over a palette of size N using fixed steps (slot/chapter). The
 * rotation only covers every slot — and only stays collision-free within a chapter —
 * when each step is COPRIME with N. The steps are hand-tuned constants picked for a
 * specific palette size; if the palette JSON later grows or shrinks, an un-retuned step
 * silently stops being coprime and the deal produces duplicates or gaps.
 *
 * `assertCoprimeSteps` turns that latent drift into a loud, self-explaining failure at
 * deal time (the venuePlan convention, generalized) so a palette edit fails with guidance
 * instead of a confusing downstream "duplicate" error.
 */

/** Euclid's GCD on the absolute values of two integers. */
export function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

/**
 * Throw a clear error if any rotation step is not coprime with the palette size N.
 * Call this at the top of a deal, right after N is known, before the allocation loop.
 */
export function assertCoprimeSteps(n: number, steps: number[], label: string): void {
  for (const step of steps) {
    const g = gcd(step, n);
    if (g !== 1) {
      throw new Error(
        `${label}: rotation step ${step} is not coprime with palette size ${n} (gcd=${g}). ` +
          `The deal will produce duplicate or missing slots. Either restore the palette size or retune the step to one coprime with ${n}.`,
      );
    }
  }
}
