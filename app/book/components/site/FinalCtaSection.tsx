import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { landingContent } from "@/app/book/components/site/content";

type FinalCtaSectionProps = {
  signInHref: string;
};

export function FinalCtaSection({ signInHref }: FinalCtaSectionProps) {
  return (
    <section className="relative mx-auto max-w-7xl px-4 pb-14 sm:px-6 sm:pb-18 lg:px-8">
      <div className="cf-site-panel-strong overflow-hidden rounded-[36px] p-6 sm:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(580px_circle_at_16%_24%,rgba(56,189,248,0.15),transparent_42%),radial-gradient(520px_circle_at_84%_0%,rgba(94,234,212,0.14),transparent_40%)]" />

        <div className="relative grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/74">
              {landingContent.finalCta.eyebrow}
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-slate-50 sm:text-5xl">
              {landingContent.finalCta.title}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              {landingContent.finalCta.body}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Link
              href={signInHref}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(135deg,rgba(94,234,212,0.98),rgba(56,189,248,0.94))] px-5 py-3.5 text-base font-semibold text-slate-950 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/60"
            >
              Start free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={signInHref}
              className="inline-flex items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] px-5 py-3.5 text-base font-medium text-slate-100 transition hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/50"
            >
              Log in
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
