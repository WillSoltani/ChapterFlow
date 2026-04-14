"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  BookOpen,
  Coins,
  FileCheck2,
  Flag,
  Gauge,
  LayoutDashboard,
  LineChart,
  Radio,
  Settings2,
  ShieldAlert,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  group: "core" | "analytics" | "ops";
};

const NAV: NavItem[] = [
  { href: "/book/admin", label: "Overview", icon: LayoutDashboard, group: "core" },
  { href: "/book/admin/live", label: "Live activity", icon: Radio, group: "core" },
  { href: "/book/admin/users", label: "Users", icon: Users, group: "core" },
  { href: "/book/admin/growth", label: "Growth", icon: LineChart, group: "analytics" },
  { href: "/book/admin/engagement", label: "Engagement", icon: Activity, group: "analytics" },
  { href: "/book/admin/revenue", label: "Revenue", icon: Wallet, group: "analytics" },
  { href: "/book/admin/economy", label: "Economy", icon: Coins, group: "analytics" },
  { href: "/book/admin/content", label: "Content", icon: BookOpen, group: "analytics" },
  { href: "/book/admin/scenarios", label: "Scenario queue", icon: FileCheck2, group: "ops" },
  { href: "/book/admin/moderation", label: "Moderation", icon: ShieldAlert, group: "ops" },
  { href: "/book/admin/events", label: "Events", icon: Sparkles, group: "ops" },
  { href: "/book/admin/ops", label: "Ops & health", icon: Gauge, group: "ops" },
];

const GROUP_LABELS: Record<NavItem["group"], string> = {
  core: "Today",
  analytics: "Analytics",
  ops: "Operations",
};

export function AdminShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail?: string;
}) {
  const pathname = usePathname();

  const groups = (["core", "analytics", "ops"] as const).map((g) => ({
    group: g,
    items: NAV.filter((n) => n.group === g),
  }));

  return (
    <div className="flex min-h-screen bg-(--cf-page-bg) text-(--cf-text-1)">
      {/* Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-(--cf-border) bg-(--cf-surface) md:flex">
        <div className="flex items-center gap-2 border-b border-(--cf-border) px-5 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--cf-accent)/15 text-(--cf-accent)">
            <Settings2 className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-(--cf-text-1)">Admin</p>
            <p className="text-[11px] text-(--cf-text-3)">ChapterFlow</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {groups.map(({ group, items }) => (
            <div key={group} className="mb-5">
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-(--cf-text-soft)">
                {GROUP_LABELS[group]}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active =
                    item.href === "/book/admin"
                      ? pathname === "/book/admin"
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={[
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition",
                          active
                            ? "bg-(--cf-accent)/15 text-(--cf-accent) font-semibold"
                            : "text-(--cf-text-2) hover:bg-(--cf-surface-muted) hover:text-(--cf-text-1)",
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-(--cf-border) px-4 py-3">
          <p className="text-[11px] text-(--cf-text-3) truncate" title={userEmail}>
            {userEmail ?? "Signed in"}
          </p>
          <Link
            href="/book/home"
            className="mt-1 inline-block text-[11px] text-(--cf-accent) hover:underline"
          >
            ← Back to app
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden">
        <MobileNav pathname={pathname} userEmail={userEmail} groups={groups} />
      </div>

      {/* Content */}
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto max-w-[1400px] px-4 pb-16 pt-7 sm:px-6 sm:pt-8 md:px-10 md:pb-20 lg:px-12">
          {children}
        </div>
      </main>
    </div>
  );
}

function MobileNav({
  pathname,
  userEmail,
  groups,
}: {
  pathname: string;
  userEmail?: string;
  groups: Array<{ group: "core" | "analytics" | "ops"; items: NavItem[] }>;
}) {
  const current = NAV.find((n) =>
    n.href === "/book/admin" ? pathname === "/book/admin" : pathname.startsWith(n.href),
  );

  return (
    <div className="sticky top-0 z-30 border-b border-(--cf-border) bg-(--cf-surface) px-4 py-3">
      <details className="group">
        <summary className="flex cursor-pointer items-center justify-between gap-2 list-none">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-(--cf-accent)" aria-hidden="true" />
            <span className="text-[14px] font-semibold">{current?.label ?? "Admin"}</span>
          </div>
          <span className="text-[11px] text-(--cf-text-3) group-open:hidden">Tap to switch</span>
          <span className="text-[11px] text-(--cf-text-3) hidden group-open:inline">Close</span>
        </summary>
        <nav className="mt-3 space-y-3">
          {groups.map(({ group, items }) => (
            <div key={group}>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-(--cf-text-soft)">
                {GROUP_LABELS[group]}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.href === "/book/admin"
                      ? pathname === "/book/admin"
                      : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={[
                          "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px]",
                          active
                            ? "bg-(--cf-accent)/15 text-(--cf-accent) font-semibold"
                            : "text-(--cf-text-2)",
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="border-t border-(--cf-border) pt-2">
            <p className="text-[11px] text-(--cf-text-3) truncate">{userEmail ?? "Signed in"}</p>
            <Link href="/book/home" className="text-[11px] text-(--cf-accent) hover:underline">
              ← Back to app
            </Link>
          </div>
        </nav>
      </details>
    </div>
  );
}
