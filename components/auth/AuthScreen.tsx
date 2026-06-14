import type { ReactNode } from "react";
import { BrandLockup } from "./BrandLockup";

/**
 * Full-page shell for the entry / growth-loop screens (gift, pair-accept,
 * account-deleted, referral). Gives each one the dashboard-consistent
 * background, a brand header with a way out, and proper min-h-screen centering
 * — instead of a lone card floating on an empty, logo-less page.
 *
 * Token-only and theme-safe; presentational (no "use client") so server and
 * client pages can both use it.
 */
export function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative flex min-h-screen flex-col bg-(--cf-page-bg)"
      style={{
        backgroundImage:
          "radial-gradient(60% 50% at 18% -8%, var(--cf-accent-muted), transparent 70%), radial-gradient(50% 45% at 92% 108%, var(--cf-accent-muted), transparent 70%)",
      }}
    >
      {/* Brand header — gives a logo + a way out of the flow */}
      <header className="flex items-center px-5 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8">
        <BrandLockup />
      </header>

      {/* Centered content */}
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        {children}
      </main>
    </div>
  );
}
