"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { m, AnimatePresence } from "framer-motion";
import { Check, Minus, ChevronDown } from "lucide-react";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { AUTH_LOGIN_BOOK_URL } from "@/app/_lib/chapterflow-brand";
import { track } from "@/lib/analytics";
import { useAuthStatus } from "@/components/auth/useAuthStatus";
import {
  PRICING,
  ANNUAL_SAVINGS_PCT,
  formatAmount,
  TRIAL_CTA_LABEL,
  FREE_OFFER_LABEL,
  UPGRADE_RETURN_PATH,
  UPGRADE_LOGIN_URL,
  PRICING_TIER_DISPLAY,
  PRO_FEATURES,
} from "@/lib/pricing";

/**
 * §05 Pricing — the TERMS SHEET.
 *
 * Not a centered SaaS pricing block: a left-aligned spec sheet matching the
 * Ledger / CatalogIndex / Science panels. A §05 SectionLabel + mono running-head,
 * the two tiers as hairline-ruled spec rows on a flat --cf-surface panel (no
 * floating glassy scale cards, no glow halos), prices in mono tabular datum style,
 * benefit/exclusion chips inline. ONE accent — cyan — for the work; the Pro CTA is
 * the same cyan as the hero/science CTAs (no gold/amber gradient, no second hue).
 */

/* ---- terms-sheet benefit chips — Lucide raw, color via text-(--cf-*) -------- */

function GrantedIcon() {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-(--accent-cyan)/15 text-(--accent-cyan)">
      <Check size={11} strokeWidth={2.5} aria-hidden />
    </span>
  );
}

function ExcludedIcon() {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-(--text-muted)/10 text-(--text-muted)">
      <Minus size={10} strokeWidth={2.5} aria-hidden />
    </span>
  );
}

/* ---- FAQ data -------------------------------------------------------------- */

const faqs = [
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes — cancel anytime from your account settings, with no penalties or lock-in. Cancel during your 14-day free trial and you won't be charged. Cancel after, and your Pro access continues until the end of the period you've already paid for; the remaining time isn't refunded.",
  },
  {
    question: `What happens after my ${PRICING.freeBookLimit} free books?`,
    answer:
      "You can still browse summaries and access your completed books. To unlock new books, upgrade to Pro.",
  },
  {
    question: "Do you add new books?",
    answer:
      "Yes. We add new titles regularly. Pro members can request specific books and get priority additions.",
  },
  {
    question: "Is there a mobile app?",
    answer:
      "ChapterFlow works beautifully on any device through your browser. A dedicated mobile app is on the roadmap.",
  },
];

/* ---- a tier as a spec row -------------------------------------------------- */

type TierFeature = { label: string; granted: boolean };

