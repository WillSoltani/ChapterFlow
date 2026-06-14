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
            <li><strong style={{ color: "var(--text-heading)" }}>Device information:</strong> A hashed device identifier and coarse network information used solely for abuse prevention.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>Payment information:</strong> Billing is handled entirely by Stripe. We store your Stripe customer ID and subscription status but never see or store your credit card number.</li>
            <li>
              <strong style={{ color: "var(--text-heading)" }}>Optional analytics data:</strong> Usage analytics is off by default. If you turn on &quot;Share Usage Analytics&quot; in Settings, we collect
              technical information such as screen dimensions, browser and device type, operating system, page load performance, and navigation patterns,
              along with how you use the product (reading sessions, quiz activity, badges, and Insight Points).
              This data is used to understand product usage and improve ChapterFlow. It is not sold and is not used for advertising. You can turn it off again at any time.
            </li>
            <li>
              <strong style={{ color: "var(--text-heading)" }}>Approximate location:</strong> When usage analytics is enabled, we record an approximate location (country, region, city, and approximate coordinates) for your reading sessions.
              This is derived from your IP address and our content-delivery network&apos;s edge data — we do not use GPS or access your device&apos;s precise location.
              To resolve an approximate location when our network does not already provide it, your IP address may be sent to a third-party IP-geolocation provider (ip-api.com). If usage analytics is off, we do not collect or store location data.
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
            <li>To improve product performance and user experience through opt-in analytics data.</li>
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
            <li><strong style={{ color: "var(--text-heading)" }}>AWS (DynamoDB, S3, SES):</strong> Secure data storage, content delivery, and transactional email.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>Anthropic:</strong> When you submit your own scenario, the text you write is sent to Anthropic&apos;s API for automated quality and safety review before it can be published. Don&apos;t include personal or sensitive information in submissions.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>ip-api.com:</strong> An IP-geolocation provider used only when you enable usage analytics, to derive an approximate (city-level) location from your IP address.</li>
          </ul>
          <p className="mt-3">We do not sell your personal information to third parties. We do not use third-party advertising or tracking services.</p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            5. Your Controls
          </h2>
          <p className="mb-3">You can manage your privacy preferences directly in ChapterFlow Settings:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong style={{ color: "var(--text-heading)" }}>Usage analytics:</strong> Off by default. Turn usage analytics (including approximate-location collection) on or off at any time.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>Personalized recommendations:</strong> Toggle personalized book and chapter recommendations.</li>
            <li><strong style={{ color: "var(--text-heading)" }}>Reading history:</strong> Choose whether your daily reading activity is tracked.</li>
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
            9. Email &amp; Communications
          </h2>
          <p className="mb-3">We send two kinds of email:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong style={{ color: "var(--text-heading)" }}>Essential account email</strong> (transactional) — for example, authentication, billing receipts,
              trial-ending notices, and important account or security messages. These are required to operate your
              account and cannot be unsubscribed from while your account is active.
            </li>
            <li>
              <strong style={{ color: "var(--text-heading)" }}>Optional engagement email</strong> — for example, reading reminders, streak nudges, the weekly
              digest, and achievement notifications. You can turn these on or off at any time in Settings, or use
              the one-click unsubscribe link in any such email.
            </li>
          </ul>
          <p className="mt-3">
            Engagement emails identify the sender and include a working unsubscribe mechanism, consistent with
            Canada&apos;s Anti-Spam Legislation (CASL) and similar laws. We never sell your email address.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            10. Contact Us
          </h2>
          <p>
            ChapterFlow is operated by SiliconX Software Solutions (Nova Scotia, Canada). If you have questions
            about this Privacy Policy or your personal data, contact us at{" "}
            <a href="mailto:support@chapterflow.ca" className="underline" style={{ color: "var(--accent-teal)" }}>support@chapterflow.ca</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
