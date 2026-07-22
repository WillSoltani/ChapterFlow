"use client";

import { MONTHLY_PRICE_WITH_CURRENCY, TRIAL_CTA_LABEL } from "@/lib/pricing";
import { Button } from "@/app/book/components/ui/Button";

export function UpgradeCard({
  booksUsed, booksTotal, personalizedMessage, onUpgrade,
}: {
  booksUsed: number; booksTotal: number; personalizedMessage: string; onUpgrade: () => void;
}) {
  const percent = Math.min(100, Math.round((booksUsed / Math.max(booksTotal, 1)) * 100));
  return (
    <div className="relative overflow-hidden rounded-4xl border border-accent-amber/20 bg-(--cf-surface-strong) p-6 shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
      <div className="pointer-events-none absolute inset-0 bg-radial-[circle_at_top_right] from-accent-amber/8 via-transparent to-transparent" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="cf-pill px-3 py-1 text-cf-caption font-medium uppercase tracking-[0.22em]">FREE PLAN</span>
          <span className="text-sm text-(--cf-text-3)">{booksUsed} of {booksTotal} books used</span>
        </div>
        <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-(--cf-border)">
          <div className="h-full rounded-full bg-linear-to-r from-accent-amber to-accent-amber" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-4 text-base leading-7 text-(--cf-text-2)">{personalizedMessage}</p>
        <p className="mt-3 text-lg font-semibold text-(--cf-text-1)">
          {MONTHLY_PRICE_WITH_CURRENCY}/month <span className="text-sm font-normal text-(--cf-text-3)">— less than a single book purchase</span>
        </p>
        <p className="mt-2 text-sm text-(--cf-text-3)">Join readers who chose to go deeper</p>
        <Button variant="primary" size="lg" fullWidth onClick={onUpgrade} className="mt-5">{TRIAL_CTA_LABEL} &rarr;</Button>
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-(--cf-text-3)">
          <span>Cancel anytime</span><span>&bull;</span><span>No hidden fees</span>
        </div>
      </div>
    </div>
  );
}
