"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ToastNotificationProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
}

export function ToastNotification({
  message,
  visible,
  onDismiss,
  duration = 2000,
}: ToastNotificationProps) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [visible, duration, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
        >
          <div
            className="flex items-center gap-2 whitespace-nowrap px-5 py-2.5 text-[13px] font-medium shadow-lg"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-medium)",
              borderRadius: "var(--radius-full-val)",
              color: "var(--text-heading)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="var(--accent-teal)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 7.5L5 10.5L12 3.5" />
            </svg>
            {message}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
