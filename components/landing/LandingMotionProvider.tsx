"use client";

import { MotionFeatureProvider } from "@/components/MotionFeatureProvider";

/** Landing-only Framer feature boundary with the shared reduced-motion policy. */
export function LandingMotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionFeatureProvider strict>{children}</MotionFeatureProvider>;
}
