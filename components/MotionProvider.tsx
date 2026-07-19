"use client";

import { LazyMotion, MotionConfig } from "framer-motion";
import { useEffect, useState } from "react";

type MotionFeatureMode = "strict" | "compatible";

const loadMotionFeatures = () =>
  import("framer-motion").then(({ domAnimation }) => domAnimation);

/**
 * Wraps the app in framer's MotionConfig.
 *
 * `reducedMotion="user"` honors the OS prefers-reduced-motion media query. But
 * the IN-APP reduce-motion toggle only set html[data-motion="reduced"] (CSS
 * !important), which framer's JS animations ignored — so the toggle did nothing
 * for the ~86 components driven by framer (a trust bug). We now mirror that
 * attribute into MotionConfig: when the in-app toggle is on we force "always",
 * otherwise we stay on "user" (still honoring the OS setting).
 */
export function MotionProvider({
  children,
  featureMode,
}: {
  children: React.ReactNode;
  featureMode: MotionFeatureMode;
}) {
  const [reducedMotion, setReducedMotion] = useState<"user" | "always">("user");

  useEffect(() => {
    const root = document.documentElement;
    const sync = () =>
      setReducedMotion(root.dataset.motion === "reduced" ? "always" : "user");
    sync();

    // The in-app settings toggle dispatches "book-theme-change"; cover cross-tab
    // ("storage") and any direct data-motion mutation too.
    window.addEventListener("book-theme-change", sync);
    window.addEventListener("storage", sync);
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["data-motion"] });

    return () => {
      window.removeEventListener("book-theme-change", sync);
      window.removeEventListener("storage", sync);
      observer.disconnect();
    };
  }, []);

  return (
    <MotionConfig reducedMotion={reducedMotion}>
      {featureMode === "strict" ? (
        <LazyMotion features={loadMotionFeatures} strict>
          {children}
        </LazyMotion>
      ) : (
        <LazyMotion features={loadMotionFeatures}>{children}</LazyMotion>
      )}
    </MotionConfig>
  );
}
