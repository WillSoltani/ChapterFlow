// Text-to-speech playback-speed steps — the SINGLE source of truth shared by the
// reader's AudioPlayer (its in-player speed control) and the Settings "Playback
// speed" control, so the two surfaces can never drift apart. settings.extended.
// ttsSpeed is a free 0.5–2.0 number; both surfaces snap an off-grid value to the
// nearest step. See SET-2.
export const TTS_SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const;

export type TtsSpeedOption = (typeof TTS_SPEED_OPTIONS)[number];

/**
 * Snap an arbitrary stored speed to the nearest discrete option. On an exact tie
 * the earlier (slower) step wins, since reduce only switches on a strictly
 * smaller distance.
 */
export function snapTtsSpeedToOption(value: number): number {
  return TTS_SPEED_OPTIONS.reduce((prev, curr) =>
    Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev,
  );
}
