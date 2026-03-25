import Link from "next/link";

const navLinks = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Library", href: "/books" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Sign in", href: "/auth/login?returnTo=%2Fbook" },
];

export function Footer() {
  return (
    <footer
      className="py-8"
      style={{
        borderTop: "1px solid var(--border-subtle)",
        background: "var(--bg-base)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 items-center">
          {/* Left: Logo + tagline */}
          <div className="flex flex-col md:flex-row md:items-center items-center gap-2 md:gap-3">
            <div className="flex items-center gap-1.5">
              <svg width={22} height={22} viewBox="0 0 28 28" fill="none" aria-hidden="true" className="flex-shrink-0">
                <path
                  d="M4 7C4 5.9 4.9 5 6 5H12C13.1 5 14 5.9 14 7V21C14 22.1 13.1 23 12 23H6C4.9 23 4 22.1 4 21V7Z"
                  stroke="var(--accent-teal)"
                  strokeWidth={1.5}
                  fill="none"
                />
                <path
                  d="M14 7C14 5.9 14.9 5 16 5H22C23.1 5 24 5.9 24 7V21C24 22.1 23.1 23 22 23H16C14.9 23 14 22.1 14 21V7Z"
                  stroke="var(--accent-teal)"
                  strokeWidth={1.5}
                  fill="none"
                />
                <path
                  d="M17 12L20 14L17 16"
                  stroke="var(--accent-teal)"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                className="text-[14px] font-semibold"
                style={{ color: "var(--text-heading)" }}
              >
                ChapterFlow
              </span>
            </div>
            <span
              className="text-[13px] text-center md:text-left"
              style={{ color: "var(--text-muted)" }}
            >
              Guided reading for depth, momentum, and real retention.
            </span>
          </div>

          {/* Right: Nav links */}
          <nav className="flex flex-row gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="nav-link text-[13px]"
                style={{ color: "var(--text-muted)" }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Bottom row */}
        <div
          className="mt-6 flex flex-col md:flex-row md:justify-between items-center gap-2 text-[12px]"
          style={{ color: "var(--text-muted)" }}
        >
          <div className="flex gap-4">
            <Link href="/coming-soon" className="hover:underline">
              Terms
            </Link>
            <Link href="/coming-soon" className="hover:underline">
              Privacy
            </Link>
          </div>
          <span>&copy; 2026 ChapterFlow</span>
        </div>
      </div>
    </footer>
  );
}
