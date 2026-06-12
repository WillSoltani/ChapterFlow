"use client";

import { useId, useState } from "react";
import { X } from "lucide-react";
import { ProBadge } from "./ProBadge";
import { Button } from "@/app/book/components/ui/Button";
import { TRIAL_CTA_LABEL } from "@/lib/pricing";
import { Dialog } from "@/components/ui/Dialog";

type ProFeatureCardProps = {
  icon: string;
  title: string;
  description: string;
  detailDescription?: string;
  /** Retained for call-site compatibility; Dialog owns motion now. */
  reducedMotion?: boolean;
  onUpgrade?: () => void;
};

export function ProFeatureCard({
  icon,
  title,
  description,
  detailDescription,
  onUpgrade,
}: ProFeatureCardProps) {
  const [showModal, setShowModal] = useState(false);
  const titleId = useId();

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-(--cf-border) bg-gradient-to-br from-(--accent-amber)/3 to-(--accent-rose)/3 p-4">
        {/* Shimmer border */}
        <div className="absolute inset-0 rounded-2xl border border-transparent bg-gradient-to-r from-(--accent-amber)/10 via-(--accent-rose)/10 to-(--accent-rose)/10 opacity-40" />

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
      <Dialog
        open={showModal}
        onClose={() => setShowModal(false)}
        labelledBy={titleId}
      >
        <div className="relative p-6">
          <button
            type="button"
            onClick={() => setShowModal(false)}
            aria-label="Close"
            className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full hover:bg-(--cf-surface-muted) text-(--cf-text-soft)"
          >
            <X className="h-4 w-4" />
          </button>

          <h2
            id={titleId}
            className="flex items-center gap-2 text-xl font-bold text-(--cf-text-1)"
          >
            <span aria-hidden="true">{icon}</span>
            <span>{title}</span>
            <ProBadge />
          </h2>

          <p className="mt-3 text-sm leading-relaxed text-(--cf-text-2)">
            {detailDescription ?? description}
          </p>

          <div className="mt-6 space-y-3">
            <Button variant="primary" fullWidth onClick={onUpgrade}>
              {TRIAL_CTA_LABEL}
            </Button>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full py-2 text-center text-sm text-(--cf-text-3) hover:text-(--cf-text-2)"
            >
              Not now
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
