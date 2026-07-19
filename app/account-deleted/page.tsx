import type { Metadata } from "next";
import Link from "next/link";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { SUPPORT_EMAIL } from "@/lib/legal-entity";

export const metadata: Metadata = {
  title: "Account deleted",
  robots: { index: false, follow: false },
};

/**
 * Terminus for a deleted account. requireDashboardAccess() flags the user as
 * "deleted" and /auth/login?reason=deleted lands them here with their local
 * session already cleared — so this page explains the state and offers a full
 * IdP sign-out (which kills the still-live Cognito session and prevents the
 * old login→callback→/book→login loop from re-forming) plus a recovery path.
 */
export default function AccountDeletedPage() {
  return (
    <AuthScreen>
      <div className="w-full max-w-md rounded-2xl border border-(--cf-border) bg-(--cf-surface) p-8 text-center shadow-(--cf-shadow-lg)">
        <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full bg-(--cf-surface-muted)">
          <svg
            width={24}
            height={24}
            viewBox="0 0 24 24"
            fill="none"
            className="text-(--cf-text-3)"
            aria-hidden="true"
          >
            <path
              d="M16 11a4 4 0 10-8 0M4 20a7 7 0 0114 0M18 8l4 4m0-4l-4 4"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 className="mb-2 text-[22px] font-bold text-(--cf-text-1)">
          Your account was deleted
        </h1>
        <p className="mx-auto mb-6 max-w-sm text-cf-body-sm leading-relaxed text-(--cf-text-3)">
          This ChapterFlow account has been closed, so it can no longer access
          your library or reading progress. You&apos;ve been signed out on this
          device.
        </p>

        <div className="flex flex-col gap-3">
          {/* No returnTo: a relative "/" would be passed verbatim to Cognito's
              logout_uri, which it rejects (it requires a pre-registered, fully
              qualified sign-out URL → error page). Omitting it lets the logout
              route fall back to its registered COGNITO_LOGOUT_REDIRECT_URI. */}
          <Link
            href="/auth/logout"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-(--cf-accent) px-4 text-cf-body-sm font-semibold text-(--cf-accent-contrast) transition duration-(--duration-fast) hover:brightness-110"
          >
            Sign out completely
          </Link>
          <Link
            href="/signup"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-(--cf-border-strong) px-4 text-cf-body-sm font-medium text-(--cf-text-1) transition-colors duration-(--duration-fast) hover:bg-(--cf-surface-muted)"
          >
            Create a new account
          </Link>
        </div>

        <p className="mt-6 text-cf-label text-(--cf-text-3)">
          Think this was a mistake?{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-(--cf-accent) underline underline-offset-2"
          >
            Contact support
          </a>
        </p>
      </div>
    </AuthScreen>
  );
}
