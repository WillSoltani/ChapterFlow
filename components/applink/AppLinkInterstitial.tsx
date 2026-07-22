import type { ReactNode } from "react";
import Link from "next/link";
import { AuthScreen } from "@/components/auth/AuthScreen";

/**
 * Web fallback for a Universal Link path that iOS deep-links into the app.
 *
 * When the ChapterFlow iOS app is installed, iOS intercepts the covered paths
 * (see app/_lib/apple-app-site-association.ts) before the browser ever loads
 * them. This branded interstitial is what everyone else — desktop, Android, or
 * an iPhone without the app yet — sees instead, so the link never dead-ends.
 *
 * Presentational + token-only (no "use client"), matching the referral/gift
 * entry screens. `appStoreUrl` renders the App Store CTA once the app ships
 * (wired from NEXT_PUBLIC_IOS_APP_STORE_URL); until then a quiet "coming soon"
 * line holds its place.
 */
export function AppLinkInterstitial({
  icon,
  eyebrow,
  title,
  description,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  children,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  children?: ReactNode;
}) {
  const appStoreUrl = process.env.NEXT_PUBLIC_IOS_APP_STORE_URL?.trim();

  return (
    <AuthScreen>
      <div className="w-full max-w-md rounded-2xl border border-(--cf-border) bg-(--cf-surface) p-8 text-center shadow-(--cf-shadow-lg)">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-(--cf-accent-soft) text-(--cf-accent)">
          {icon}
        </div>

        <p className="mb-1 text-cf-label font-medium uppercase tracking-wide text-(--cf-accent)">
          {eyebrow}
        </p>
        <h1 className="mb-3 text-[22px] font-bold leading-snug text-(--cf-text-1)">
          {title}
        </h1>
        <p className="mb-7 text-cf-body-sm leading-relaxed text-(--cf-text-3)">
          {description}
        </p>

        {children}

        <div className="flex flex-col gap-3">
          <Link
            href={primaryHref}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-(--cf-accent) px-4 text-cf-body-sm font-semibold text-(--cf-accent-contrast) transition duration-(--duration-fast) hover:brightness-110"
          >
            {primaryLabel}
          </Link>
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-(--cf-border-strong) bg-(--cf-surface-muted) px-4 text-cf-body-sm font-medium text-(--cf-text-1) transition-colors duration-(--duration-fast) hover:bg-(--cf-surface)"
            >
              {secondaryLabel}
            </Link>
          ) : null}
        </div>

        {appStoreUrl ? (
          <a
            href={appStoreUrl}
            className="mt-5 inline-block text-cf-label font-medium text-(--cf-accent) hover:underline"
          >
            Open in the App Store
          </a>
        ) : (
          <p className="mt-5 text-cf-label-sm text-(--cf-text-3)">
            The ChapterFlow iOS app is coming soon.
          </p>
        )}
      </div>
    </AuthScreen>
  );
}
