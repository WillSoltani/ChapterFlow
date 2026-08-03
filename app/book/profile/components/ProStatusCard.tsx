"use client";

import type { ProSource } from "@/lib/entitlement-types";
import { APPLE_MANAGE_SUBSCRIPTIONS_URL, APPLE_MANAGED_SUBSCRIPTION_LABEL } from "@/lib/apple-billing";
import { Button } from "@/app/book/components/ui/Button";

export function ProStatusCard({
  renewalDate,
  booksAccessedCount,
  proSinceLabel,
  proSource,
  onManage,
}: {
  renewalDate: string;
  booksAccessedCount: number;
  proSinceLabel: string;
  /** When "apple", subscription is billed through the App Store — show Apple's
   *  management link rather than the Stripe billing portal. Derived from the
   *  shared `ProSource` source of truth so it cannot drift (WS3-014). */
  proSource?: ProSource | undefined;
  onManage: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-4xl border border-accent-amber/20 bg-(--cf-surface-strong) p-6 shadow-shadow-card">
      <div className="pointer-events-none absolute inset-0 bg-radial-[circle_at_top_right] from-accent-amber/8 via-transparent to-transparent" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full border border-accent-amber/30 bg-accent-amber/10 px-3 py-1 text-cf-caption font-medium uppercase tracking-[0.22em] text-accent-amber">PRO</span>
          <span className="text-xs text-(--cf-text-soft)">{proSinceLabel}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-(--cf-text-3)">Books accessed</p>
            <p className="mt-1 text-lg font-semibold text-(--cf-text-1)">{booksAccessedCount}</p>
          </div>
          <div className="rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-(--cf-text-3)">Advanced analytics</p>
            <p className="mt-1 text-sm font-medium text-(--cf-success-text)">✓ Unlocked</p>
          </div>
          <div className="rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-(--cf-text-3)">Next renewal</p>
            <p className="mt-1 text-sm font-medium text-(--cf-text-1)">{renewalDate}</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-(--cf-text-2)">Thanks for being a Pro reader. Your support keeps ChapterFlow growing.</p>
        {proSource === "apple" ? (
          <>
            <p className="mt-4 text-xs text-(--cf-text-soft)">{APPLE_MANAGED_SUBSCRIPTION_LABEL}.</p>
            <a
              href={APPLE_MANAGE_SUBSCRIPTIONS_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex h-(--cf-control-height-sm) items-center justify-center rounded-xl border border-(--cf-border) bg-(--cf-surface) px-4 text-sm font-semibold text-(--cf-text-1) transition-colors hover:border-(--cf-text-soft)"
            >
              Manage in the App Store
            </a>
          </>
        ) : (
          <Button variant="secondary" onClick={onManage} className="mt-4">Manage subscription</Button>
        )}
      </div>
    </div>
  );
}
