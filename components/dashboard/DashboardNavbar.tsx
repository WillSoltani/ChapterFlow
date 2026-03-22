"use client";

import { Search, Settings, Sun } from "lucide-react";

const navLinks = [
  { label: "Home", active: true },
  { label: "Library", active: false },
  { label: "Progress", active: false },
  { label: "Badges", active: false },
];

export function DashboardNavbar() {
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
        <div className="flex items-center gap-2.5">
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
        </div>

        {/* Nav links — desktop only */}
        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <button
              key={link.label}
              className={`relative cursor-pointer text-[13px] transition-colors ${
                link.active
                  ? "font-semibold"
                  : "nav-link font-normal"
              }`}
              style={{
                color: link.active
                  ? "var(--text-heading)"
                  : "var(--text-secondary)",
              }}
            >
              {link.label}
              {link.active && (
                <span
                  className="absolute -bottom-1 left-0 h-[2px] w-full rounded-full"
                  style={{ background: "var(--accent-blue)" }}
                />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        {/* Search pill — desktop */}
        <button
          className="hidden cursor-pointer items-center gap-2 rounded-full px-4 py-1.5 text-xs transition-colors md:flex"
          style={{
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-muted)",
          }}
        >
          <Search size={12} />
          <span>Search books...</span>
          <kbd className="ml-1 text-[10px] opacity-50">⌘K</kbd>
        </button>

        {/* Search icon — mobile */}
        <button
          className="flex cursor-pointer items-center justify-center md:hidden"
          style={{ color: "var(--text-muted)" }}
        >
          <Search size={18} />
        </button>

        {/* Theme toggle */}
        <button
          className="hidden cursor-pointer md:flex"
          style={{ color: "var(--text-muted)" }}
        >
          <Sun size={18} />
        </button>

        {/* Settings */}
        <button
          className="hidden cursor-pointer md:flex"
          style={{ color: "var(--text-muted)" }}
        >
          <Settings size={18} />
        </button>

        {/* Avatar */}
        <div
          className="flex items-center justify-center rounded-full font-(family-name:--font-display) text-[13px] font-semibold text-white"
          style={{
            width: 30,
            height: 30,
            background:
              "linear-gradient(135deg, var(--accent-blue), var(--accent-teal))",
          }}
        >
          W
        </div>
      </div>
    </header>
  );
}
