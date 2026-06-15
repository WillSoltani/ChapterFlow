"use client";

import { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { track } from "@/lib/analytics";

export function MobileStickyBar() {
  const [visible, setVisible] = useState(false);
  const [pricingInView, setPricingInView] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const pricing = document.getElementById("pricing");
    if (!pricing) return;
    const observer = new IntersectionObserver(
      ([entry]) => setPricingInView(entry.isIntersecting),
      { rootMargin: "0px 0px -20% 0px" },
    );
    observer.observe(pricing);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    try {
      if (localStorage.getItem("cf_sticky_bar_dismissed") === "1") {
        setDismissed(true);
      }
    } catch {}
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try { localStorage.setItem("cf_sticky_bar_dismissed", "1"); } catch {}
    track("cta_click", { source: "mobile_sticky_bar_dismiss" });
  };

  const shown = visible && !dismissed && !pricingInView;

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: shown ? 0 : 100 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
      className="fixed bottom-0 inset-x-0 z-40 md:hidden pb-safe"
      style={{
        background: "color-mix(in srgb, var(--bg-base) 90%, transparent)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "2px solid color-mix(in srgb, var(--accent-cyan) 35%, transparent)",
      }}
    >
      <div className="px-4 py-3 flex items-center gap-3">
        <a
          href={AUTH_LOGIN_BOOK_URL}
          onClick={() => track("cta_click", { source: "mobile_sticky_bar" })}
          className="flex-1 text-center font-semibold py-3 rounded-full text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2"
          style={{
            backgroundColor: "var(--accent-cyan)",
            color: "var(--primary-foreground)",
          }}
        >
          Start reading free &rarr;
        </a>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex-shrink-0 min-h-11 min-w-11 inline-flex items-center justify-center rounded-full text-(--text-muted) hover:text-(--text-heading) hover:bg-(--bg-glass) transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60"
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </motion.div>
  );
}
