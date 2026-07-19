"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { DUR, EASE } from "@/lib/motion";

export function FadeIn({
  delay = 0,
  className,
  children,
}: {
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: DUR.slow, delay, ease: EASE.standard }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
