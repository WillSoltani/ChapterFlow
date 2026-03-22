"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Settings, Sun } from "lucide-react";

const navLinks = [
  { label: "Home", href: "/dashboard" },
  { label: "Library", href: "/book/library" },
  { label: "Progress", href: "/book/progress" },
  { label: "Badges", href: "/book/badges" },
];

export function DashboardNavbar() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-40 flex h-14 items-center justify-between px-5 md:px-7"
      style={{
        background: "rgba(8,8,12,0.88)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {/* Left cluster */}
      <div className="flex items-center gap-8">
        {/* Logo + brand */}
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <svg width={28} height={28} viewBox="0 0 28 28" fill="none">
            <path
              d="M4 7C4 5.9 4.9 5 6 5H12C13.1 5 14 5.9 14 7V21C14 22.1 13.1 23 12 23H6C4.9 23 4 22.1 4 21V7Z"
              stroke="var(--accent-blue)"
              strokeWidth={1.5}
              fill="none"
            />
            <path
              d="M14 7C14 5.9 14.9 5 16 5H22C23.1 5 24 5.9 24 7V21C24 22.1 23.1 23 22 23H16C14.9 23 14 22.1 14 21V7Z"
              stroke="var(--accent-blue)"
              strokeWidth={1.5}
              fill="none"
            />
            <path
              d="M17 12L20 14L17 16"
              stroke="var(--accent-blue)"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="flex flex-col">
            <span
              className="text-[9px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: "var(--text-muted)" }}
            >
              Guided reading
            </span>
            <span
              className="font-(family-name:--font-display) text-[15px] font-semibold"
              style={{ color: "var(--text-heading)" }}
            >
              ChapterFlow
            </span>
          </div>
        </Link>

        {/* Nav links — desktop only */}
        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.label}
                href={link.href}
                className={`relative text-[13px] transition-colors ${
                  isActive ? "font-semibold" : "nav-link font-normal"
                }`}
                style={{
                  color: isActive
                    ? "var(--text-heading)"
                    : "var(--text-secondary)",
                }}
              >
                {link.label}
                {isActive && (
                  <span
                    className="absolute -bottom-1 left-0 h-[2px] w-full rounded-full"
                    style={{ background: "var(--accent-blue)" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        {/* Search pill — desktop — links to library */}
        <Link
          href="/book/library"
          className="hidden items-center gap-2 rounded-full px-4 py-1.5 text-xs transition-colors md:flex"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-muted)",
          }}
        >
          <Search size={12} />
          <span>Search books...</span>
          <kbd className="ml-1 text-[10px] opacity-50">⌘K</kbd>
        </Link>

        {/* Search icon — mobile */}
        <Link
          href="/book/library"
          className="flex items-center justify-center md:hidden"
          style={{ color: "var(--text-muted)" }}
        >
          <Search size={18} />
        </Link>

        {/* Theme toggle — no-op for now */}
        <button
          className="hidden cursor-pointer md:flex"
          style={{ color: "var(--text-muted)" }}
          aria-label="Toggle theme"
        >
          <Sun size={18} />
        </button>

        {/* Settings */}
        <Link
          href="/book/settings"
          className="hidden items-center justify-center md:flex"
          style={{ color: "var(--text-muted)" }}
          aria-label="Settings"
        >
          <Settings size={18} />
        </Link>

        {/* Avatar — links to profile */}
        <Link
          href="/book/profile"
          className="flex items-center justify-center rounded-full font-(family-name:--font-display) text-[13px] font-semibold text-white"
          style={{
            width: 30,
            height: 30,
            background:
              "linear-gradient(135deg, var(--accent-blue), var(--accent-teal))",
          }}
          aria-label="Profile"
        >
          W
        </Link>
      </div>
    </header>
  );
}
