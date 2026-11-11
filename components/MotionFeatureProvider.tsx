"use client";

import { LazyMotion } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

const importMotionFeatures = () =>
  import("framer-motion").then(({ domAnimation }) => domAnimation);

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
  margin = "0px 0px 150% 0px",
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
    () => (gate ? gate.ready.then(importMotionFeatures) : importMotionFeatures()),
    [gate],
  );
  return (
    <LazyMotion features={loadMotionFeatures} strict={strict}>
      {children}
    </LazyMotion>
  );
}
