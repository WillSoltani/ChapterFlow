"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { badgeItemVariants } from "./profile-badge-motion";

export function StaggeredBadgeItem({ children }: { children: ReactNode }) {
  return (
    <motion.div variants={badgeItemVariants} className="h-full">
      {children}
    </motion.div>
  );
}
