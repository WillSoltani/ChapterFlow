"use client";

import { MotionFeatureGate, MotionFeatureProvider } from "@/components/MotionFeatureProvider";

/**
 * Landing-only Framer feature boundary with the shared reduced-motion policy.
 * Nothing on the first screens animates with Framer, so the feature bundle
 * is not loaded at mount: it loads when a section marked
 * `data-motion-approach` (Pricing's billing toggle) comes within 1.5
 * viewports of the screen, or when an overlay (the nav menu, the book
 * request dialog) opens or the menu button is hovered, focused or touched.
 */
export function LandingMotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionFeatureGate approach="[data-motion-approach]">
      <MotionFeatureProvider strict>{children}</MotionFeatureProvider>
    </MotionFeatureGate>
  );
}
