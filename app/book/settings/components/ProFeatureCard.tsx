"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { ProBadge } from "./ProBadge";
import { Button } from "@/app/book/components/ui/Button";

type ProFeatureCardProps = {
  icon: string;
  title: string;
  description: string;
  detailDescription?: string;
  reducedMotion?: boolean;
};

export function ProFeatureCard({
  icon,
  title,
  description,
  detailDescription,
  reducedMotion,
}: ProFeatureCardProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-(--cf-border) bg-gradient-to-br from-amber-500/[0.03] to-pink-500/[0.03] p-4">
        {/* Shimmer border */}
        <div className="absolute inset-0 rounded-2xl border border-transparent bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-pink-500/10 opacity-40" />

        <div className="relative flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-base">{icon}</span>
              <span className="text-sm font-semibold text-(--cf-text-1)">{title}</span>
              <ProBadge />
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-(--cf-text-3)">
              {description}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="mt-3 text-xs font-medium text-(--cf-accent) hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border) rounded"
        >
          Learn more &rarr;
        </button>
      </div>

      {/* Pro Preview Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center px-4">
            <motion.div
              initial={reducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0 }}
              className="absolute inset-0 bg-(--cf-overlay) backdrop-blur-sm"
              onClick={() => setShowModal(false)}
            />
            <motion.div
              initial={reducedMotion ? false : { y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reducedMotion ? undefined : { y: 20, opacity: 0 }}
              className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-(--cf-surface-strong) border border-(--cf-border) p-6 shadow-xl"
            >
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close"
                className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full hover:bg-(--cf-surface-muted) text-(--cf-text-soft)"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 text-xl">
                <span>{icon}</span>
                <span className="font-bold text-(--cf-text-1)">{title}</span>
                <ProBadge />
              </div>

              <p className="mt-3 text-sm leading-relaxed text-(--cf-text-2)">
                {detailDescription ?? description}
              </p>

              <div className="mt-6 space-y-3">
                <Button variant="primary" fullWidth>
                  Start 7-day free trial
                </Button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="w-full py-2 text-center text-sm text-(--cf-text-3) hover:text-(--cf-text-2)"
                >
                  Not now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
