import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/lib/legal-entity";

export const metadata: Metadata = {
  title: "Your Data Rights | ChapterFlow",
  description:
    "How to access, export, correct, delete your ChapterFlow data, and withdraw consent.",
};

export default function DataRightsPage() {
  return (
    <article className="prose-legal">
      <h1
        className="text-[28px] md:text-[32px] font-bold tracking-tight mb-2"
        style={{ fontFamily: "var(--font-display)", color: "var(--text-heading)" }}
      >
        Your Data Rights
      </h1>
      <p className="text-[14px] mb-10" style={{ color: "var(--text-muted)" }}>
        Effective date: June 10, 2026
      </p>

      <div className="space-y-8 text-[15px] leading-[1.75]" style={{ color: "var(--text-secondary)" }}>
        <section>
          <p>
            You control your personal data on ChapterFlow. Most rights can be exercised yourself from{" "}
            <a href="/book/settings" className="underline" style={{ color: "var(--accent-teal)" }}>Settings</a>;
            for anything else, email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline" style={{ color: "var(--accent-teal)" }}>{SUPPORT_EMAIL}</a>.
            This page summarizes how; see our{" "}
            <a href="/legal/privacy" className="underline" style={{ color: "var(--accent-teal)" }}>Privacy Policy</a>{" "}
            for full detail.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            Access &amp; export
          </h2>
          <p>
            Download your data anytime from Settings in JSON, CSV, or Markdown format. The export includes your
            profile, settings, entitlement, reading progress and history, completed chapters, quiz and badge
            records, saved books, and Insight Points. Usage analytics and approximate-location telemetry (which is
            only collected if you opt in to &quot;Share Usage Analytics&quot;) are not part of the self-serve export — to
            request a copy, email us.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            Correct your information
          </h2>
          <p>
            Update your display name, reading preferences, goals, and other profile details directly in Settings.
            If something you can&apos;t edit is inaccurate, contact us and we&apos;ll correct it.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            Deactivate or delete
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong style={{ color: "var(--text-heading)" }}>Deactivate</strong> from Settings to pause your
              account. Your data is preserved and you can reactivate by signing back in.
            </li>
            <li>
              <strong style={{ color: "var(--text-heading)" }}>Delete</strong> from Settings to permanently close
              your account. A deleted account is marked deleted and becomes non-functional. To request complete
              erasure of your underlying data, email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="underline" style={{ color: "var(--accent-teal)" }}>{SUPPORT_EMAIL}</a>.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            Withdraw consent
          </h2>
          <p>
            You can turn off &quot;Share Usage Analytics&quot; (including approximate-location collection) and unsubscribe
            from non-essential emails at any time in Settings, or use the unsubscribe link in any reminder email.
            You may still receive essential account emails (for example, billing and security notices).
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            Data retention
          </h2>
          <p>
            We keep your data for as long as your account is active and as needed for the purposes described in our
            Privacy Policy, or as required to meet legal, tax, and accounting obligations. When you delete your
            account it is marked deleted and is no longer used in the product; residual backend records are
            retained only where necessary for those purposes and are then removed.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            Making a request
          </h2>
          <p>
            Email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline" style={{ color: "var(--accent-teal)" }}>{SUPPORT_EMAIL}</a>{" "}
            from your account email. We may need to verify your identity before acting on a request, and we&apos;ll
            respond as promptly as we can.
          </p>
        </section>
      </div>
    </article>
  );
}
