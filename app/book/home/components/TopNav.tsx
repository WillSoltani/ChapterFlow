"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  ChevronDown,
  Home,
  LayoutGrid,
  Settings,
  Shield,
  TrendingUp,
  User,
} from "lucide-react";
import { SearchBox } from "@/app/book/home/components/SearchBox";
import { GlobalSearchPanel } from "@/app/book/home/components/GlobalSearchPanel";
import { useKeyboardShortcut } from "@/app/book/hooks/useKeyboardShortcut";
import { ChapterFlowMark } from "@/app/book/components/ChapterFlowMark";

export type BookNavTab = "home" | "library" | "saved" | "progress" | "badges" | "settings" | "profile";

type TopNavProps = {
  name: string;
  activeTab: BookNavTab;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchInputRef: MutableRefObject<HTMLInputElement | null>;
  showSearch?: boolean;
  searchPlaceholder?: string;
  showGlobalSearchPanel?: boolean;
};

const navItems: Array<{
  id: BookNavTab;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "home", label: "Home", href: "/book/workspace", icon: Home },
  { id: "library", label: "Library", href: "/book/library", icon: LayoutGrid },
  { id: "progress", label: "Progress", href: "/book/progress", icon: TrendingUp },
  { id: "badges", label: "Badges", href: "/book/badges", icon: Shield },
];

