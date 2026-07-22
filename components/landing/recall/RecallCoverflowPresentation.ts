/** Keep the settled desktop shelf at five visible covers. */
export const VISIBLE_PER_SIDE = 2;

const STEP_OPACITY = 0.34;

/** Every in-stage cover (distance 0..VISIBLE_PER_SIDE) renders at >= 0.5 opacity
 * against the #06070A canvas so it stays clearly discernible; distance-1 stays
 * at 0.66, and distance-2 lifts from its unclamped 0.32 up to the 0.5 floor. */
const MIN_STAGE_OPACITY = 0.5;

export function getCoverflowPresentation(distance: number): {
  beyond: boolean;
  desktopOpacity: number;
} {
  const normalizedDistance = Math.abs(distance);
  const beyond = normalizedDistance > VISIBLE_PER_SIDE;

  return {
    beyond,
    desktopOpacity: beyond
      ? 0
      : Math.max(MIN_STAGE_OPACITY, 1 - normalizedDistance * STEP_OPACITY),
  };
}
