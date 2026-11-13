// On a phone the audio and "Ask" buttons float over the text, so they step
// aside while the reader scrolls down and return on scroll-up, at the top of
// the page and at the very end (where bottom padding keeps text clear of them).

const JITTER_PX = 8;
const TOP_ZONE_PX = 48;
const END_ZONE_PX = 24;

export function nextFloatingControlsHidden(input: {
  prevY: number;
  y: number;
  hidden: boolean;
  viewportH: number;
  docH: number;
}): boolean {
  const { prevY, y, hidden, viewportH, docH } = input;
  if (y <= TOP_ZONE_PX) return false;
  if (y + viewportH >= docH - END_ZONE_PX) return false;
  const delta = y - prevY;
  if (delta > JITTER_PX) return true;
  if (delta < -JITTER_PX) return false;
  return hidden;
}
