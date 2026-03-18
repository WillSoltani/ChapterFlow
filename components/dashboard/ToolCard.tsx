import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  Files,
  Sparkles,
} from "lucide-react";
import type { DashboardTool } from "@/content/dashboard-tools";

const accentStyles = {
  sky: {
    border: "group-hover:border-sky-300/40 group-focus-visible:border-sky-300/45",
    ring: "focus-visible:ring-sky-300/45",
    iconWrap: "border-sky-300/50 bg-sky-50 text-sky-600 dark:border-sky-300/25 dark:bg-sky-500/12 dark:text-sky-200",
    glow:
      "from-sky-400/10 via-sky-400/3 to-transparent group-hover:from-sky-300/16 dark:from-sky-400/16 dark:group-hover:from-sky-300/22",
    category: "text-sky-600/80 dark:text-sky-200/80",
    bullet: "text-sky-500 dark:text-sky-300/95",
    cta: "from-sky-500/95 via-sky-500/90 to-cyan-400/90",
    chip:
      "border-sky-300/50 bg-sky-50 text-sky-700 group-hover:bg-sky-100 dark:border-sky-300/35 dark:bg-sky-400/14 dark:text-sky-100 dark:group-hover:bg-sky-400/20",
  },
  amber: {
    border:
      "group-hover:border-amber-300/40 group-focus-visible:border-amber-300/45",
    ring: "focus-visible:ring-amber-300/45",
    iconWrap: "border-amber-400/50 bg-amber-50 text-amber-600 dark:border-amber-300/25 dark:bg-amber-400/12 dark:text-amber-200",
    glow:
      "from-amber-300/10 via-amber-300/3 to-transparent group-hover:from-amber-300/18 dark:from-amber-300/16 dark:group-hover:from-amber-300/24",
    category: "text-amber-600/80 dark:text-amber-200/80",
    bullet: "text-amber-500 dark:text-amber-300/95",
    cta: "from-amber-400/95 via-amber-400/90 to-orange-400/90",
    chip:
      "border-amber-400/50 bg-amber-50 text-amber-700 group-hover:bg-amber-100 dark:border-amber-300/35 dark:bg-amber-400/14 dark:text-amber-100 dark:group-hover:bg-amber-400/22",
  },
} as const;

function ToolIcon({ icon }: { icon: DashboardTool["icon"] }) {
  if (icon === "book") return <BookOpenCheck className="h-6 w-6" aria-hidden="true" />;
  return <Files className="h-6 w-6" aria-hidden="true" />;
}

export function ToolCard({ tool }: { tool: DashboardTool }) {
  const accent = accentStyles[tool.accent];

  return (
    <Link
      href={tool.href}
      aria-label={`${tool.title} — ${tool.ctaLabel}`}
      className={[
        "cf-panel cf-panel-hover group relative isolate block overflow-hidden rounded-[28px] px-6 py-6 sm:px-7 sm:py-7",
        "transition-all duration-200 ease-out",
        "active:translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
        accent.border,
        accent.ring,
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none absolute inset-0 -z-10 bg-radial-[120%_95%_at_10%_0%] transition-opacity duration-200",
          accent.glow,
        ].join(" ")}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(140%_100%_at_100%_0%,rgba(255,255,255,0.07),transparent_60%)] opacity-60"
      />

      <div className="flex items-start justify-between gap-4">
        <div
          className={[
            "inline-flex h-12 w-12 items-center justify-center rounded-2xl border shadow-[0_0_0_1px_rgba(255,255,255,0.02)]",
            accent.iconWrap,
          ].join(" ")}
        >
          <ToolIcon icon={tool.icon} />
        </div>
        <span
          className={[
            "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold",
            "opacity-0 translate-y-1 transition-all duration-200",
            "group-hover:translate-y-0 group-hover:opacity-100",
            "group-focus-visible:translate-y-0 group-focus-visible:opacity-100",
            accent.chip,
          ].join(" ")}
        >
          {tool.openLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>

      <p
        className={[
          "mt-6 text-[11px] font-semibold uppercase tracking-[0.2em]",
          accent.category,
        ].join(" ")}
      >
        {tool.category}
      </p>

      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-(--cf-text-1)">
        {tool.title}
      </h2>

      <p className="mt-3 text-sm leading-relaxed text-(--cf-text-2)">{tool.description}</p>

      <ul className="mt-5 space-y-2.5">
        {tool.bullets.map((bullet) => (
          <li key={bullet} className="flex items-center gap-2.5 text-sm text-(--cf-text-2)">
            <CheckCircle2 className={["h-4 w-4", accent.bullet].join(" ")} aria-hidden="true" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>

      <span
        className={[
          "mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white",
          "shadow-[0_14px_30px_rgba(2,132,199,0.22)] transition duration-200",
          "group-hover:brightness-105 group-active:brightness-95",
          `bg-linear-to-r ${accent.cta}`,
        ].join(" ")}
      >
        {tool.ctaLabel}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-6 top-6 text-slate-400/35 dark:text-slate-500/35"
      >
        <Sparkles className="h-5 w-5" />
      </span>
    </Link>
  );
}
