"use client";

import { motion } from "framer-motion";

export function NewBadgeDot() {
  return (
    <motion.span
      className="absolute -right-1 -top-1 z-10 h-2.5 w-2.5 rounded-full bg-accent-amber"
      animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}
