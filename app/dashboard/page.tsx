import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

import { ToolCard } from "@/components/dashboard/ToolCard";
import { dashboardTools } from "@/content/dashboard-tools";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";

export default async function DashboardToolPickerPage() {
  await requireDashboardAccess();

  return (
    <main className="cf-app-shell">
      <header className="mx-auto w-full max-w-6xl px-4 pb-3 pt-6 sm:px-6 sm:pt-8">
        <Link
          href="/"
          className="cf-btn cf-btn-secondary rounded-full px-3 py-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Portfolio
        </Link>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-4 sm:px-6 sm:pb-20 sm:pt-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-[var(--cf-accent-border)] bg-[var(--cf-accent-soft)] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--cf-accent)]">
            <Sparkles className="h-3.5 w-3.5 text-[var(--cf-accent)]" />
            Pick your tool
          </p>

          <h1 className="mt-5 text-4xl font-semibold tracking-tight text-[var(--cf-text-1)] sm:text-5xl md:text-6xl">
            What are you{" "}
            <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-amber-300 bg-clip-text text-transparent">
              working on today?
            </span>
          </h1>

          <p className="mt-4 text-base leading-relaxed text-[var(--cf-text-2)] sm:text-lg">
            Two focused tools, each built for a specific job. Tap to explore.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-2">
          {dashboardTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} />
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-[var(--cf-text-3)]">
          Click any card to enter the app <span aria-hidden="true">→</span>
        </p>
      </section>
    </main>
  );
}
