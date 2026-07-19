/** Keep the settled desktop shelf at five visible covers. */
export const VISIBLE_PER_SIDE = 2;

/** Preserve the signed-off desktop fade while phones receive an edge floor. */
const STEP_OPACITY = 0.34;

/** Tailwind's `sm` breakpoint starts at 40rem, so this applies below 640px. */
export const MOBILE_EDGE_OPACITY_CLASS = "max-sm:opacity-50";

export function getCoverflowPresentation(distance: number): {
  beyond: boolean;
  desktopOpacity: number;
  mobileOpacityClassName: string;
} {
  const normalizedDistance = Math.abs(distance);
  const beyond = normalizedDistance > VISIBLE_PER_SIDE;

  return {
    beyond,
    desktopOpacity: beyond
      ? 0
      : Math.max(0, 1 - normalizedDistance * STEP_OPACITY),
    mobileOpacityClassName:
      normalizedDistance === VISIBLE_PER_SIDE
        ? MOBILE_EDGE_OPACITY_CLASS
        : "",
  };
}
