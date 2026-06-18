"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEventHandler, type MutableRefObject } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bookmark,
  ChevronDown,
  Gift,
  Home,
  LayoutGrid,
  LogOut,
  Map,
  MoreHorizontal,
  NotebookPen,
  Settings,
  Settings2,
  Shield,
  TrendingUp,
  Trophy,
  User,
} from "lucide-react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import { Sheet } from "@/components/ui/Dialog";
import { SearchBox } from "@/app/book/home/components/SearchBox";
import { GlobalSearchPanel } from "@/app/book/home/components/GlobalSearchPanel";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import { ChapterFlowMark } from "@/app/book/components/ChapterFlowMark";
import { ThemeModeToggle } from "@/components/ThemeModeToggle";
import { NotificationBell } from "@/app/book/_components/NotificationBell";
import { performLogout } from "@/lib/logout";

export type BookNavTab = "home" | "library" | "journeys" | "saved" | "progress" | "badges" | "events" | "notebook" | "settings" | "profile" | "rewards";

type TopNavProps = {
  name: string;
  avatarUrl?: string | null;
  /** Highlighted nav tab. Omit on secondary surfaces (e.g. Notebook) that have
   *  no entry in the main nav so nothing is mis-highlighted. */
  activeTab?: BookNavTab;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchInputRef: MutableRefObject<HTMLInputElement | null>;
  showSearch?: boolean;
  searchPlaceholder?: string;
  showGlobalSearchPanel?: boolean;
  /** Use "dashboard" to render the open-book SVG logo from the dashboard page */
  logoVariant?: "default" | "dashboard";
};

