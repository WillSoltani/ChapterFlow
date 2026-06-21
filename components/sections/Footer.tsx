import Link from "next/link";
import { AUTH_LOGIN_BOOK_URL, CHAPTERFLOW_NAME } from "@/app/_lib/chapterflow-brand";
import { CurrentYear } from "./CurrentYear";

/**
 * The colophon — the back-cover of the manual.
 *
 * A dense, calm, mono colophon block on the same inverse anchor band the Final
 * CTA closes on (cf-anchor tokens), so the page signs off on one continuous
 * near-black field rather than a second surface. Hairline top rule, a "SPEC
 * v1.0" version stamp beside the wordmark, three index columns (manual / legal /
 * contact), the science-sources line repeated as a PERMANENT citation footer
 * (trust surfaced, never buried), and the CurrentYear copyright line. No glow, no
 * glass — depth from the single hairline and the mono datum rhythm. Static
 * markup, reduced-motion safe.
 */

const MANUAL_LINKS = [
  { label: "How it works", href: "/#retention-engine" },
  { label: "Library", href: "/books" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Start free", href: AUTH_LOGIN_BOOK_URL },
];

const LEGAL_LINKS = [
  { label: "Terms", href: "/legal/terms" },
  { label: "Privacy", href: "/legal/privacy" },
  { label: "Refunds", href: "/legal/refund" },
  { label: "Cookies", href: "/legal/cookies" },
  { label: "Copyright", href: "/legal/copyright" },
  { label: "Data rights", href: "/legal/data-rights" },
];

// The same references certified in §03 Evidence, repeated as a standing footer
// citation so the cited authority is the last thing on the page — real
// authors/venues only, never logos or fabricated proof.
const SOURCES =
  "Ebbinghaus 1885 · Karpicke & Roediger, Science 2008 · Cepeda et al. 2006 · FSRS-5 spaced repetition";

const linkClass =
  "rounded text-(--cf-anchor-text-muted) transition-colors duration-200 hover:text-(--cf-anchor-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-anchor-accent)/60 focus-visible:ring-offset-2";

function ColumnHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="cf-folio mb-3 text-(--cf-anchor-text-muted)">{children}</p>
  );
}

export function Footer() {
  return (
    <footer
      className="relative"
      style={{
        background: "var(--cf-anchor-bg)",
        borderTop: "1px solid var(--cf-anchor-border)",
      }}
    >
      <div className="mx-auto max-w-[1180px] px-5 py-14 md:px-8 md:py-16">
        {/* masthead — wordmark + spec stamp */}
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-baseline gap-3">
              <span className="font-(family-name:--font-display) text-[17px] font-semibold text-(--cf-anchor-text)">
                {CHAPTERFLOW_NAME}
              </span>
              <span className="cf-folio tabular-nums text-(--cf-anchor-accent)">
                SPEC v1.0
              </span>
            </div>
            <p className="mt-3 text-[13.5px] leading-[1.6] text-(--cf-anchor-text-muted)">
              Guided reading specified as one instrument: read, prove, keep.
              Built on the testing effect and an FSRS-5 spaced-repetition
              schedule.
            </p>
          </div>

          {/* index columns */}
          <div className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-3">
            <nav aria-label="Manual">
              <ColumnHeading>Manual</ColumnHeading>
              <ul className="space-y-2.5">
                {MANUAL_LINKS.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className={`block whitespace-nowrap text-[13.5px] ${linkClass}`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Legal">
              <ColumnHeading>Legal</ColumnHeading>
              <ul className="space-y-2.5">
                {LEGAL_LINKS.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className={`block whitespace-nowrap text-[13.5px] ${linkClass}`}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-label="Contact">
              <ColumnHeading>Contact</ColumnHeading>
              <ul className="space-y-2.5">
                <li>
                  <Link
                    href="/contact"
                    className={`block whitespace-nowrap text-[13.5px] ${linkClass}`}
                  >
                    Get in touch
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        {/* permanent citation footer — the cited record, repeated */}
        <div
          className="mt-12 border-t pt-6"
          style={{ borderColor: "var(--cf-anchor-border)" }}
        >
          <p className="cf-folio mb-2 text-(--cf-anchor-text-muted)">
            Sources, on the record
          </p>
          <p className="cf-folio normal-case text-(--cf-anchor-text-muted)">
            <span aria-hidden className="text-(--cf-anchor-accent)">↳ </span>
            {SOURCES}
          </p>
        </div>

        {/* sign-off line */}
        <div
          className="mt-6 flex flex-col gap-2 border-t pt-6 text-[12px] sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "var(--cf-anchor-border)" }}
        >
          <span className="cf-folio tabular-nums text-(--cf-anchor-text-muted)">
            &copy; <CurrentYear /> {CHAPTERFLOW_NAME} · SPEC v1.0
          </span>
          <span className="cf-folio text-(--cf-anchor-text-muted)">
            Two free books · no card · cancel anytime
          </span>
        </div>
      </div>
    </footer>
  );
}
