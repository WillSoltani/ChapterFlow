"use client";

/**
 * Render-time report of the reel's pins, for tests only (pins.test.tsx):
 * with a collector provided, every FilmSegment reports its reduced-motion
 * stops and every FramePin its timing with the scrims it sits in, so the
 * stops are checked against the pins the landing really renders. Without a
 * collector (the page) nothing is reported and FramePin renders as before.
 */

import { createContext } from "react";
import type { PinRange } from "./pins";

export type PinCollector = {
  segment: (id: string, film: string, stops: readonly number[], dissolveIn: number) => void;
  pin: (segment: string, chain: readonly PinRange[], text: string) => void;
};

export const PinCollectContext = createContext<PinCollector | null>(null);

/** The scrims around a FramePin, outermost first (provided only while collecting). */
export const PinChainContext = createContext<readonly PinRange[]>([]);
