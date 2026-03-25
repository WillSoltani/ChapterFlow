"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";

export function MobileStickyBar() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: visible ? 0 : 100 }}
      transition={{ duration: 0.3 }}
      className="fixed bottom-0 inset-x-0 z-40 md:hidden"
      style={{
        background: "color-mix(in srgb, var(--bg-base) 90%, transparent)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <div className="px-4 py-3">
        <a
          href="/auth/login?returnTo=%2Fbook"
          className="block w-full text-center font-semibold py-3 rounded-full text-sm"
          style={{
            backgroundColor: "var(--accent-teal)",
            color: "var(--primary-foreground)",
          }}
        >
          Start reading free &rarr;
        </a>
      </div>
    </motion.div>
  );
}
