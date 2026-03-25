"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bookmark,
  ChevronDown,
  Home,
  LayoutGrid,
  Search,
  Settings,
  Shield,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import { MOCK_BOOKS, type LibraryBook } from "@/components/library/libraryData";
import { ThemeModeToggle } from "@/components/ThemeModeToggle";

const navLinks = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Library", href: "/book/library", icon: LayoutGrid },
  { label: "Progress", href: "/book/progress", icon: TrendingUp },
  { label: "Badges", href: "/book/badges", icon: Shield },
];

function searchBooks(query: string): LibraryBook[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return MOCK_BOOKS.filter((b) => {
    const searchable = `${b.title} ${b.author} ${b.category} ${b.hook}`.toLowerCase();
    return searchable.includes(q);
  }).slice(0, 6);
}

export function DashboardNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const results = searchBooks(query);
  const showDropdown = focused && query.trim().length > 0;

  // ⌘K / Ctrl+K / "/" keyboard shortcut to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        (e.key === "k" && (e.metaKey || e.ctrlKey)) ||
        (e.key === "/" &&
          !["INPUT", "TEXTAREA", "SELECT"].includes(
            (e.target as HTMLElement).tagName
          ))
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        inputRef.current?.blur();
        setFocused(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setFocused(false);
      }
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(e.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close profile menu on route change
  useEffect(() => {
    setShowProfileMenu(false);
  }, [pathname]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!query.trim()) return;
      // Navigate to library page with search query
      router.push(`/book/library?q=${encodeURIComponent(query.trim())}`);
      setFocused(false);
      inputRef.current?.blur();
    },
    [query, router]
  );

  const handleResultClick = useCallback(
    (bookId: string) => {
      router.push(`/book/library/${encodeURIComponent(bookId)}`);
      setQuery("");
      setFocused(false);
    },
    [router]
  );

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: "var(--cf-topbar-bg)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        borderBottom: "1px solid var(--cf-divider)",
      }}
    >
      <div className="mx-auto flex h-14 w-full max-w-450 items-center justify-between px-4 sm:px-6 lg:px-10 xl:px-16">
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
        <nav className="hidden items-center gap-0.5 md:flex">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.label}
                href={link.href}
                className={[
                  "relative inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition duration-150",
                  isActive
                    ? "bg-(--cf-accent-soft) text-(--cf-accent)"
                    : "text-[var(--text-secondary)] hover:bg-(--cf-surface-muted) hover:text-[var(--text-heading)]",
                ].join(" ")}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={isActive ? "h-3.5 w-3.5 text-[var(--accent-blue)]" : "h-3.5 w-3.5"} />
                {link.label}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full"
                    style={{ background: "var(--accent-blue)" }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-1.5">
        {/* Search — desktop */}
        <div className="relative hidden md:block">
          <form onSubmit={handleSubmit}>
            <div
              className="flex items-center gap-2 rounded-full px-4 py-1.5 transition-all"
              style={{
                width: focused ? 320 : 200,
                background: focused
                  ? "var(--bg-raised)"
                  : "var(--bg-elevated)",
                border: focused
                  ? "1px solid var(--accent-blue)"
                  : "1px solid var(--border-subtle)",
                boxShadow: focused
                  ? "0 0 0 3px rgba(91,141,239,0.1)"
                  : "none",
                transition: "width 0.2s ease, border-color 0.2s, box-shadow 0.2s",
              }}
            >
              <Search
                size={12}
                style={{
                  color: focused
                    ? "var(--accent-blue)"
                    : "var(--text-muted)",
                  flexShrink: 0,
                }}
              />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setFocused(true)}
                placeholder="Search books..."
                className="flex-1 bg-transparent text-xs outline-none"
                style={{ color: "var(--text-primary)" }}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="cursor-pointer"
                  style={{ color: "var(--text-muted)" }}
                >
                  <X size={12} />
                </button>
              ) : (
                <kbd
                  className="text-[10px] opacity-50"
                  style={{ color: "var(--text-muted)" }}
                >
                  /
                </kbd>
              )}
            </div>
          </form>

          {/* Search results dropdown */}
          {showDropdown && (
            <div
              ref={dropdownRef}
              className="absolute right-0 top-full z-50 mt-2 w-90 overflow-hidden rounded-xl"
              style={{
                background: "var(--bg-raised)",
                border: "1px solid var(--border-medium)",
                boxShadow: "var(--cf-shadow-lg)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
              }}
            >
              {results.length > 0 ? (
                <div className="py-2">
                  <p
                    className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: "var(--text-muted)" }}
                  >
                    Books
                  </p>
                  {results.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => handleResultClick(book.id)}
                      className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition-colors"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "var(--cf-surface-muted)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {/* Mini cover */}
                      <div
                        className="shrink-0 overflow-hidden rounded"
                        style={{ width: 32, height: 44 }}
                      >
                        {book.coverImage ? (
                          <img
                            src={book.coverImage}
                            alt={book.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div
                            className="flex h-full w-full items-center justify-center"
                            style={{ background: book.coverGradient }}
                          >
                            <span
                              className="text-[6px] font-bold text-white"
                            >
                              {book.title.slice(0, 3)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className="truncate text-[13px] font-medium"
                          style={{ color: "var(--text-heading)" }}
                        >
                          {book.title}
                        </p>
                        <p
                          className="truncate text-[11px]"
                          style={{ color: "var(--text-muted)" }}
                        >
                          {book.author} · {book.category}
                        </p>
                      </div>
                    </button>
                  ))}
                  {/* Footer */}
                  <button
                    type="button"
                    onClick={() => {
                      handleSubmit(new Event("submit") as unknown as React.FormEvent);
                    }}
                    className="mt-1 flex w-full cursor-pointer items-center justify-center gap-1.5 border-t px-4 py-2.5 text-[12px] font-medium transition-colors"
                    style={{
                      borderColor: "var(--border-subtle)",
                      color: "var(--accent-blue)",
                    }}
                  >
                    <Search size={11} />
                    Search all for &ldquo;{query}&rdquo;
                  </button>
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <p
                    className="text-[13px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    No books match &ldquo;{query}&rdquo;
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Search icon — mobile: opens search by focusing */}
        <button
          type="button"
          onClick={() => {
            if (pathname === "/book/library") {
              document
                .getElementById("browse-all")
                ?.scrollIntoView({ behavior: "smooth" });
            } else {
              router.push("/book/library");
            }
          }}
          className="flex cursor-pointer items-center justify-center md:hidden"
          style={{ color: "var(--text-muted)" }}
          aria-label="Search books"
        >
          <Search size={18} />
        </button>

        {/* Theme toggle — matches TopNav */}
        <ThemeModeToggle className="h-9" />

        {/* Settings */}
        <Link
          href="/book/settings"
          className="hidden h-9 w-9 items-center justify-center rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-3) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1) md:inline-flex"
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </Link>

        {/* Profile */}
        <div ref={profileMenuRef} className="relative flex items-center gap-1.5">
          <Link
            href="/book/profile"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-2.5 text-(--cf-text-1) transition hover:bg-(--cf-accent-muted)"
            aria-label="Profile"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-linear-to-br from-(--cf-accent) to-(--cf-accent-strong) text-xs font-bold text-white shadow-[0_0_10px_var(--cf-accent-shadow)]">
              W
            </span>
            <span className="hidden text-sm font-medium md:inline-flex">Reader</span>
          </Link>

          <button
            type="button"
            onClick={() => setShowProfileMenu((prev) => !prev)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-3) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)"
            aria-label="Open profile menu"
            aria-expanded={showProfileMenu}
          >
            <ChevronDown className="h-4 w-4" />
          </button>

          {showProfileMenu && (
            <div className="cf-panel-strong absolute right-0 top-11 w-56 rounded-2xl p-2">
              <div className="border-b border-(--cf-divider) px-3 py-2.5">
                <p className="text-sm font-semibold text-(--cf-text-1)">Reader</p>
                <p className="text-xs text-(--cf-text-3)">ChapterFlow</p>
              </div>
              <div className="mt-1 space-y-0.5">
                <Link
                  href="/book/profile"
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-(--cf-text-2) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)"
                >
                  <User className="h-3.5 w-3.5 text-(--cf-text-3)" />
                  Profile
                </Link>
                <Link
                  href="/book/saved"
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-(--cf-text-2) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)"
                >
                  <Bookmark className="h-3.5 w-3.5 text-(--cf-text-3)" />
                  Read Next
                </Link>
                <Link
                  href="/book/settings"
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-(--cf-text-2) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)"
                >
                  <Settings className="h-3.5 w-3.5 text-(--cf-text-3)" />
                  Settings
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </header>
  );
}
