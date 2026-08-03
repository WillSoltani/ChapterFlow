"use client";

import { LazyMotion } from "framer-motion";

const loadMotionFeatures = () =>
  import("framer-motion").then(({ domAnimation }) => domAnimation);

/** Route/component-scoped DOM animation features for Framer's lightweight `m` facade. */
export function MotionFeatureProvider({
  children,
  strict = false,
}: {
  children: React.ReactNode;
  strict?: boolean;
}) {
  return (
    <LazyMotion features={loadMotionFeatures} strict={strict}>
      {children}
    </LazyMotion>
  );
}