type NavItem = {
  id: BookNavTab;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

/** Shown in both desktop nav and mobile bottom bar */
const navItems: NavItem[] = [
  { id: "home", label: "Home", href: "/dashboard", icon: Home },
  { id: "library", label: "Library", href: "/book/library", icon: LayoutGrid },
  { id: "progress", label: "Progress", href: "/book/progress", icon: TrendingUp },
  { id: "badges", label: "Achievements", href: "/book/badges", icon: Shield },
];

/** Secondary product areas — surfaced through the "More" sheet (mobile) and the
 *  profile dropdown (desktop), not the primary inline/bottom nav. Kept the same
 *  on every breakpoint so the IA tier is consistent across devices. */
const secondaryNavItems: NavItem[] = [
  { id: "journeys", label: "Journeys", href: "/book/journeys", icon: Map },
  { id: "events", label: "Events", href: "/book/events", icon: Trophy },
];

/**
 * The full secondary set, reachable on mobile through the bottom bar's "More"
 * sheet (and on desktop through the profile dropdown) — the secondary product
 * areas plus Rewards and the utility destinations, so no product area is cut off.
 */
const moreNavItems: NavItem[] = [
  ...secondaryNavItems,
  { id: "rewards", label: "Rewards", href: "/rewards", icon: Gift },
  { id: "saved", label: "Read Next", href: "/book/saved", icon: Bookmark },
  { id: "notebook", label: "Notebook", href: "/book/notebook", icon: NotebookPen },
  { id: "settings", label: "Settings", href: "/book/settings", icon: Settings },
];

export function TopNav({
  name,
  avatarUrl,
  activeTab,
  searchQuery,
  onSearchChange,
  searchInputRef,
  showSearch = true,
  searchPlaceholder,
  showGlobalSearchPanel = true,
  logoVariant = "default",
}: TopNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  // Keyboard navigation over the GlobalSearchPanel results (combobox + listbox).
  const [searchActiveIndex, setSearchActiveIndex] = useState(-1);
  const [searchResultHrefs, setSearchResultHrefs] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchBookJson<{ isAdmin: boolean }>("/app/api/book/me/is-admin")
      .then((res) => {
        if (!cancelled) setIsAdmin(Boolean(res.isAdmin));
      })
      .catch(() => {
        // not admin or unauthenticated — silently ignore
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const headerRef = useRef<HTMLDivElement | null>(null);
  const desktopSearchRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchRef = useRef<HTMLInputElement | null>(null);
  // Profile-menu trigger — focus is returned here when the menu closes (a11y).
  const profileTriggerRef = useRef<HTMLButtonElement | null>(null);
  const wasProfileMenuOpen = useRef(false);

  const initial = name.trim().charAt(0).toUpperCase() || "R";
  const showAvatar = !!avatarUrl && !avatarError;

  // Reset error state when avatar URL changes
  useEffect(() => {
    setAvatarError(false);
  }, [avatarUrl]);

  const focusSearchInput = () => {
    const preferMobile = window.matchMedia("(max-width: 1023px)").matches;
    const target = preferMobile ? mobileSearchRef.current : desktopSearchRef.current;
    target?.focus();
    searchInputRef.current = target;
  };

  useKeyboardShortcut(
    "/",
    (event) => {
      if (!showSearch) return;
      event.preventDefault();
      focusSearchInput();
      setShowSearchPanel(true);
    },
    { ignoreWhenTyping: true }
  );

  useKeyboardShortcut("Escape", () => {
    setShowSearchPanel(false);
    setShowProfileMenu(false);
  });

  useEffect(() => {
    setShowSearchPanel(false);
    setShowProfileMenu(false);
    setShowMoreSheet(false);
  }, [pathname]);

  // Return focus to the trigger whenever the profile menu transitions open → closed
  // (Escape, click-away, selecting an item) so keyboard users aren't dropped.
  useEffect(() => {
    if (wasProfileMenuOpen.current && !showProfileMenu) {
      profileTriggerRef.current?.focus();
    }
    wasProfileMenuOpen.current = showProfileMenu;
  }, [showProfileMenu]);

  useEffect(() => {
    if (!showGlobalSearchPanel) {
      setShowSearchPanel(false);
      return;
    }
    setShowSearchPanel(searchQuery.trim().length > 0);
  }, [searchQuery, showGlobalSearchPanel]);

  // Reset the keyboard highlight whenever the query changes or the panel closes.
  useEffect(() => {
    setSearchActiveIndex(-1);
  }, [searchQuery]);
  useEffect(() => {
    if (!showSearchPanel) setSearchActiveIndex(-1);
  }, [showSearchPanel]);

  const onSearchKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (!showGlobalSearchPanel || !showSearchPanel) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSearchActiveIndex((i) =>
        searchResultHrefs.length === 0 ? -1 : Math.min(i + 1, searchResultHrefs.length - 1),
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSearchActiveIndex((i) => Math.max(i - 1, -1));
    } else if (event.key === "Enter") {
      const trimmed = searchQuery.trim();
      if (!trimmed) return;
      event.preventDefault();
      const href = searchActiveIndex >= 0 ? searchResultHrefs[searchActiveIndex] : null;
      setShowSearchPanel(false);
      router.push(href ?? `/book/library?q=${encodeURIComponent(trimmed)}`);
    }
  };

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!headerRef.current) return;
      if (headerRef.current.contains(event.target as Node)) return;
      setShowSearchPanel(false);
      setShowProfileMenu(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    return () => window.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <>
      {/* Skip to main content (WCAG 2.4.1 Bypass Blocks) — the first focusable
          element on every authenticated surface. Targets the page's #main region,
          which each client renders AFTER this nav, so activating it bypasses the
          whole nav. Cyan chrome ("doing the work"), not a celebration surface. */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-(--cf-accent-contrast) focus:shadow-[0_6px_20px_var(--cf-accent-shadow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent-border) focus-visible:ring-offset-2 focus-visible:ring-offset-(--cf-page-bg)"
        style={{ background: "var(--cf-accent)" }}
      >
        Skip to main content
      </a>

      {/* ── Top header ── */}
      <header className="cf-topbar sticky top-0 z-30">
        <div ref={headerRef} className="mx-auto w-full max-w-450 px-4 py-2.5 sm:px-6 lg:px-10 xl:px-16">
          <div className="flex items-center gap-3">

            {/* Logo */}
            <Link
              href="/dashboard"
              className="inline-flex shrink-0 items-center gap-2.5 rounded-xl cf-focus"
              aria-label="Go to ChapterFlow workspace"
            >
              {logoVariant === "dashboard" ? (
                <>
                  <svg width={28} height={28} viewBox="0 0 28 28" fill="none">
                    <path
                      d="M4 7C4 5.9 4.9 5 6 5H12C13.1 5 14 5.9 14 7V21C14 22.1 13.1 23 12 23H6C4.9 23 4 22.1 4 21V7Z"
                      stroke="var(--accent-cyan)"
                      strokeWidth={1.5}
                      fill="none"
                    />
                    <path
                      d="M14 7C14 5.9 14.9 5 16 5H22C23.1 5 24 5.9 24 7V21C24 22.1 23.1 23 22 23H16C14.9 23 14 22.1 14 21V7Z"
                      stroke="var(--accent-cyan)"
                      strokeWidth={1.5}
                      fill="none"
                    />
                    <path
                      d="M17 12L20 14L17 16"
                      stroke="var(--accent-cyan)"
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
                </>
              ) : (
                <ChapterFlowMark compact />
              )}
            </Link>

            {/* Desktop / tablet nav — primary set only. Journeys/Events/Rewards are
                secondary (profile dropdown here, "More" sheet on mobile). Shown from
                the md tablet band up; smaller screens use the bottom tab bar. */}
            <nav aria-label="Primary" className="ml-5 hidden items-center gap-0.5 md:flex">
              {navItems.map((item) => {
                const active = item.id === activeTab;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    title={item.label}
                    aria-label={item.label}
                    className="relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition duration-150 lg:px-3.5"
                    style={
                      active
                        ? { background: "var(--cf-accent-soft)", color: "var(--accent-cyan)" }
                        : { color: "var(--text-secondary)" }
                    }
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "var(--bg-glass)";
                        e.currentTarget.style.color = "var(--text-heading)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = "var(--text-secondary)";
                      }
                    }}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {/* Icon-only across the md tablet band (label would overflow the
                        top bar at 768); full labels return at lg. */}
                    <span className="hidden lg:inline">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Desktop search */}
            {showSearch ? (
              <div className="relative hidden flex-1 justify-center px-4 lg:flex">
                <SearchBox
                  ref={desktopSearchRef}
                  value={searchQuery}
                  onChange={onSearchChange}
                  onFocus={() => {
                    searchInputRef.current = desktopSearchRef.current;
                    setShowSearchPanel(true);
                  }}
                  onKeyDown={onSearchKeyDown}
                  placeholder={searchPlaceholder}
                  expanded={showGlobalSearchPanel && showSearchPanel}
                  controlsId="desktop-global-search-listbox"
                  activeDescendantId={
                    searchActiveIndex >= 0 ? `desktop-gs-opt-${searchActiveIndex}` : undefined
                  }
                />
                {showGlobalSearchPanel ? (
                  <GlobalSearchPanel
                    open={showSearchPanel}
                    query={searchQuery}
                    onClose={() => setShowSearchPanel(false)}
                    idPrefix="desktop"
                    activeIndex={searchActiveIndex}
                    onResultsChange={setSearchResultHrefs}
                  />
                ) : null}
              </div>
            ) : (
              <div className="hidden flex-1 lg:block" />
            )}

            {/* Right: notifications + settings + profile.
                md:ml-auto right-aligns the cluster across the tablet band, where the
                centered desktop search (lg+) isn't present to absorb the free space. */}
            <div className="relative flex items-center gap-1.5 md:ml-auto lg:ml-0">
              <NotificationBell />
              <ThemeModeToggle className="h-9" />

              <Link
                href="/book/settings"
                className={[
                  "hidden min-h-11 min-w-11 items-center justify-center rounded-xl border transition lg:inline-flex",
                  activeTab === "settings"
                    ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-accent)"
                    : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-3) hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)",
                ].join(" ")}
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </Link>

              <Link
                href="/book/profile"
                className={[
                  "inline-flex h-9 items-center gap-2 rounded-xl border px-2.5 transition",
                  activeTab === "profile"
                    ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-accent)"
                    : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-1) hover:bg-(--cf-accent-muted)",
                ].join(" ")}
                aria-label="Profile"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-(--cf-accent) to-(--cf-accent-strong) text-xs font-bold text-white shadow-[0_0_10px_var(--cf-accent-shadow)]">
                  {showAvatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt={name}
                      className="h-full w-full object-cover"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    initial
                  )}
                </span>
                <span className="hidden text-sm font-medium lg:inline-flex">{name || "Reader"}</span>
              </Link>

              <button
                ref={profileTriggerRef}
                type="button"
                onClick={() => setShowProfileMenu((prev) => !prev)}
                className={[
                  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border transition",
                  activeTab === "profile"
                    ? "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-accent)"
                    : "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-3) hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)",
                ].join(" ")}
                aria-label="Open profile menu"
                aria-haspopup="menu"
                aria-expanded={showProfileMenu}
              >
                <ChevronDown className="h-4 w-4" />
              </button>

              {showProfileMenu ? (
                <div className="cf-panel-strong absolute right-0 top-11 w-56 rounded-2xl p-2">
                  <div className="border-b border-(--cf-divider) px-3 py-2.5">
                    <p className="text-sm font-semibold text-(--cf-text-1)">{name || "Reader"}</p>
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
                      href="/rewards"
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-(--cf-text-2) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)"
                    >
                      <Gift className="h-3.5 w-3.5 text-(--cf-text-3)" />
                      Rewards
                    </Link>
                    <Link
                      href="/book/journeys"
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-(--cf-text-2) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)"
                    >
                      <Map className="h-3.5 w-3.5 text-(--cf-text-3)" />
                      Journeys
                    </Link>
                    <Link
                      href="/book/events"
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-(--cf-text-2) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)"
                    >
                      <Trophy className="h-3.5 w-3.5 text-(--cf-text-3)" />
                      Events
                    </Link>
                    <Link
                      href="/book/saved"
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-(--cf-text-2) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)"
                    >
                      <Bookmark className="h-3.5 w-3.5 text-(--cf-text-3)" />
                      Read Next
                    </Link>
                    <Link
                      href="/book/notebook"
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-(--cf-text-2) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)"
                    >
                      <NotebookPen className="h-3.5 w-3.5 text-(--cf-text-3)" />
                      Notebook
                    </Link>
                    <Link
                      href="/book/settings"
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-(--cf-text-2) transition hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)"
                    >
                      <Settings className="h-3.5 w-3.5 text-(--cf-text-3)" />
                      Settings
                    </Link>
                    {isAdmin && (
                      <Link
                        href="/book/admin"
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-(--cf-accent) transition hover:bg-(--cf-accent-muted)"
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                        Admin dashboard
                      </Link>
                    )}
                  </div>
                  <div className="border-t border-(--cf-divider) mt-1 pt-1">
                    <button
                      type="button"
                      onClick={performLogout}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-(--cf-text-2) transition hover:bg-(--cf-danger-bg) hover:text-(--cf-danger-text)"
                    >
                      <LogOut className="h-3.5 w-3.5 text-(--cf-text-3)" />
                      Sign out
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Mobile search row */}
          {showSearch ? (
            <div className="relative mt-2.5 lg:hidden">
              <SearchBox
                ref={mobileSearchRef}
                value={searchQuery}
                onChange={onSearchChange}
                onFocus={() => {
                  searchInputRef.current = mobileSearchRef.current;
                  setShowSearchPanel(true);
                }}
                onKeyDown={onSearchKeyDown}
                placeholder={searchPlaceholder}
                expanded={showGlobalSearchPanel && showSearchPanel}
                controlsId="mobile-global-search-listbox"
                activeDescendantId={
                  searchActiveIndex >= 0 ? `mobile-gs-opt-${searchActiveIndex}` : undefined
                }
              />
              {showGlobalSearchPanel ? (
                <GlobalSearchPanel
                  open={showSearchPanel}
                  query={searchQuery}
                  onClose={() => setShowSearchPanel(false)}
                  idPrefix="mobile"
                  activeIndex={searchActiveIndex}
                  onResultsChange={setSearchResultHrefs}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {/* ── Mobile bottom tab bar (below the md tablet band) ── */}
      <nav aria-label="Primary, mobile" className="cf-topbar fixed bottom-0 left-0 right-0 z-40 bg-(--cf-page-bg) pb-safe md:hidden">
        <div className="flex items-stretch">
          {navItems.map((item) => {
            const active = item.id === activeTab;
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={[
                  "relative flex flex-1 flex-col items-center gap-1 px-1 py-3 text-[10px] font-semibold transition duration-150",
                  active
                    ? "text-(--cf-accent)"
                    : "text-(--cf-text-3) active:text-(--cf-text-1)",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 h-0.75 w-8 -translate-x-1/2 rounded-b-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong)" />
                )}
                <span className={[
                  "flex h-7 w-7 items-center justify-center rounded-xl transition",
                  active ? "bg-(--cf-accent-soft)" : "",
                ].join(" ")}>
                  <Icon className="h-4.5 w-4.5" />
                </span>
                {item.label}
              </Link>
            );
          })}
          {(() => {
            const moreActive = moreNavItems.some((i) => i.id === activeTab);
            return (
              <button
                type="button"
                onClick={() => setShowMoreSheet(true)}
                aria-haspopup="dialog"
                aria-expanded={showMoreSheet}
                aria-label="More"
                className={[
                  "relative flex flex-1 flex-col items-center gap-1 px-1 py-3 text-[10px] font-semibold transition duration-150",
                  moreActive
                    ? "text-(--cf-accent)"
                    : "text-(--cf-text-3) active:text-(--cf-text-1)",
                ].join(" ")}
              >
                {moreActive && (
                  <span className="absolute top-0 left-1/2 h-0.75 w-8 -translate-x-1/2 rounded-b-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong)" />
                )}
                <span className={[
                  "flex h-7 w-7 items-center justify-center rounded-xl transition",
                  moreActive ? "bg-(--cf-accent-soft)" : "",
                ].join(" ")}>
                  <MoreHorizontal className="h-4.5 w-4.5" />
                </span>
                More
              </button>
            );
          })()}
        </div>
      </nav>

      {/* Mobile "More" sheet — Journeys, Events + secondary destinations */}
      <Sheet
        open={showMoreSheet}
        onClose={() => setShowMoreSheet(false)}
        labelledBy="more-sheet-title"
      >
        <div className="p-3">
          <h2 id="more-sheet-title" className="px-2 pb-2 text-sm font-semibold text-(--cf-text-1)">
            More
          </h2>
          <nav aria-label="More navigation" className="flex flex-col gap-0.5">
            {moreNavItems.map((item) => {
              const active = item.id === activeTab;
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setShowMoreSheet(false)}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition",
                    active
                      ? "bg-(--cf-accent-soft) text-(--cf-accent)"
                      : "text-(--cf-text-2) hover:bg-(--cf-accent-muted) hover:text-(--cf-text-1)",
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </Sheet>
    </>
  );
}
