import type { Metadata } from "next";
import Link from "next/link";
import { Gift } from "lucide-react";
import { AuthScreen } from "@/components/auth/AuthScreen";

export const metadata: Metadata = {
  title: "You've been invited",
  robots: { index: false, follow: false },
};

/**
 * Referral interstitial. /ref/[code] sets the attribution cookie and lands the
 * friend here so the promised reward is actually acknowledged before the auth
 * wall. Copy states the *real* reward: the referral flow grants bonus Insight
 * Points (180/80) to both sides once the friend finishes their first learning
 * loop — it does NOT grant a Pro week, so we don't claim one here.
 */
export default function ReferralLandingPage() {
  return (
    <AuthScreen>
      <div className="w-full max-w-md rounded-2xl border border-(--cf-border) bg-(--cf-surface) p-8 text-center shadow-(--cf-shadow-lg)">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-(--cf-accent-soft) text-(--cf-accent)">
          <Gift className="h-7 w-7" />
        </div>

        <p className="mb-1 text-[13px] font-medium uppercase tracking-wide text-(--cf-accent)">
          You&apos;ve been invited
        </p>
        <h1 className="mb-3 text-[22px] font-bold leading-snug text-(--cf-text-1)">
          A friend invited you to ChapterFlow
        </h1>
        <p className="mb-7 text-[14px] leading-relaxed text-(--cf-text-3)">
          Create your free account and finish your first learning loop — you&apos;ll
          earn 80 Insight Points and your friend earns 180, a real head start
          toward bonus books and Pro passes. ChapterFlow turns any book into a
          skill you actually keep.
        </p>

        <div className="flex flex-col gap-3">
          <Link
            href="/signup?returnTo=%2Fbook"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-(--cf-accent) px-4 text-[14px] font-semibold text-(--cf-accent-contrast) transition duration-(--duration-fast) hover:brightness-110"
          >
            Claim your invite
          </Link>
          <Link
            href="/auth/login?returnTo=%2Fbook"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-(--cf-border-strong) bg-(--cf-surface-muted) px-4 text-[14px] font-medium text-(--cf-text-1) transition-colors duration-(--duration-fast) hover:bg-(--cf-surface)"
          >
            I already have an account
          </Link>
        </div>
      </div>
    </AuthScreen>
  );
}
