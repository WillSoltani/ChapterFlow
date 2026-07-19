import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/legal-entity";

export const metadata: Metadata = {
  title: "Legal & Policies | ChapterFlow",
  description:
    "ChapterFlow terms, privacy, billing, cookie, copyright, and data-rights policies.",
};

const POLICY_LINKS = [
  {
    href: "/legal/terms",
    title: "Terms of Service",
    description: "The terms that govern access to and use of ChapterFlow.",
  },
  {
    href: "/legal/privacy",
    title: "Privacy Policy",
    description: "What information ChapterFlow collects, uses, and protects.",
  },
  {
    href: "/legal/refund",
    title: "Refund & Cancellation Policy",
    description: "How free trials, billing, cancellation, and refunds work.",
  },
  {
    href: "/legal/cookies",
    title: "Cookie Policy",
    description: "The essential and functional browser storage ChapterFlow uses.",
  },
  {
    href: "/legal/copyright",
    title: "Copyright & Takedown Policy",
    description: "Our approach to original educational work and takedown requests.",
  },
  {
    href: "/legal/data-rights",
    title: "Your Data Rights",
    description: "How to access, export, correct, or delete your personal data.",
  },
] as const;

export default function LegalHubPage() {
  return (
    <article>
      <h1
        className="font-(family-name:--font-display) text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.05] tracking-[-0.035em] text-balance"
        style={{ color: "var(--text-heading)" }}
      >
        Policies, plainly stated.
      </h1>
      <p
        className="mt-4 max-w-[62ch] text-cf-body-lg leading-[1.75]"
        style={{ color: "var(--text-secondary)" }}
      >
        Find the product, privacy, billing, and data commitments that apply to
        ChapterFlow in one place.
      </p>

      <ul className="mt-10 grid list-none gap-4 p-0 sm:grid-cols-2">
        {POLICY_LINKS.map((policy) => (
          <li key={policy.href}>
            <Link
              href={policy.href}
              className="group flex min-h-11 h-full flex-col rounded-2xl border p-5 transition-[border-color,background-color,transform] duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2 motion-reduce:transform-none motion-reduce:transition-none"
              style={{
                borderColor: "var(--border-subtle)",
                background: "var(--cf-surface)",
              }}
            >
              <span
                className="font-(family-name:--font-display) text-cf-body-lg font-semibold"
                style={{ color: "var(--text-heading)" }}
              >
                {policy.title}
              </span>
              <span
                className="mt-2 text-cf-body-sm leading-[1.65]"
                style={{ color: "var(--text-secondary)" }}
              >
                {policy.description}
              </span>
              <span
                aria-hidden="true"
                className="mt-4 text-cf-label font-semibold"
                style={{ color: "var(--accent-cyan)" }}
              >
                Read policy →
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section
        aria-labelledby="legal-help-heading"
        className="mt-12 border-t pt-8"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <h2
          id="legal-help-heading"
          className="font-(family-name:--font-display) text-xl font-semibold"
          style={{ color: "var(--text-heading)" }}
        >
          Questions about a policy?
        </h2>
        <p className="mt-2 text-cf-body leading-[1.75]" style={{ color: "var(--text-secondary)" }}>
          Email{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline" style={{ color: "var(--accent-cyan)" }}>
            {SUPPORT_EMAIL}
          </a>
          . We&apos;ll help you find the right answer.
        </p>
      </section>
    </article>
  );
}
