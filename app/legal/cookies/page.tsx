import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy | ChapterFlow",
  description: "How ChapterFlow uses cookies and local storage.",
};

export default function CookiePolicyPage() {
  return (
    <article className="prose-legal">
      <h1
        className="text-[28px] md:text-[32px] font-bold tracking-tight mb-2"
        style={{ fontFamily: "var(--font-display)", color: "var(--text-heading)" }}
      >
        Cookie Policy
      </h1>
      <p className="text-[14px] mb-10" style={{ color: "var(--text-muted)" }}>
        Effective date: March 28, 2026
      </p>

      <div className="space-y-8 text-[15px] leading-[1.75]" style={{ color: "var(--text-secondary)" }}>
        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            1. What Are Cookies
          </h2>
          <p>
            Cookies are small text files stored on your device by your browser. ChapterFlow uses a minimal
            set of cookies that are essential to the operation of the Service. We do not use cookies for
            advertising or third-party tracking.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            2. Essential Cookies
          </h2>
          <p className="mb-3">These cookies are required for ChapterFlow to function and cannot be disabled.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[14px] border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <th className="text-left py-2 pr-4 font-semibold" style={{ color: "var(--text-heading)" }}>Cookie</th>
                  <th className="text-left py-2 pr-4 font-semibold" style={{ color: "var(--text-heading)" }}>Purpose</th>
                  <th className="text-left py-2 font-semibold" style={{ color: "var(--text-heading)" }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td className="py-2 pr-4 font-mono text-[13px]">id_token</td>
                  <td className="py-2 pr-4">Authentication session (JWT from AWS Cognito). Secure, httpOnly.</td>
                  <td className="py-2">Session</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td className="py-2 pr-4 font-mono text-[13px]">access_token</td>
                  <td className="py-2 pr-4">API authorization token. Secure, httpOnly.</td>
                  <td className="py-2">Session</td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td className="py-2 pr-4 font-mono text-[13px]">cf_device</td>
                  <td className="py-2 pr-4">Hashed device identifier for abuse prevention. Does not contain personal information.</td>
                  <td className="py-2">1 year</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            3. Functional Cookies
          </h2>
          <p className="mb-3">These cookies support optional features and improve your experience.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[14px] border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <th className="text-left py-2 pr-4 font-semibold" style={{ color: "var(--text-heading)" }}>Cookie</th>
                  <th className="text-left py-2 pr-4 font-semibold" style={{ color: "var(--text-heading)" }}>Purpose</th>
                  <th className="text-left py-2 font-semibold" style={{ color: "var(--text-heading)" }}>Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                  <td className="py-2 pr-4 font-mono text-[13px]">cf_ref</td>
                  <td className="py-2 pr-4">Tracks referral attribution when you sign up through an invite link. Used to credit Flow Points to the referrer.</td>
                  <td className="py-2">30 days</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            4. Local Storage
          </h2>
          <p className="mb-3">
            ChapterFlow uses browser local storage to persist your preferences and reader state locally for performance.
            This data never leaves your device unless you explicitly sync it.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Reading preferences (font size, theme, learning mode)</li>
            <li>Reader state (current position, scroll progress)</li>
            <li>Theme selection (light/dark mode)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            5. What We Do Not Use
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>No third-party advertising cookies</li>
            <li>No cross-site tracking pixels</li>
            <li>No analytics cookies from Google Analytics or similar services</li>
          </ul>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            6. Managing Cookies
          </h2>
          <p>
            You can manage or delete cookies through your browser settings. Note that disabling essential
            cookies will prevent you from signing in to ChapterFlow. For more information about managing
            cookies in your browser, visit your browser&apos;s help documentation.
          </p>
        </section>

        <section>
          <h2 className="text-[18px] font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            7. Contact
          </h2>
          <p>
            For questions about our use of cookies, contact us at{" "}
            <a href="mailto:support@siliconx.ca" className="underline" style={{ color: "var(--accent-teal)" }}>support@siliconx.ca</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
