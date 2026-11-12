"use client";

import { LazyMotion } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { loadWithRetry } from "@/components/motion-feature-load";

const importMotionFeatures = () =>
  import("framer-motion").then(({ domAnimation }) => domAnimation);

/**
 * The gated import runs late (a menu tap, Pricing approaching), when a phone
 * may be offline: retried with backoff, then again when the network is back,
 * and never rejected (motion-feature-load.ts). Ungated routes keep the plain
 * import at mount.
 */
const importMotionFeaturesWithRetry = () => loadWithRetry(importMotionFeatures);

/**
 * How far ahead of the viewport counts as approaching, both ways: a page
 * restored below Pricing (browser Back, a jump to the footer) reaches it
 * scrolling up, and must load before it enters too.
 */
export const MOTION_APPROACH_MARGIN = "150% 0px 150% 0px";

/**
 * A gate in front of the feature import: features load only once the gate
 * opens. Without a gate (every route but the landing) they load at mount, as
 * they always did.
 */
type MotionFeatureGateValue = { ready: Promise<void>; open: () => void };

const MotionFeatureGateContext = createContext<MotionFeatureGateValue | null>(null);

function newGate(): MotionFeatureGateValue {
  let open!: () => void;
  const ready = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { ready, open };
}

/**
 * Defer the motion feature bundle inside this subtree until first use: an
 * element matching `approach` comes within `margin` of the viewport (load on
 * approach, so its first animation still plays), or a descendant asks for
 * the features (useMotionFeaturesWhen: a dialog or menu opening;
 * useLoadMotionFeatures: an intent such as hovering a menu button). The
 * reduced-motion policy is untouched (MotionProvider at the root).
 */
export function MotionFeatureGate({
  children,
  approach,
  margin = MOTION_APPROACH_MARGIN,
}: {
  children: React.ReactNode;
  /** Selector of the sections that animate with the features. */
  approach?: string;
  /** IntersectionObserver rootMargin: how far ahead of the viewport counts as approaching. */
  margin?: string;
}) {
  const [gate] = useState(newGate);
  useEffect(() => {
    if (!approach) return;
    const targets = document.querySelectorAll(approach);
    if (targets.length === 0) return;
    if (typeof IntersectionObserver === "undefined") {
      gate.open();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        gate.open();
      },
      { rootMargin: margin },
    );
    for (const t of targets) io.observe(t);
    return () => io.disconnect();
  }, [gate, approach, margin]);
  return <MotionFeatureGateContext.Provider value={gate}>{children}</MotionFeatureGateContext.Provider>;
}

/** Ask for the motion features: opens the enclosing gate (no-op without one). */
export function useLoadMotionFeatures(): () => void {
  const gate = useContext(MotionFeatureGateContext);
  return useCallback(() => gate?.open(), [gate]);
}

/** Open the enclosing gate once `when` is true (a dialog or menu opening). */
export function useMotionFeaturesWhen(when: boolean) {
  const load = useLoadMotionFeatures();
  useEffect(() => {
    if (when) load();
  }, [when, load]);
}

/** Route/component-scoped DOM animation features for Framer's lightweight `m` facade. */
export function MotionFeatureProvider({
  children,
  strict = false,
}: {
  children: React.ReactNode;
  strict?: boolean;
}) {
  const gate = useContext(MotionFeatureGateContext);
  // Inside a MotionFeatureGate the import waits for the gate. Stable per
  // gate: LazyMotion reads `features` once, at mount.
  const loadMotionFeatures = useCallback(
    () => (gate ? gate.ready.then(importMotionFeaturesWithRetry) : importMotionFeatures()),
    [gate],
  );
  return (
    <LazyMotion features={loadMotionFeatures} strict={strict}>
      {children}
    </LazyMotion>
  );
}
