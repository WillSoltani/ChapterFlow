"use client";

import { motion } from "framer-motion";

interface FlameIconProps {
  size?: number;
  className?: string;
}

export function FlameIcon({ size = 22, className = "" }: FlameIconProps) {
  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      style={{ filter: "drop-shadow(0 0 8px var(--accent-flame-glow))" }}
      animate={{ opacity: [0.8, 1, 0.85, 1] }}
      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
    >
      <path
        d="M12 2.5C12 2.5 6.5 9.5 6.5 14C6.5 17.04 9 19.5 12 19.5C15 19.5 17.5 17.04 17.5 14C17.5 9.5 12 2.5 12 2.5Z"
        fill="var(--accent-flame)"
      />
      <path
        d="M12 9.5C12 9.5 9.5 12.5 9.5 14.5C9.5 15.88 10.62 17 12 17C13.38 17 14.5 15.88 14.5 14.5C14.5 12.5 12 9.5 12 9.5Z"
        fill="#FFB874"
        opacity={0.85}
      />
    </motion.svg>
  );
}
