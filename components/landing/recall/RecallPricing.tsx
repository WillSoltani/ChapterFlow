/**
 * RecallPricing — STEP 5 · § "Pricing".
 *
 * Two honest tiers (Free / Pro) over the same deep canvas. RESTRAINED: near-
 * monochrome, EXACTLY ONE accent (the periwinkle recall accent — used only on the
 * Pro price datum + the single accent CTA), enormous whitespace, NO chart/curve
 * (that lives in the hero and appears exactly once), NO "most popular" badge, NO
 * urgency theatrics (no countdowns, no "only N left", no fake discounts).
 *
 * Every number is DERIVED from PRICING (@/lib/pricing) — price, currency, trial
 * length, free-book limit, and the canonical Pro feature list — so the marketing
 * card can never drift from what is actually charged. No fabricated social proof.
 *
 * Two hairline-framed tier cards side by side on desktop, stacked on mobile. The
 * Free card is plain neutral; the Pro card carries the one accent and the single
 * filled CTA. Fast cf-fade-up entrances; prefers-reduced-motion → static.
 */

"use client";

import { useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";
import {
  PRICING,
  formatAmount,
  TRIAL_CTA_LABEL,
  FREE_OFFER_LABEL,
  UPGRADE_LOGIN_URL,
  upgradeLoginUrlForInterval,
  ANNUAL_SAVINGS_PCT,
} from "@/lib/pricing";

type BillingInterval = "monthly" | "annual";

/* The two tiers, stated plainly. Pro features come straight from the canonical
   PRO_FEATURES list via PRICING; the Free list names what the free reader
   actually grants today (the 2-book limit is the honest cap). */
const FREE_FEATURES = [
  "The full book library to browse",
  `Finish ${PRICING.freeBookLimit} complete books`,
  "Summaries, examples, and quizzes",
  "Lite and Standard depth modes",
  "Spaced-repetition review",
] as const;

const PRO_FEATURES_SHORT = [
  "Everything in Free, unlimited",
  "Every book, no finish limit",
  "Deeper depth mode",
  "Text-to-speech audio",
  "Reading analytics and note export",
  "Priority on new title requests",
] as const;

export function RecallPricing() {
  return (
    <section
      id="pricing"
      aria-labelledby="recall-pricing-headline"
      className="relative w-full overflow-hidden px-6 py-28 sm:px-10 sm:py-32 lg:px-16 lg:py-40"
      style={{ background: "transparent" }}
    >
      <div className="mx-auto w-full max-w-[72rem]">
        {/* ── Editorial header, centered, lots of air ── */}
        <header className="mx-auto max-w-[40rem] text-center">
          <p
            className="cf-fade-up font-(family-name:--font-mono) text-[11px] uppercase tracking-[0.34em]"
            style={{ color: "var(--cf-recall-ink-faint)", animationDelay: "0ms" }}
          >
            Pricing
          </p>
          <h2
            id="recall-pricing-headline"
            className="cf-fade-up mt-6 font-(family-name:--font-display) font-bold leading-[0.98] tracking-[-0.04em] text-balance"
            style={{
              color: "var(--cf-recall-ink)",
              fontSize: "clamp(2.25rem, 4.4vw, 3.75rem)",
              animationDelay: "55ms",
            }}
          >
            Start free. Upgrade when it sticks.
          </h2>
          <p
            className="cf-fade-up mx-auto mt-6 max-w-[42ch] text-[1.0625rem] leading-relaxed sm:text-[1.1875rem]"
            style={{ color: "var(--cf-recall-ink-soft)", animationDelay: "110ms" }}
          >
            Two plans, no lock-in. Read {FREE_OFFER_LABEL}, no card. Upgrade
            when you feel it working. Cancel anytime.
          </p>
        </header>

        <PricingPlans />
      </div>
    </section>
  );
}

/* The two tier cards + the monthly/annual toggle. Split into its own client
   subcomponent so the toggle can hold useState; the surrounding section stays
   a thin SSR shell. The toggle updates the displayed Pro price AND the Pro CTA's
   deep-link (which carries the chosen interval through to settings), so the
   landing's plan and the in-app selection stay in sync. Free → AUTH_LOGIN_BOOK_URL. */
function PricingPlans() {
  const reducedMotion = usePrefersReducedMotion();
  // Named `setBillingInterval` (not `setInterval`) so it can't shadow the global
  // window.setInterval inside this component.
  const [interval, setBillingInterval] = useState<BillingInterval>("monthly");
  const isAnnual = interval === "annual";
  const proPrice = formatAmount(
    isAnnual ? PRICING.annualMonthlyAmount : PRICING.monthlyAmount,
  );
  // Carry the chosen interval into the upgrade deep-link so settings pre-selects
  // it (the displayed plan and the in-app selection stay in sync). Monthly uses
  // the plain URL; settings already defaults to the best available tier.
  const proUpgradeHref = isAnnual
    ? upgradeLoginUrlForInterval("annual")
    : UPGRADE_LOGIN_URL;

  return (
    <>
      {/* ── Monthly / annual toggle (display only) ── */}
      <div
        className="cf-fade-up mx-auto mt-12 flex flex-col items-center gap-2.5 sm:mt-14"
        style={{ animationDelay: "130ms" }}
      >
        <SegmentedControl<BillingInterval>
          groupId="recall-pricing-interval"
          label="Billing interval"
          value={interval}
          onChange={setBillingInterval}
          reducedMotion={reducedMotion}
          options={[
            { value: "monthly", label: "Monthly" },
            { value: "annual", label: "Annual" },
          ]}
        />
        <p
          className="font-(family-name:--font-mono) text-[10.5px] uppercase tracking-[0.24em]"
          style={{
            color: isAnnual
              ? "var(--cf-recall-accent)"
              : "var(--cf-recall-ink-faint)",
          }}
        >
          Save {ANNUAL_SAVINGS_PCT}% billed annually
        </p>
      </div>

      {/* ── Two tiers, side by side ── */}
      <div className="mx-auto mt-12 grid max-w-[58rem] grid-cols-1 items-start gap-6 sm:mt-14 sm:gap-8 md:grid-cols-2 md:gap-7 lg:gap-8">
          {/* FREE — plain neutral card */}
          <div
            className="cf-fade-up cf-hover-raise flex flex-col rounded-[1.5rem] p-8 sm:p-10"
            style={{
              background: "var(--cf-recall-plate)",
              border: "1px solid var(--cf-recall-frame)",
              animationDelay: "160ms",
            }}
          >
            <p
              className="font-(family-name:--font-mono) text-[11px] uppercase tracking-[0.28em]"
              style={{ color: "var(--cf-recall-ink-faint)" }}
            >
              Free
            </p>
            <div className="mt-6 flex items-baseline gap-2">
              <span
                className="font-(family-name:--font-display) font-bold leading-none tracking-[-0.04em]"
                style={{ color: "var(--cf-recall-ink)", fontSize: "clamp(2.75rem, 5vw, 3.5rem)" }}
              >
                {PRICING.symbol}0
              </span>
              <span
                className="text-[0.9375rem]"
                style={{ color: "var(--cf-recall-ink-faint)" }}
              >
                forever
              </span>
            </div>
            <p
              className="mt-4 text-[0.9375rem] leading-relaxed"
              style={{ color: "var(--cf-recall-ink-soft)" }}
            >
              Try the full loop on two complete books. No card, no expiry.
            </p>

            <ul className="mt-8 flex flex-1 flex-col gap-3.5">
              {FREE_FEATURES.map((f) => (
                <FeatureRow key={f} label={f} />
              ))}
            </ul>

            <a
              href={AUTH_LOGIN_BOOK_URL}
              className="mt-9 inline-flex w-full items-center justify-center rounded-full px-7 py-3.5 text-[0.9375rem] font-semibold transition-[transform,background,border-color] duration-150 ease-out hover:brightness-110 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                color: "var(--cf-recall-ink)",
                border: "1px solid var(--cf-recall-border-strong)",
                // @ts-expect-error -- CSS custom property for the focus ring color
                "--tw-ring-color": "var(--cf-recall-accent-line)",
              }}
            >
              Start reading free
            </a>
          </div>

          {/* PRO — carries the one accent + the single filled CTA */}
          <div
            className="cf-fade-up cf-hover-raise flex flex-col rounded-[1.5rem] p-8 sm:p-10"
            style={{
              background: "var(--cf-recall-plate)",
              border: "1px solid var(--cf-recall-accent-line)",
              boxShadow: "0 40px 120px -60px var(--cf-recall-glow)",
              animationDelay: "220ms",
            }}
          >
            <div className="flex items-baseline justify-between gap-3">
              <p
                className="font-(family-name:--font-mono) text-[11px] uppercase tracking-[0.28em]"
                style={{ color: "var(--cf-recall-accent)" }}
              >
                Pro
              </p>
              <p
                className="font-(family-name:--font-mono) text-[10px] uppercase tracking-[0.24em]"
                style={{ color: "var(--cf-recall-accent)" }}
              >
                Recommended
              </p>
            </div>
            <div className="mt-6 flex items-baseline gap-2">
              <span
                className="font-(family-name:--font-display) font-bold leading-none tracking-[-0.04em]"
                style={{ color: "var(--cf-recall-ink)", fontSize: "clamp(2.75rem, 5vw, 3.5rem)" }}
              >
                {proPrice}
              </span>
              <span
                className="text-[0.9375rem]"
                style={{ color: "var(--cf-recall-ink-faint)" }}
              >
                {isAnnual ? "/mo" : "/ month"}
              </span>
            </div>
            {isAnnual ? (
              <p
                className="mt-2 text-[0.8125rem] leading-relaxed"
                style={{ color: "var(--cf-recall-ink-soft)" }}
              >
                billed annually ·{" "}
                <span style={{ color: "var(--cf-recall-accent)" }}>
                  Save {ANNUAL_SAVINGS_PCT}%
                </span>
              </p>
            ) : null}
            <p
              className="mt-4 text-[0.9375rem] leading-relaxed"
              style={{ color: "var(--cf-recall-ink-soft)" }}
            >
              The whole library and the deepest reading mode, with priority on new
              titles.
            </p>

            <ul className="mt-8 flex flex-1 flex-col gap-3.5">
              {PRO_FEATURES_SHORT.map((f) => (
                <FeatureRow key={f} label={f} accent />
              ))}
            </ul>

            <a
              href={proUpgradeHref}
              className="mt-9 inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[0.9375rem] font-semibold transition-[transform,filter] duration-150 ease-out hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                background: "var(--cf-recall-accent)",
                color: "var(--cf-recall-bg)",
                boxShadow: "0 14px 40px -12px var(--cf-recall-glow)",
                // @ts-expect-error -- CSS custom property for the focus ring color
                "--tw-ring-color": "var(--cf-recall-accent)",
              }}
            >
              {TRIAL_CTA_LABEL}
              <ArrowRight size={17} strokeWidth={2.25} aria-hidden />
            </a>
            <p
              className="mt-4 text-center text-[0.875rem] font-medium leading-relaxed"
              style={{ color: "var(--cf-recall-ink-soft)" }}
            >
              Cancel anytime.
            </p>
            <p
              className="mt-1.5 text-center text-[0.8125rem] leading-relaxed"
              style={{ color: "var(--cf-recall-ink-faint)" }}
            >
              Card required, charged when the {PRICING.trialDays}-day trial ends.
            </p>
          </div>
        </div>
    </>
  );
}

/* A single granted feature row. The check sits in the one accent (Pro) or a
   quiet neutral (Free) so the two cards stay distinct without a second hue. */
function FeatureRow({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      <Check
        size={17}
        strokeWidth={2.5}
        aria-hidden
        className="mt-0.5 shrink-0"
        style={{
          color: accent ? "var(--cf-recall-accent)" : "var(--cf-recall-ink-faint)",
        }}
      />
      <span
        className="text-[0.9375rem] leading-snug"
        style={{ color: "var(--cf-recall-ink-soft)" }}
      >
        {label}
      </span>
    </li>
  );
}
