import Link from "next/link";

/**
 * The ChapterFlow logo + wordmark lockup, used across the entry/growth screens
 * (login, gift, pair-accept, account-deleted, referral). Links home so every
 * auth surface has a visible brand anchor and a way out. Token-only so it
 * survives both themes.
 */
export function BrandLockup({
  href = "/",
  className = "",
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label="ChapterFlow home"
      className={`inline-flex items-center gap-2.5 ${className}`}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect
          x="3"
          y="2"
          width="14"
          height="20"
          rx="2"
          stroke="var(--cf-accent)"
          strokeWidth="1.5"
        />
        <path
          d="M7 7h6M7 11h6M7 15h4"
          stroke="var(--cf-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <rect
          x="7"
          y="4"
          width="14"
          height="20"
          rx="2"
          fill="var(--cf-page-bg)"
          stroke="var(--cf-accent)"
          strokeWidth="1.5"
        />
        <path
          d="M11 9h6M11 13h6M11 17h4"
          stroke="var(--cf-accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <span className="text-lg font-bold tracking-tight text-(--cf-text-1)">
        ChapterFlow
      </span>
    </Link>
  );
}
