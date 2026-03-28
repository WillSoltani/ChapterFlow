import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | ChapterFlow",
  description: "Terms and conditions for using ChapterFlow.",
};

export default function TermsOfServicePage() {
  return (
    <article className="prose-legal">
      <h1
        className="text-[28px] md:text-[32px] font-bold tracking-tight mb-2"
        style={{ fontFamily: "var(--font-display)", color: "var(--text-heading)" }}
      >
        Terms of Service
      </h1>
      <p className="text-[14px] mb-10" style={{ color: "var(--text-muted)" }}>
        Effective date: March 28, 2026
      </p>

      <div className="space-y-8 text-[15px] leading-[1.75]" style={{ color: "var(--text-secondary)" }}>
        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            1. Acceptance of Terms
          </h2>
          <p>
            By accessing or using ChapterFlow (&quot;the Service&quot;), operated by SiliconX, you agree to be bound
            by these Terms of Service. If you do not agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            2. Account Registration
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>You must provide a valid email address to create an account.</li>
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>You may not create multiple accounts to circumvent free-tier limitations.</li>
            <li>You must be at least 13 years of age to use the Service.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            3. Free and Pro Plans
          </h2>
          <p className="mb-3">ChapterFlow offers two tiers of access:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong style={{ color: "var(--text-heading)" }}>Free Plan:</strong> Access to up to 2 complete books,
              Standard and Guided learning modes, and core features including quizzes, progress tracking, and Flow Points.
            </li>
            <li>
              <strong style={{ color: "var(--text-heading)" }}>Pro Plan:</strong> $7.99 CAD per month (or $5.99 CAD/month
              billed annually). Includes unlimited book access, all learning modes including Challenge mode,
              and enhanced features. Pro includes a 14-day free trial for new subscribers.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            4. Billing and Cancellation
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Pro subscriptions are billed through Stripe on a recurring monthly or annual basis.</li>
            <li>You may cancel your subscription at any time through the Billing section in Settings. Cancellation takes effect at the end of your current billing period.</li>
            <li>If you cancel during the 14-day free trial, you will not be charged.</li>
            <li>After cancellation, you retain access to your completed books and reading progress. To start new books beyond the free limit, you must resubscribe.</li>
            <li>We reserve the right to change pricing with 30 days&apos; notice. Existing subscribers remain on their current rate until their next renewal after the notice period.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            5. License Keys
          </h2>
          <p>
            License keys grant time-limited Pro access. Each key is single-use and non-transferable. Attempting
            to share, resell, or reverse-engineer license keys is prohibited and may result in account suspension.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            6. Flow Points
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Flow Points are earned through reading activities, quiz completion, referrals, and other in-app actions.</li>
            <li>Flow Points have no monetary value and cannot be exchanged for cash, transferred between accounts, or sold.</li>
            <li>Flow Points can be redeemed for in-app rewards such as bonus book slots and temporary Pro access passes.</li>
            <li>We reserve the right to adjust Flow Points balances or earning rates to maintain the integrity of the rewards system.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            7. Acceptable Use
          </h2>
          <p className="mb-3">You agree not to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Create multiple accounts to exploit free book slots or referral bonuses.</li>
            <li>Use automated tools, bots, or scripts to interact with the Service.</li>
            <li>Attempt to access content or features you have not unlocked or paid for.</li>
            <li>Redistribute, republish, or commercially exploit any content from ChapterFlow.</li>
            <li>Interfere with or disrupt the Service or its infrastructure.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            8. Content and Intellectual Property
          </h2>
          <p>
            ChapterFlow provides educational summaries, scenarios, and quizzes derived from published non-fiction
            books. All ChapterFlow-original content (summaries, examples, quiz questions, interface design) is
            owned by SiliconX. Original book content remains the property of its respective authors and publishers.
            Your reading progress, quiz responses, and scenario submissions are your data, subject to our{" "}
            <a href="/legal/privacy" className="underline" style={{ color: "var(--accent-teal)" }}>Privacy Policy</a>.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            9. Limitation of Liability
          </h2>
          <p>
            ChapterFlow is provided &quot;as is&quot; without warranties of any kind, either express or implied. SiliconX
            shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising
            from your use of or inability to use the Service, including but not limited to loss of data, loss of
            progress, or service interruptions. Our total liability for any claim shall not exceed the amount you
            paid for the Service in the 12 months preceding the claim.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            10. Termination
          </h2>
          <p>
            We may suspend or terminate your account if you violate these Terms, engage in abusive behavior, or
            exploit the Service in ways that harm other users or the platform. You may delete your account at any
            time by contacting{" "}
            <a href="mailto:support@siliconx.ca" className="underline" style={{ color: "var(--accent-teal)" }}>support@siliconx.ca</a>.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            11. Changes to These Terms
          </h2>
          <p>
            We may update these Terms from time to time. Material changes will be communicated through the app
            or via email at least 14 days before taking effect. Continued use of ChapterFlow after changes
            constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            12. Governing Law
          </h2>
          <p>
            These Terms are governed by the laws of the Province of Ontario, Canada. Any disputes shall be
            resolved in the courts of Ontario.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            13. Contact
          </h2>
          <p>
            For questions about these Terms, contact us at{" "}
            <a href="mailto:support@siliconx.ca" className="underline" style={{ color: "var(--accent-teal)" }}>support@siliconx.ca</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
