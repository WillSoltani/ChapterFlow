"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { badgeContainerVariants } from "./profile-badge-motion";

export function StaggeredBadgeGrid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={badgeContainerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-40px" }}
    >
      {children}
    </motion.div>
  );
}
