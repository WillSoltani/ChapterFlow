import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Footer } from "@/components/sections/Footer";
import { SUPPORT_EMAIL, LEGAL_ENTITY_NAME, LEGAL_ENTITY_LOCATION } from "@/lib/legal-entity";

export const metadata: Metadata = {
  title: "Contact & Support | ChapterFlow",
  description: "How to reach ChapterFlow support for help, billing, privacy, and copyright questions.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg-base)" }}>
      <header
        className="sticky top-0 z-30 backdrop-blur-md border-b"
        style={{ borderColor: "var(--border-subtle)", background: "color-mix(in srgb, var(--bg-base) 80%, transparent)" }}
      >
        <div className="max-w-3xl mx-auto px-6 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[14px] font-medium transition-colors hover:text-(--text-heading)"
            style={{ color: "var(--text-secondary)" }}
          >
            <ArrowLeft size={16} />
            Back to ChapterFlow
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-6 py-12 w-full">
        <h1
          className="text-[28px] md:text-[32px] font-bold tracking-tight mb-3"
          style={{ fontFamily: "var(--font-display)", color: "var(--text-heading)" }}
        >
          Contact &amp; Support
        </h1>
        <p className="text-[15px] leading-[1.75] mb-8" style={{ color: "var(--text-secondary)" }}>
          The fastest way to reach us is by email. Write to{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="underline" style={{ color: "var(--accent-cyan)" }}>{SUPPORT_EMAIL}</a>{" "}
          and we&apos;ll get back to you as soon as we can.
        </p>

        <div className="space-y-5 text-[15px] leading-[1.75]" style={{ color: "var(--text-secondary)" }}>
          <div>
            <h2 className="text-[16px] font-semibold mb-1" style={{ color: "var(--text-heading)" }}>Help &amp; account support</h2>
            <p>Trouble with the app, your account, reading progress, or a feature? Email us and include your account email and a short description of what happened.</p>
          </div>
          <div>
            <h2 className="text-[16px] font-semibold mb-1" style={{ color: "var(--text-heading)" }}>Billing &amp; cancellation</h2>
            <p>You can manage or cancel your subscription anytime in{" "}
              <Link href="/book/settings" className="underline" style={{ color: "var(--accent-cyan)" }}>Settings</Link>.
              For billing questions, see our{" "}
              <Link href="/legal/refund" className="underline" style={{ color: "var(--accent-cyan)" }}>Refund &amp; Cancellation Policy</Link>{" "}
              or email us.</p>
          </div>
          <div>
            <h2 className="text-[16px] font-semibold mb-1" style={{ color: "var(--text-heading)" }}>Privacy &amp; your data</h2>
            <p>To access, export, correct, or delete your data, see your{" "}
              <Link href="/legal/data-rights" className="underline" style={{ color: "var(--accent-cyan)" }}>Data Rights</Link>{" "}
              and our{" "}
              <Link href="/legal/privacy" className="underline" style={{ color: "var(--accent-cyan)" }}>Privacy Policy</Link>.</p>
          </div>
          <div>
            <h2 className="text-[16px] font-semibold mb-1" style={{ color: "var(--text-heading)" }}>Copyright &amp; legal notices</h2>
            <p>Intellectual-property and takedown notices are handled per our{" "}
              <Link href="/legal/copyright" className="underline" style={{ color: "var(--accent-cyan)" }}>Copyright &amp; Takedown Policy</Link>.</p>
          </div>
        </div>

        <p className="mt-10 text-[13px]" style={{ color: "var(--text-muted)" }}>
          ChapterFlow is operated by {LEGAL_ENTITY_NAME}, {LEGAL_ENTITY_LOCATION}.
        </p>
      </main>

      <Footer />
    </div>
  );
}
