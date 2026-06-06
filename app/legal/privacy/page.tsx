import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | ChapterFlow",
  description: "How ChapterFlow collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <article className="prose-legal">
      <h1
        className="text-[28px] md:text-[32px] font-bold tracking-tight mb-2"
        style={{ fontFamily: "var(--font-display)", color: "var(--text-heading)" }}
      >
        Privacy Policy
      </h1>
      <p className="text-[14px] mb-10" style={{ color: "var(--text-muted)" }}>
        Effective date: April 2, 2026
      </p>

      <div className="space-y-8 text-[15px] leading-[1.75]" style={{ color: "var(--text-secondary)" }}>
        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            1. Information We Collect
          </h2>
          <p className="mb-3">When you use ChapterFlow, we collect the following types of information:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong style={{ color: "var(--text-heading)" }}>Account information:</strong> Your email address and authentication credentials, managed through AWS Cognito.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>Reading activity:</strong> Which books and chapters you access, quiz scores, reading time, and chapter completion progress.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>Notes and bookmarks:</strong> Chapter notes you write and takeaways you bookmark within the reading experience.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>Preferences:</strong> Your display settings, learning mode, reading goals, and notification preferences.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>Gamification data:</strong> Insight Points balance, badge progress, streak data, and scenario submissions.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>Device &amp; approximate location:</strong> A hashed device identifier and coarse network information used for abuse prevention. We also derive an <em>approximate</em> location (country, region, city, and approximate coordinates) from your IP address to understand where our community is and to improve the product. We do not collect precise GPS location.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>Payment information:</strong> Billing is handled entirely by Stripe. We store your Stripe customer ID and subscription status but never see or store your credit card number.</li>
            <li>
              <strong style={{ color: "var(--text-heading)" }}>Usage analytics:</strong> We collect usage analytics to operate, secure, and improve ChapterFlow &mdash; including
              technical information (screen dimensions, browser and device type, operating system, page-load performance) and how you use the product
              (reading sessions, quiz activity, badges, and Insight Points). This data is never shared with third parties or sold.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            2. How We Use Your Information
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To provide, maintain, and improve ChapterFlow&apos;s reading and learning features.</li>
            <li>To track your progress, badges, streaks, and Insight Points balance.</li>
            <li>To personalize your experience based on your chosen preferences and learning style.</li>
            <li>To process payments and manage your subscription through Stripe.</li>
            <li>To detect and prevent abuse, including multi-account exploitation of free book slots.</li>
            <li>To send transactional emails related to your account (e.g., password resets, subscription confirmations).</li>
            <li>To improve product performance and user experience through usage analytics.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            3. Cookies and Local Storage
          </h2>
          <p className="mb-3">
            ChapterFlow uses a small number of cookies and browser local storage. For full details, see our{" "}
            <a href="/legal/cookies" className="underline" style={{ color: "var(--accent-teal)" }}>Cookie Policy</a>.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong style={{ color: "var(--text-heading)" }}>Authentication cookies:</strong> Secure, httpOnly cookies for your session tokens, plus a client-readable session expiry cookie for proactive session management.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>Device cookie:</strong> A hashed device identifier for abuse prevention.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>Referral cookie:</strong> Tracks referral attribution when you sign up through a friend&apos;s link.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>Local storage:</strong> Your reading preferences, onboarding state, reader progress, theme selection, and chapter state are stored locally on your device for performance.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            4. Third-Party Services
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong style={{ color: "var(--text-heading)" }}>AWS Cognito:</strong> Authentication and account management.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>Stripe:</strong> Payment processing and subscription management.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>AWS (DynamoDB, S3):</strong> Secure data storage and content delivery.</li>
          </ul>
          <p className="mt-3">We do not sell your personal information to third parties. We do not use third-party advertising or tracking services.</p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            5. Your Controls
          </h2>
          <p className="mb-3">You can manage your privacy preferences directly in ChapterFlow Settings:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong style={{ color: "var(--text-heading)" }}>Personalized recommendations:</strong> Toggle personalized book and chapter recommendations.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>Reading history:</strong> Choose whether your daily reading activity is saved to your profile (it powers your streaks and reading history). Usage analytics, described above, is collected regardless.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>Data export:</strong> Download all your data (reading history, notes, bookmarks, quiz results, badges, and more) in JSON, CSV, or Markdown format.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>Account deactivation:</strong> Temporarily disable your account from Settings. Your data is preserved and you can reactivate by signing back in.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>Account deletion:</strong> Permanently delete your account from Settings. You can also contact us at <a href="mailto:support@chapterflow.ca" className="underline" style={{ color: "var(--accent-teal)" }}>support@chapterflow.ca</a>.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            6. Data Retention
          </h2>
          <p className="mb-3">
            We retain your account data for as long as your account is active. If you cancel your subscription,
            your reading progress and preferences are preserved so you can resume if you return.
          </p>
          <p className="mb-3">
            If you deactivate your account, your data is preserved and your account becomes inactive until you sign back in.
            If you delete your account, it is marked as deleted and becomes non-functional. Backend data is retained
            for operational and legal compliance purposes but is no longer used in the product.
          </p>
          <p>
            To request complete erasure of your data, contact us at{" "}
            <a href="mailto:support@chapterflow.ca" className="underline" style={{ color: "var(--accent-teal)" }}>support@chapterflow.ca</a>.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            7. Security
          </h2>
          <p>
            We use industry-standard security measures including encrypted connections (HTTPS), httpOnly secure
            cookies, hashed device identifiers, and server-enforced access controls. Payment data is handled
            entirely by Stripe and never touches our servers.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            8. Changes to This Policy
          </h2>
          <p>
            We may update this Privacy Policy from time to time. Material changes will be communicated through
            the app or via email. Continued use of ChapterFlow after changes constitutes acceptance of the
            updated policy.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            9. Contact Us
          </h2>
          <p>
            If you have questions about this Privacy Policy or your personal data, contact us at{" "}
            <a href="mailto:support@chapterflow.ca" className="underline" style={{ color: "var(--accent-teal)" }}>support@chapterflow.ca</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