export function TopNav({
  name,
  activeTab,
  searchQuery,
  onSearchChange,
  searchInputRef,
  showSearch = true,
  searchPlaceholder,
  showGlobalSearchPanel = true,
}: TopNavProps) {
  const pathname = usePathname();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(false);

  const headerRef = useRef<HTMLDivElement | null>(null);
  const desktopSearchRef = useRef<HTMLInputElement | null>(null);
  const mobileSearchRef = useRef<HTMLInputElement | null>(null);

  const initial = name.trim().charAt(0).toUpperCase() || "R";

  const focusSearchInput = () => {
    const preferMobile = window.matchMedia("(max-width: 767px)").matches;
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
  }, [pathname]);

  useEffect(() => {
    if (!showGlobalSearchPanel) {
      setShowSearchPanel(false);
      return;
    }
    setShowSearchPanel(searchQuery.trim().length > 0);
  }, [searchQuery, showGlobalSearchPanel]);

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
      {/* ── Top header ── */}
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#060a15]/90 backdrop-blur-xl">
        <div ref={headerRef} className="mx-auto w-full max-w-7xl px-4 py-2.5 sm:px-6">
          <div className="flex items-center justify-between gap-3">

            {/* Logo */}
            <Link href="/book/workspace" className="shrink-0 flex items-center gap-2.5">
              <ChapterFlowMark compact />
            </Link>

            {/* Desktop nav — hidden on mobile (use bottom tab bar instead) */}
            <nav className="hidden items-center gap-0.5 md:flex">
              {navItems.map((item) => {
                const active = item.id === activeTab;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={[
                      "relative inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium transition duration-150",
                      active
                        ? "bg-sky-500/16 text-sky-100"
                        : "text-slate-400 hover:bg-white/6 hover:text-slate-200",
                    ].join(" ")}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className={active ? "h-3.5 w-3.5 text-sky-300" : "h-3.5 w-3.5"} />
                    {item.label}
                    {active && (
                      <span className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-sky-400" />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop search */}
            {showSearch ? (
              <div className="relative hidden flex-1 justify-center px-4 md:flex">
                <SearchBox
                  ref={desktopSearchRef}
                  value={searchQuery}
                  onChange={onSearchChange}
                  onFocus={() => {
                    searchInputRef.current = desktopSearchRef.current;
                    setShowSearchPanel(true);
                  }}
                  placeholder={searchPlaceholder}
                />
                {showGlobalSearchPanel ? (
                  <GlobalSearchPanel
                    open={showSearchPanel}
                    query={searchQuery}
                    onClose={() => setShowSearchPanel(false)}
                  />
                ) : null}
              </div>
            ) : (
              <div className="hidden flex-1 md:block" />
            )}

            {/* Right: settings + profile */}
            <div className="relative flex items-center gap-1.5">
              <Link
                href="/book/settings"
                className={[
                  "hidden h-9 w-9 items-center justify-center rounded-xl border transition hover:bg-white/8 md:inline-flex",
                  activeTab === "settings"
                    ? "border-sky-300/35 bg-sky-500/16 text-sky-100"
                    : "border-white/12 bg-white/4 text-slate-400 hover:text-slate-200",
                ].join(" ")}
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </Link>

              <Link
                href="/book/profile"
                className={[
                  "inline-flex h-9 items-center gap-2 rounded-xl border px-2.5 transition hover:bg-white/8",
                  activeTab === "profile"
                    ? "border-sky-300/35 bg-sky-500/16 text-sky-100"
                    : "border-white/12 bg-white/4 text-slate-200",
                ].join(" ")}
                aria-label="Profile"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-linear-to-br from-sky-400 to-cyan-300 text-xs font-bold text-slate-900 shadow-[0_0_10px_rgba(56,189,248,0.35)]">
                  {initial}
                </span>
                <span className="hidden text-sm font-medium md:inline-flex">{name || "Reader"}</span>
              </Link>

              <button
                type="button"
                onClick={() => setShowProfileMenu((prev) => !prev)}
                className={[
                  "inline-flex h-9 w-9 items-center justify-center rounded-xl border transition hover:bg-white/8",
                  activeTab === "profile"
                    ? "border-sky-300/35 bg-sky-500/16 text-sky-100"
                    : "border-white/12 bg-white/4 text-slate-400 hover:text-slate-200",
                ].join(" ")}
                aria-label="Open profile menu"
                aria-expanded={showProfileMenu}
              >
                <ChevronDown className="h-4 w-4" />
              </button>

              {showProfileMenu ? (
                <div className="absolute right-0 top-11 w-56 rounded-2xl border border-white/12 bg-[#0b1020]/98 p-2 shadow-[0_24px_50px_rgba(2,6,23,0.65)] backdrop-blur-md">
                  <div className="border-b border-white/8 px-3 py-2.5">
                    <p className="text-sm font-semibold text-slate-100">{name || "Reader"}</p>
                    <p className="text-xs text-slate-400">ChapterFlow</p>
                  </div>
                  <div className="mt-1 space-y-0.5">
                    <Link
                      href="/book/profile"
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-300 transition hover:bg-white/6 hover:text-slate-100"
                    >
                      <User className="h-3.5 w-3.5 text-slate-400" />
                      Profile
                    </Link>
                    <Link
                      href="/book/saved"
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-300 transition hover:bg-white/6 hover:text-slate-100"
                    >
                      <Bookmark className="h-3.5 w-3.5 text-slate-400" />
                      Read Next
                    </Link>
                    <Link
                      href="/book/settings"
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-slate-300 transition hover:bg-white/6 hover:text-slate-100"
                    >
                      <Settings className="h-3.5 w-3.5 text-slate-400" />
                      Settings
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Mobile search row */}
          {showSearch ? (
            <div className="relative mt-2.5 md:hidden">
              <SearchBox
                ref={mobileSearchRef}
                value={searchQuery}
                onChange={onSearchChange}
                onFocus={() => {
                  searchInputRef.current = mobileSearchRef.current;
                  setShowSearchPanel(true);
                }}
                placeholder={searchPlaceholder}
              />
              {showGlobalSearchPanel ? (
                <GlobalSearchPanel
                  open={showSearchPanel}
                  query={searchQuery}
                  onClose={() => setShowSearchPanel(false)}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {/* ── Mobile bottom tab bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.07] bg-[#060a15]/95 pb-safe backdrop-blur-xl md:hidden">
        <div className="flex items-stretch">
          {navItems.map((item) => {
            const active = item.id === activeTab;
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={[
                  "flex flex-1 flex-col items-center gap-1 px-1 py-3 text-[10px] font-semibold transition duration-150",
                  active ? "text-sky-300" : "text-slate-500 active:text-slate-300",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                <span className={[
                  "flex h-6 w-6 items-center justify-center rounded-lg transition",
                  active ? "bg-sky-500/20" : "",
                ].join(" ")}>
                  <Icon className="h-4 w-4" />
                </span>
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/book/settings"
            className={[
              "flex flex-1 flex-col items-center gap-1 px-1 py-3 text-[10px] font-semibold transition duration-150",
              activeTab === "settings" ? "text-sky-300" : "text-slate-500 active:text-slate-300",
            ].join(" ")}
          >
            <span className={[
              "flex h-6 w-6 items-center justify-center rounded-lg transition",
              activeTab === "settings" ? "bg-sky-500/20" : "",
            ].join(" ")}>
              <Settings className="h-4 w-4" />
            </span>
            Settings
          </Link>
        </div>
      </nav>
    </>
  );
}
