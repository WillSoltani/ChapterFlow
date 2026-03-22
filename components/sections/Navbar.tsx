"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

/* ── Logo Icon ─────────────────────────────────────── */

function LogoIcon({ size = 28 }: { size?: number }) {
  const gradientId = `cfGrad_${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient
          id={gradientId}
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
      <rect width="32" height="32" rx="8" fill={`url(#${gradientId})`} />
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
      <rect x="14" y="7" width="11" height="15" rx="2" fill="white" opacity="0.9" />
      <line
        x1="16.5"
        y1="11"
        x2="22.5"
        y2="11"
        stroke={`url(#${gradientId})`}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />
      <line
        x1="16.5"
        y1="13.5"
        x2="21"
        y2="13.5"
        stroke={`url(#${gradientId})`}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.35"
      />
      <line
        x1="16.5"
        y1="16"
        x2="19.5"
        y2="16"
        stroke={`url(#${gradientId})`}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.2"
      />
    </svg>
  );
}

/* ── Data ──────────────────────────────────────────── */

const NAV_LINKS = [
  { id: "how-it-works", label: "How it works" },
  { id: "library", label: "Library" },
  { id: "pricing", label: "Pricing" },
] as const;

const AUTH_URL = "/auth/login?returnTo=%2Fbook";

/* ── Component ─────────────────────────────────────── */

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

  const linkIds = useMemo(() => NAV_LINKS.map((l) => l.id), []);

  /* ── Scroll detection (100px threshold) ────────── */

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 100);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ── Close mobile menu on resize to desktop ─────── */

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ── Lock body scroll when mobile menu open ─────── */

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  /* ── IntersectionObserver for active section ─────── */

  useEffect(() => {
    const elements = linkIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0),
          )[0];

        if (visible?.target?.id) {
          setActiveSection(visible.target.id);
        }
      },
      { threshold: 0.15, rootMargin: "-10% 0px -70% 0px" },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [linkIds]);

  /* ── Handlers ───────────────────────────────────── */

  const handleNavClick = useCallback((id: string) => {
    setActiveSection(id);
    setMobileOpen(false);
  }, []);

  const toggleMobile = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
  }, []);

  return (
    <>
      {/* ── Header ──────────────────────────────── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={
          scrolled
            ? {
                background: "color-mix(in srgb, var(--bg-base) 80%, transparent)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                borderBottom: "1px solid var(--border-subtle)",
              }
            : {
                background: "transparent",
                borderBottom: "1px solid transparent",
              }
        }
      >
        <nav className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4">
          {/* ── Logo ────────────────────────────── */}
          <Link href="/" className="flex items-center gap-2">
            <LogoIcon />
            <span className="font-(family-name:--font-display) text-[18px] font-semibold text-(--text-heading)">
              ChapterFlow
            </span>
          </Link>

          {/* ── Desktop center links ────────────── */}
          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  onClick={() => handleNavClick(link.id)}
                  className={`relative font-(family-name:--font-body) text-[14px] font-medium transition-colors duration-200 ${
                    isActive
                      ? "text-(--text-heading)"
                      : "text-(--text-secondary) hover:text-(--text-heading)"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <motion.span
                      layoutId="nav-active-dot"
                      className="absolute -bottom-2.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-(--accent-teal)"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 30,
                      }}
                    />
                  )}
                </a>
              );
            })}
          </div>

          {/* ── Desktop right actions ───────────── */}
          <div className="hidden items-center gap-4 md:flex">
            <a
              href={AUTH_URL}
              className="font-(family-name:--font-body) text-[14px] font-medium text-(--text-secondary) transition-colors duration-200 hover:text-(--text-heading)"
            >
              Sign in
            </a>
            <a
              href={AUTH_URL}
              className="rounded-full bg-(--accent-teal) px-5 py-2 font-(family-name:--font-body) text-[13px] font-semibold text-[#0a0f1a] transition-all duration-200 hover:brightness-110 hover:shadow-[0_0_16px_rgba(45,212,191,0.4)]"
            >
              Start free &rarr;
            </a>
          </div>

          {/* ── Mobile hamburger ────────────────── */}
          <button
            type="button"
            className="relative flex h-8 w-8 flex-col items-center justify-center gap-[5px] md:hidden"
            onClick={toggleMobile}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            <span
              className="block h-[2px] w-5 rounded-full bg-(--text-heading) transition-all duration-300"
              style={{
                transform: mobileOpen
                  ? "translateY(7px) rotate(45deg)"
                  : "none",
              }}
            />
            <span
              className="block h-[2px] w-5 rounded-full bg-(--text-heading) transition-all duration-300"
              style={{
                opacity: mobileOpen ? 0 : 1,
              }}
            />
            <span
              className="block h-[2px] w-5 rounded-full bg-(--text-heading) transition-all duration-300"
              style={{
                transform: mobileOpen
                  ? "translateY(-7px) rotate(-45deg)"
                  : "none",
              }}
            />
          </button>
        </nav>
      </header>

      {/* ── Mobile overlay ──────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[49] flex flex-col items-center justify-center md:hidden"
            style={{
              background: "color-mix(in srgb, var(--bg-base) 98%, transparent)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
            }}
          >
            {/* Mobile nav links — centered */}
            <nav className="flex flex-col items-center gap-8">
              {NAV_LINKS.map((link, i) => {
                const isActive = activeSection === link.id;
                return (
                  <motion.a
                    key={link.id}
                    href={`#${link.id}`}
                    onClick={() => handleNavClick(link.id)}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.08, duration: 0.3 }}
                    className={`relative font-(family-name:--font-body) text-[24px] font-medium transition-colors duration-200 ${
                      isActive
                        ? "text-(--text-heading)"
                        : "text-(--text-secondary)"
                    }`}
                  >
                    {link.label}
                    {isActive && (
                      <span className="absolute -bottom-2 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-(--accent-teal)" />
                    )}
                  </motion.a>
                );
              })}
            </nav>

            {/* Mobile CTA — at bottom */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: 0.1 + NAV_LINKS.length * 0.08,
                duration: 0.3,
              }}
              className="mt-12 flex flex-col items-center gap-4"
            >
              <a
                href={AUTH_URL}
                className="font-(family-name:--font-body) text-[16px] font-medium text-(--text-secondary) transition-colors duration-200 hover:text-(--text-heading)"
                onClick={closeMobile}
              >
                Sign in
              </a>
              <a
                href={AUTH_URL}
                className="rounded-full bg-(--accent-teal) px-7 py-3 font-(family-name:--font-body) text-[15px] font-semibold text-[#0a0f1a] transition-all duration-200 hover:brightness-110"
                onClick={closeMobile}
              >
                Start free &rarr;
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
