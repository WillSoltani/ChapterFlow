"use client";

import { JetBrains_Mono } from "next/font/google";
import { DashboardNavbar } from "./DashboardNavbar";
import { GreetingRow } from "./GreetingRow";
import { HeroBookCard } from "./HeroBookCard";
import { StatsRow } from "./StatsRow";
import { MomentumCard } from "./MomentumCard";
import { BookShelf } from "./BookShelf";
import { AchievementsPreview } from "./AchievementsPreview";

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

/* ── Mock data (will be replaced with real data later) ── */
const currentBook = {
  title: "Deep Work",
  author: "Cal Newport",
  chapter: 4,
  totalChapters: 12,
  progress: 33,
  gradient: "linear-gradient(135deg, #2563EB, #1E40AF)",
};

/* ── Mobile bottom nav ── */
function MobileBottomNav() {
  const tabs = [
    { label: "Home", icon: HomeIcon, active: true },
    { label: "Library", icon: LibraryIcon, active: false },
    { label: "Progress", icon: ProgressIcon, active: false },
    { label: "Profile", icon: ProfileIcon, active: false },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around md:hidden"
      style={{
        background: "var(--cf-topbar-bg)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.label}
          className="flex cursor-pointer flex-col items-center gap-1"
        >
          <tab.icon active={tab.active} />
          <span
            className="text-[10px]"
            style={{
              color: tab.active ? "var(--text-heading)" : "var(--text-muted)",
            }}
          >
            {tab.label}
          </span>
        </button>
      ))}
    </nav>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "var(--accent-blue)" : "var(--text-muted)"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
    </svg>
  );
}

function LibraryIcon({ active }: { active: boolean }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "var(--accent-blue)" : "var(--text-muted)"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
    </svg>
  );
}

function ProgressIcon({ active }: { active: boolean }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "var(--accent-blue)" : "var(--text-muted)"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? "var(--accent-blue)" : "var(--text-muted)"}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx={12} cy={7} r={4} />
    </svg>
  );
}

/* ── Main Dashboard Page ── */
export function DashboardPage() {
  return (
    <div
      className={`relative min-h-screen ${jetBrainsMono.variable}`}
      style={{ background: "var(--bg-base)" }}
    >
      {/* Background atmosphere — gradient mesh */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background: [
            "radial-gradient(ellipse 600px 400px at 65% 15%, var(--cf-accent-muted) 0%, transparent 100%)",
            "radial-gradient(ellipse 400px 300px at 20% 70%, var(--cf-warm-soft) 0%, transparent 100%)",
          ].join(", "),
        }}
      />

      {/* Noise texture overlay */}
      <div className="noise-overlay pointer-events-none fixed inset-0 z-0" />

      {/* Content */}
      <div className="relative z-10">
        <DashboardNavbar />

        <main
          className="mx-auto w-full px-4 py-5 md:px-7 md:py-7"
          style={{ maxWidth: 1080 }}
        >
          <GreetingRow />
          <HeroBookCard book={currentBook} />
          <StatsRow />
          <MomentumCard />
          <BookShelf />
          <AchievementsPreview />

          {/* Bottom spacer for mobile nav */}
          <div className="h-20 md:hidden" />
        </main>

        <MobileBottomNav />
      </div>
    </div>
  );
}
