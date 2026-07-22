import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy | ChapterFlow",
  description: "How ChapterFlow uses cookies and local storage.",
};

type CookieEntry = {
  name: string;
  purpose: string;
  duration: string;
};

const ESSENTIAL_COOKIES: readonly CookieEntry[] = [
  {
    name: "id_token",
    purpose: "Authentication session (JWT from AWS Cognito). Secure, httpOnly.",
    duration: "1 hour",
  },
  {
    name: "access_token",
    purpose: "API authorization token. Secure, httpOnly.",
    duration: "1 hour",
  },
  {
    name: "refresh_token",
    purpose:
      "Silently renews your sign-in session — it is exchanged for fresh id/access tokens before they expire so you are not signed out every hour. Secure, httpOnly.",
    duration: "30 days",
  },
  {
    name: "auth_expires_at",
    purpose:
      "Session expiry timestamp for proactive session management. Client-readable (not httpOnly). The stored value is the current access-token expiry (about 1 hour out), while the cookie itself persists for the full refresh window so the client can detect an expired session and renew it.",
    duration: "30 days",
  },
  {
    name: "cf_auth_generation",
    purpose:
      "Opaque random marker that prevents private browser-cache data from carrying across sign-ins. Client-readable, contains no account identifier, and is not used to authenticate you.",
    duration: "30 days",
  },
  {
    name: "cf_device",
    purpose:
      "Randomly generated device identifier for abuse prevention. An opaque random value that does not contain personal information.",
    duration: "1 year",
  },
] as const;

const FUNCTIONAL_COOKIES: readonly CookieEntry[] = [
  {
    name: "cf_ref",
    purpose:
      "Tracks referral attribution when you sign up through an invite link. Used to credit Insight Points to the referrer.",
    duration: "30 days",
  },
  {
    name: "cf_acq_ref, cf_acq_us, cf_acq_um, cf_acq_uc",
    purpose:
      "First-party attribution. Briefly record how you reached ChapterFlow (the referring page and any utm_source / utm_medium / utm_campaign parameters on the link you followed) so that source can be saved to your account when you finish onboarding. These are first-party only — they are never shared with advertisers and are not used for cross-site tracking.",
    duration: "30 minutes",
  },
] as const;

function CookieInventory({
  label,
  entries,
}: {
  label: string;
  entries: readonly CookieEntry[];
}) {
  return (
    <>
      <dl className="space-y-3 sm:hidden" aria-label={label}>
        {entries.map((entry) => (
          <div
            key={entry.name}
            className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border-subtle)" }}
          >
            <dt
              className="break-all font-mono text-cf-label font-semibold"
              style={{ color: "var(--text-heading)" }}
            >
              {entry.name}
            </dt>
            <dd className="mt-2 text-cf-body-sm leading-[1.65]">{entry.purpose}</dd>
            <dd
              className="mt-3 flex items-baseline justify-between gap-4 border-t pt-3 text-cf-label"
              style={{ borderColor: "var(--border-subtle)" }}
            >
              <span className="font-semibold" style={{ color: "var(--text-heading)" }}>
                Duration
              </span>
              <span>{entry.duration}</span>
            </dd>
          </div>
        ))}
      </dl>

      <table
        aria-label={label}
        className="hidden w-full table-fixed border-collapse text-cf-body-sm sm:table"
      >
        <colgroup>
          <col className="w-[26%]" />
          <col />
          <col className="w-[18%]" />
        </colgroup>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <th
              scope="col"
              className="py-2 pr-4 text-left font-semibold"
              style={{ color: "var(--text-heading)" }}
            >
              Cookie
            </th>
            <th
              scope="col"
              className="py-2 pr-4 text-left font-semibold"
              style={{ color: "var(--text-heading)" }}
            >
              Purpose
            </th>
            <th
              scope="col"
              className="py-2 text-left font-semibold"
              style={{ color: "var(--text-heading)" }}
            >
              Duration
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.name} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
              <td className="break-all py-2 pr-4 align-top font-mono text-cf-label">
                {entry.name}
              </td>
              <td className="py-2 pr-4 align-top">{entry.purpose}</td>
              <td className="py-2 align-top">{entry.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export default function CookiePolicyPage() {
  return (
    <article className="prose-legal">
      <h1
        className="text-[28px] md:text-[32px] font-bold tracking-tight mb-2"
        style={{ fontFamily: "var(--font-display)", color: "var(--text-heading)" }}
      >
        Cookie Policy
      </h1>
      <p className="text-cf-body-sm mb-10" style={{ color: "var(--text-muted)" }}>
        Effective date: April 2, 2026
      </p>

      <div className="space-y-8 text-cf-body leading-[1.75]" style={{ color: "var(--text-secondary)" }}>
        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            1. What Are Cookies
          </h2>
          <p>
            Cookies are small text files stored on your device by your browser. ChapterFlow uses a minimal
            set of cookies that are essential to the operation of the Service. We do not use cookies for
            advertising or third-party tracking.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            2. Essential Cookies
          </h2>
          <p className="mb-3">These cookies are required for ChapterFlow to function and cannot be disabled.</p>
          <CookieInventory label="Essential cookies" entries={ESSENTIAL_COOKIES} />
        </section>

        <section>
          <p className="mb-3">
            During sign-in, transient cookies (<code className="font-mono text-cf-label">pkce_verifier</code>,{" "}
            <code className="font-mono text-cf-label">oauth_state</code>,{" "}
            <code className="font-mono text-cf-label">post_auth_redirect</code>) are briefly set and immediately
            cleared after the authentication callback completes. These never persist beyond the login flow.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            3. Functional Cookies
          </h2>
          <p className="mb-3">These cookies support optional features and improve your experience.</p>
          <CookieInventory label="Functional cookies" entries={FUNCTIONAL_COOKIES} />
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            4. Local Storage and Session Storage
          </h2>
          <p className="mb-3">
            ChapterFlow uses browser local storage to persist your preferences and app state locally for performance.
            This data stays on your device. Some preferences are also synced to the server so they persist across devices.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Reading preferences (font size, theme, learning mode, accessibility settings)</li>
            <li>Onboarding progress and selected interests</li>
            <li>Chapter reader state (current tab, quiz answers, scroll position)</li>
            <li>Daily reading activity tracking</li>
            <li>Dashboard and viewer state cache</li>
            <li>Badge and achievement data</li>
            <li>Analytics consent preference</li>
            <li>Query cache for offline resilience</li>
          </ul>
          <p className="mt-3">
            Session storage is used minimally for transient state such as post-checkout status flags. It is cleared when you close your browser tab.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            5. What We Do Not Use
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>No third-party advertising cookies</li>
            <li>No cross-site tracking pixels</li>
            <li>No analytics cookies from Google Analytics or similar services</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            6. Managing Cookies
          </h2>
          <p>
            You can manage or delete cookies through your browser settings. Note that disabling essential
            cookies will prevent you from signing in to ChapterFlow. For more information about managing
            cookies in your browser, visit your browser&apos;s help documentation.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-heading)" }}>
            7. Contact
          </h2>
          <p>
            For questions about our use of cookies, contact us at{" "}
            <a href="mailto:support@chapterflow.ca" className="underline" style={{ color: "var(--accent-cyan)" }}>support@chapterflow.ca</a>.
          </p>
        </section>
      </div>
    </article>
  );
}
