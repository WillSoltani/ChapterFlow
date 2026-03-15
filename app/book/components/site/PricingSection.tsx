import Link from "next/link";
import { Check } from "lucide-react";
import { SectionHeading } from "@/app/book/components/site/SectionHeading";
import { landingContent } from "@/app/book/components/site/content";
import { cn } from "@/app/book/components/ui/cn";

type PricingSectionProps = {
  signInHref: string;
};

export function PricingSection({ signInHref }: PricingSectionProps) {
  return (
    <section
      id="pricing"
      className="relative mx-auto max-w-7xl px-4 pb-18 sm:px-6 sm:pb-24 lg:px-8"
    >
      <SectionHeading
        eyebrow={landingContent.pricing.eyebrow}
        title={landingContent.pricing.title}
        body={landingContent.pricing.body}
        align="center"
      />

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {landingContent.pricing.plans.map((plan) => (
          <article
            key={plan.name}
            className={cn(
              "rounded-[32px] p-6 sm:p-7",
              plan.featured
                ? "border border-cyan-300/22 bg-[linear-gradient(135deg,rgba(56,189,248,0.14),rgba(94,234,212,0.08))] shadow-[0_28px_80px_rgba(45,212,191,0.16)]"
                : "cf-site-panel"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-cyan-100/76">
                  {plan.name}
                </p>
                <div className="mt-4 flex items-end gap-2">
                  <h3 className="text-4xl font-semibold tracking-tight text-slate-50">
                    {plan.price}
                  </h3>
                  {plan.cadence ? (
                    <span className="pb-1 text-sm text-slate-300">{plan.cadence}</span>
                  ) : null}
                </div>
              </div>

              {plan.featured ? (
                <span className="rounded-full border border-cyan-300/22 bg-cyan-400/12 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-50">
                  Best depth
                </span>
              ) : null}
            </div>

            <p className="mt-4 text-sm leading-7 text-slate-300">{plan.summary}</p>

            <div className="mt-6 space-y-3">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-start gap-3 text-sm text-slate-200">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-500/10 text-emerald-200">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            <Link
              href={signInHref}
              className={cn(
                "mt-7 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2",
                plan.featured
                  ? "bg-[linear-gradient(135deg,rgba(94,234,212,0.98),rgba(56,189,248,0.94))] text-slate-950 hover:brightness-105 focus-visible:ring-cyan-200/60"
                  : "border border-white/12 bg-white/[0.04] text-slate-100 hover:bg-white/[0.08] focus-visible:ring-cyan-300/50"
              )}
            >
              {plan.ctaLabel}
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
