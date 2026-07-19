import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL, LEGAL_ENTITY_NAME, LEGAL_ENTITY_LOCATION } from "@/lib/legal-entity";
import { PublicMasthead } from "@/components/marketing/PublicMasthead";
import { PublicSiteShell } from "@/components/marketing/PublicSiteShell";

export const metadata: Metadata = {
  title: "Contact & Support | ChapterFlow",
  description: "How to reach ChapterFlow support for help, billing, privacy, and copyright questions.",
};

export default function ContactPage() {
  return (
    <PublicSiteShell>
      <main id="main" tabIndex={-1} className="focus:outline-none">
        <PublicMasthead eyebrow="Support" title="Contact & Support" compact />

        <section
          aria-label="Support options"
          className="cf-paper-folio relative z-10 mx-auto mb-20 w-[calc(100%-2rem)] max-w-3xl rounded-[2rem] px-6 py-10 sm:w-[calc(100%-3rem)] sm:px-10 sm:py-12"
        >
          <p className="mb-8 text-cf-body leading-[1.75]" style={{ color: "var(--text-secondary)" }}>
            The fastest way to reach us is by email. Write to{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline" style={{ color: "var(--accent-cyan)" }}>{SUPPORT_EMAIL}</a>{" "}
            and we&apos;ll get back to you as soon as we can.
          </p>

          <div className="space-y-5 text-cf-body leading-[1.75]" style={{ color: "var(--text-secondary)" }}>
            <div>
              <h2 className="text-cf-body-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>Help &amp; account support</h2>
              <p>Trouble with the app, your account, reading progress, or a feature? Email us and include your account email and a short description of what happened.</p>
            </div>
            <div>
              <h2 className="text-cf-body-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>Billing &amp; cancellation</h2>
              <p>You can manage or cancel your subscription anytime in{" "}
                <Link href="/book/settings" className="underline" style={{ color: "var(--accent-cyan)" }}>Settings</Link>.
                For billing questions, see our{" "}
                <Link href="/legal/refund" className="underline" style={{ color: "var(--accent-cyan)" }}>Refund &amp; Cancellation Policy</Link>{" "}
                or email us.</p>
            </div>
            <div>
              <h2 className="text-cf-body-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>Privacy &amp; your data</h2>
              <p>To access, export, correct, or delete your data, see your{" "}
                <Link href="/legal/data-rights" className="underline" style={{ color: "var(--accent-cyan)" }}>Data Rights</Link>{" "}
                and our{" "}
                <Link href="/legal/privacy" className="underline" style={{ color: "var(--accent-cyan)" }}>Privacy Policy</Link>.</p>
            </div>
            <div>
              <h2 className="text-cf-body-lg font-semibold mb-1" style={{ color: "var(--text-heading)" }}>Copyright &amp; legal notices</h2>
              <p>Intellectual-property and takedown notices are handled per our{" "}
                <Link href="/legal/copyright" className="underline" style={{ color: "var(--accent-cyan)" }}>Copyright &amp; Takedown Policy</Link>.</p>
            </div>
          </div>

          <p className="mt-10 text-cf-label" style={{ color: "var(--text-muted)" }}>
            ChapterFlow is operated by {LEGAL_ENTITY_NAME}, {LEGAL_ENTITY_LOCATION}.
          </p>
        </section>
      </main>
    </PublicSiteShell>
  );
}
