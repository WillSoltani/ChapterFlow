/**
 * Style values the film's copy layers write per frame (FramePin, HallText),
 * quantised so that a tiny scroll delta writes nothing: opacity in 0.01
 * steps, translation in 0.5 px steps. Pure: the components cache the last
 * written string per element and skip identical writes.
 */

/** A promoted pin is demoted this long after its values stop changing. */
export const PIN_DEMOTE_MS = 300;

export function quantOpacity(o: number): number {
  return Math.round(o * 100) / 100 || 0;
}

export function quantPx(v: number): number {
  return Math.round(v * 2) / 2 || 0;
}

/**
 * A FramePin's opacity and transform. The rise is a 2D translate (a 3D one
 * would hold a compositor layer even at rest); fully visible it is `none`, so
 * a resting pin looks the same whether or not it is promoted. A scrim pin
 * fades only: transform null = never written.
 */
export function pinStyle(o: number, y: number, scrim: boolean, reduced: boolean): { opacity: string; transform: string | null } {
  const q = quantOpacity(o);
  if (scrim) return { opacity: String(q), transform: null };
  const ty = reduced ? 0 : quantPx((1 - q) * y);
  return { opacity: String(q), transform: ty === 0 ? "none" : `translate(0px, ${ty}px)` };
}

/**
 * A Hall wall line at compress progress `k` (0..1): kept lines brighten and
 * lift 14 px toward the camera, the others fade out. `lit` = the kept line has
 * caught the accent (past half the compress); the colour is written only when
 * it flips.
 */
export function hallLineStyle(keep: boolean, k: number, reduced: boolean): { opacity: string; transform: string; lit: boolean } {
  const o = keep ? 0.55 + 0.45 * k : 0.55 * (1 - k);
  const z = keep && !reduced ? quantPx(14 * k) : 0;
  return {
    opacity: String(quantOpacity(o)),
    transform: z === 0 ? "none" : `translate3d(0px, 0px, ${z}px)`,
    lit: keep && k > 0.5,
  };
}
