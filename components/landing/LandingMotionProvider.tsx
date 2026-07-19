"use client";

import { MotionProvider } from "@/components/MotionProvider";

/** Landing-only Framer feature boundary with the shared reduced-motion policy. */
export function LandingMotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionProvider featureMode="strict">{children}</MotionProvider>;
}
