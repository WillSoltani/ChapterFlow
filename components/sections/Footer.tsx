import Link from "next/link";

const navLinks = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Library", href: "#library" },
  { label: "Pricing", href: "#pricing" },
  { label: "Sign in", href: "/auth/login?returnTo=%2Fbook" },
];

export function Footer() {
  return (
    <footer
      className="mt-20 py-8"
      style={{
        borderTop: "1px solid var(--border-subtle)",
        background: "#080d17",
      }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 items-center">
          {/* Left: Logo + tagline */}
          <div className="flex flex-col md:flex-row md:items-center items-center gap-2 md:gap-3">
            <div className="flex items-center gap-1.5">
              <svg
                width="22"
                height="22"
                viewBox="0 0 32 32"
                fill="none"
                className="flex-shrink-0"
              >
                <defs>
                  <linearGradient
                    id="cfGradFooter"
                    x1="0"
                    y1="0"
                    x2="32"
                    y2="32"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#2dd4bf" />
                    <stop offset="1" stopColor="#14b8a6" />
                  </linearGradient>
                </defs>
                <rect
                  width="32"
                  height="32"
                  rx="8"
                  fill="url(#cfGradFooter)"
                />
                <rect
                  x="6"
                  y="8"
                  width="11"
                  height="15"
                  rx="2"
                  fill="white"
                  opacity="0.15"
                  transform="rotate(-8 11.5 15.5)"
                />
                <rect
                  x="10"
                  y="7.5"
                  width="11"
                  height="15"
                  rx="2"
                  fill="white"
                  opacity="0.4"
                  transform="rotate(-2 15.5 15)"
                />
                <rect
                  x="14"
                  y="7"
                  width="11"
                  height="15"
                  rx="2"
                  fill="white"
                  opacity="0.9"
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
            <Link href="/terms" className="hover:underline">
              Terms
            </Link>
            <Link href="/privacy" className="hover:underline">
              Privacy
            </Link>
          </div>
          <span>&copy; 2026 ChapterFlow</span>
        </div>
      </div>
    </footer>
  );
}