function TierRow({
  call,
  name,
  price,
  unit,
  subline,
  blurb,
  features,
  accent,
  cta,
  terms,
}: {
  call: string;
  name: string;
  price: string;
  unit: string;
  subline?: ReactNode;
  blurb: string;
  features: TierFeature[];
  accent: boolean;
  cta: ReactNode;
  terms?: ReactNode;
}) {
  return (
    <div
      className="grid grid-cols-1 gap-6 px-6 py-8 md:grid-cols-[minmax(0,18rem)_1fr] md:gap-10 md:px-9 md:py-9"
      style={{ background: "var(--cf-surface)" }}
    >
      {/* LEFT — call number, name, price datum */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span
            className="cf-folio tabular-nums"
            style={{ color: accent ? "var(--accent-cyan)" : "var(--cf-axis-tint)" }}
          >
            {call}
          </span>
          <span
            className="cf-folio"
            style={{ color: accent ? "var(--accent-cyan)" : "var(--text-tertiary)" }}
          >
            {name}
          </span>
        </div>

        <div className="mt-4 flex items-baseline gap-1.5">
          <span
            className="text-[44px] font-bold leading-none tabular-nums text-(--text-heading)"
            style={{ fontFamily: "var(--font-jetbrains)" }}
          >
            {price}
          </span>
          <span className="text-cf-body-sm text-(--text-muted)">{unit}</span>
        </div>

        {subline && (
          <p className="mt-1.5 text-cf-label" style={{ color: "var(--accent-cyan)" }}>
            {subline}
          </p>
        )}

        <p
          className="mt-3 max-w-[28ch] text-cf-body-sm leading-[1.6] text-(--text-secondary)"
          style={{ fontFamily: "var(--font-body)" }}
        >
          {blurb}
        </p>

        <div className="mt-6 md:mt-auto md:pt-6">{cta}</div>
        {terms && <div className="mt-3">{terms}</div>}
      </div>

      {/* RIGHT — the spec list */}
      <ul className="grid grid-cols-1 gap-x-8 gap-y-3 self-center sm:grid-cols-2">
        {features.map((f) => (
          <li
            key={f.label}
            className="flex items-center gap-2.5 text-cf-body-sm"
            style={{
              fontFamily: "var(--font-body)",
              color: f.granted ? "var(--text-secondary)" : "var(--text-muted)",
            }}
          >
            {f.granted ? <GrantedIcon /> : <ExcludedIcon />}
            {f.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---- Pricing component ----------------------------------------------------- */

export function Pricing() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [isAnnual, setIsAnnual] = useState(false);
  const { loggedIn, isPro } = useAuthStatus({ withPlan: true });
  const freeHref = loggedIn ? "/book" : AUTH_LOGIN_BOOK_URL;
  // The Pro CTA advertises "Start 14-day free trial" with a "card required,
  // charged when the trial ends" promise — so it must land on the trial-start
  // (Stripe checkout) surface, not the free reader. Already-Pro users go to
  // settings to MANAGE, never a second checkout (CHECKOUT-DOUBLE).
  const proHref = isPro
    ? "/book/settings"
    : loggedIn
      ? UPGRADE_RETURN_PATH
      : UPGRADE_LOGIN_URL;
  const proCtaLabel = isPro ? "Manage subscription" : TRIAL_CTA_LABEL;
  const perMonthAmount = isAnnual ? PRICING.annualMonthlyAmount : PRICING.monthlyAmount;

  const toggleFaq = (index: number) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  /* ---- Free tier spec ---- */
  const freeFeatures: TierFeature[] = [
    { label: "Full book library", granted: true },
    { label: `Finish up to ${PRICING.freeBookLimit} books`, granted: true },
    { label: "Lite & Standard depth", granted: true },
    { label: "Summaries & examples", granted: true },
    { label: "Chapter quizzes", granted: true },
    { label: "Deeper depth mode", granted: false },
    { label: "Unlimited books", granted: false },
  ];

  /* ---- Pro tier spec (single source of truth: lib/pricing.ts) ---- */
  const proFeatures: TierFeature[] = PRO_FEATURES.map((label) => ({
    label,
    granted: true,
  }));

  const proPrice = isAnnual
    ? PRICING_TIER_DISPLAY.annual_upfront.price
    : formatAmount(perMonthAmount);

  return (
    <section id="pricing" className="relative">
      <div className="mx-auto max-w-[1180px] px-5 pt-(--section-pad-sm) pb-(--section-pad-lg) md:px-8 md:pt-(--section-pad-md)">
        {/* ---- Section head — left-aligned, folio system ---- */}
        <SectionReveal>
          <div className="max-w-2xl">
            <SectionLabel>§05 · PRICING</SectionLabel>
            <h2
              className="mt-4 font-bold leading-[1.05] text-balance"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2rem, 4vw, 3.1rem)",
                letterSpacing: "-0.03em",
                color: "var(--text-heading)",
              }}
            >
              Two tiers. One method. No lock-in.
            </h2>
            <p
              className="mt-4 max-w-xl text-cf-body-lg leading-[1.6] text-(--text-secondary)"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Read {FREE_OFFER_LABEL} with no card. Start a {PRICING.trialDays}-day
              Pro trial for unlimited access and the deepest reading mode — cancel
              before it ends and you won&apos;t be charged.
            </p>
          </div>
        </SectionReveal>

        {/* ---- The terms-sheet panel ---- */}
        <SectionReveal delay={0.08}>
          <div
            className="relative mt-12 overflow-hidden rounded-2xl border"
            style={{ borderColor: "var(--border-subtle)", background: "var(--cf-surface)" }}
          >
            {/* running head — billing cadence toggle as a mono datum control */}
            <div
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4 md:px-9"
              style={{ borderBottom: "1px solid var(--border-subtle)" }}
            >
              <span className="cf-folio" style={{ color: "var(--cf-axis-tint)" }}>
                Terms sheet · effective on signup
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsAnnual(false)}
                  className="cf-folio min-h-9 px-1 transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2"
                  style={{ color: isAnnual ? "var(--text-muted)" : "var(--text-heading)" }}
                >
                  MONTHLY
                </button>
                <button
                  onClick={() => setIsAnnual((v) => !v)}
                  role="switch"
                  aria-checked={isAnnual}
                  aria-label="Toggle annual pricing"
                  className="relative h-5 w-10 rounded-full transition-colors cursor-pointer border border-transparent forced-colors:border-[ButtonText] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2"
                  style={{ background: isAnnual ? "var(--accent-cyan)" : "var(--bg-elevated)" }}
                >
                  <span
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-(--cf-toggle-knob) shadow transition-transform border border-transparent forced-colors:border-[ButtonText] forced-colors:bg-[Highlight]"
                    style={{ transform: isAnnual ? "translateX(22px)" : "translateX(2px)" }}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setIsAnnual(true)}
                  className="cf-folio flex items-center gap-1.5 min-h-9 px-1 transition-colors cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2"
                  style={{ color: isAnnual ? "var(--text-heading)" : "var(--text-muted)" }}
                >
                  ANNUAL
                  <span style={{ color: "var(--accent-cyan)" }}>
                    −{ANNUAL_SAVINGS_PCT}%
                  </span>
                </button>
              </div>
            </div>

            {/* FREE row */}
            <TierRow
              call="CF-FREE"
              name="FREE"
              price="$0"
              unit="forever"
              blurb="Try ChapterFlow with two complete books — no card, no expiry."
              features={freeFeatures}
              accent={false}
              cta={
                <Link
                  href={freeHref}
                  onClick={() => track("cta_click", { source: "pricing_free" })}
                  className="inline-flex w-full items-center justify-center rounded-xl border border-(--border-medium) px-5 py-3 text-cf-body font-semibold text-(--text-heading) transition-colors hover:bg-(--bg-glass) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2 sm:w-auto sm:min-w-[16rem]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Get {FREE_OFFER_LABEL}
                </Link>
              }
            />

            {/* hairline rule between tiers */}
            <div style={{ borderTop: "1px solid var(--border-subtle)" }} />

            {/* PRO row */}
            <TierRow
              call="CF-PRO"
              name="PRO"
              price={proPrice}
              unit={`${PRICING.currency} / ${isAnnual ? "year" : "month"}`}
              subline={
                isAnnual ? (
                  <>
                    {formatAmount(PRICING.annualMonthlyAmount)}/mo
                    <span className="text-(--text-muted)">
                      {" "}
                      · billed once a year
                    </span>
                  </>
                ) : (
                  <>{formatAmount(perMonthAmount / 30)}/day</>
                )
              }
              blurb="Unlimited books and the deepest reading mode, with priority on new titles."
              features={proFeatures}
              accent
              cta={
                // ONE accent: cyan = the work. The Pro CTA carries the SAME cyan as
                // the hero/science CTAs — no gold/amber gradient, no glow halo.
                <Link
                  href={proHref}
                  onClick={() =>
                    track("cta_click", {
                      source: isPro ? "pricing_manage" : "pricing_pro",
                    })
                  }
                  className="inline-flex w-full items-center justify-center rounded-xl bg-(--accent-cyan) px-5 py-3 text-cf-body font-semibold text-(--primary-foreground) transition-transform hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-cyan)/60 focus-visible:ring-offset-2 sm:w-auto sm:min-w-[16rem]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {proCtaLabel}
                </Link>
              }
              terms={
                // Trial terms are a broken promise to someone already paying, so
                // hide them for Pro users (the CTA is "Manage subscription").
                !isPro ? (
                  <p
                    className="max-w-[34ch] text-cf-label-sm leading-[1.6] text-(--text-muted)"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {PRICING.trialDays}-day free trial, then{" "}
                    {isAnnual
                      ? `${PRICING_TIER_DISPLAY.annual_upfront.price} ${PRICING.currency}/year`
                      : `${formatAmount(perMonthAmount)} ${PRICING.currency}/month`}
                    . Card required; not charged until the trial ends, cancel anytime
                    before then.{" "}
                    <Link
                      href="/legal/refund"
                      className="underline hover:text-(--text-secondary)"
                    >
                      Refund policy
                    </Link>
                    .
                  </p>
                ) : undefined
              }
            />
          </div>
        </SectionReveal>

        {/* ---- FAQ — mono spec footnotes (disclosure rows) ---- */}
        <SectionReveal delay={0.16}>
          <div className="mt-12">
            <p className="cf-folio" style={{ color: "var(--cf-axis-tint)" }}>
              Footnotes
            </p>
            <div className="mt-3 border-t border-(--border-subtle)">
              {faqs.map((faq, index) => {
                const open = openIndex === index;
                return (
                  <div key={index} className="border-b border-(--border-subtle)">
                    <button
                      id={`faq-q-${index}`}
                      onClick={() => toggleFaq(index)}
                      aria-expanded={open}
                      aria-controls={open ? `faq-answer-${index}` : undefined}
                      className="flex w-full items-center justify-between gap-4 py-4 text-left rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2"
                    >
                      <span
                        className="text-cf-body font-medium text-(--text-heading)"
                        style={{ fontFamily: "var(--font-display)" }}
                      >
                        {faq.question}
                      </span>
                      <m.span
                        className="shrink-0 text-(--text-muted)"
                        animate={{ rotate: open ? 180 : 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                      >
                        <ChevronDown size={18} aria-hidden />
                      </m.span>
                    </button>

                    <AnimatePresence initial={false}>
                      {open && (
                        <m.div
                          key="answer"
                          id={`faq-answer-${index}`}
                          role="region"
                          aria-labelledby={`faq-q-${index}`}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <p
                            className="max-w-[60ch] pb-4 text-cf-body-sm leading-[1.6] text-(--text-secondary)"
                            style={{ fontFamily: "var(--font-body)" }}
                          >
                            {faq.answer}
                          </p>
                        </m.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
