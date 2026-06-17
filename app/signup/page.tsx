"use client";

import { Suspense, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { BrandLockup } from "@/components/auth/BrandLockup";

/* ── Google icon SVG (brand asset — fixed colors by design) ── */
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/* ── Apple icon SVG (monochrome — inherits currentColor) ── */
function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.12 4.45-3.74 4.25z" />
    </svg>
  );
}

function SignupInner() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  // Surfaced when the email path is attempted with an empty email field, so the
  // button isn't a silent dead control. Cleared on typing.
  const [emailHint, setEmailHint] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);

  // Preserve where the visitor was headed (e.g. a gift or invite page). The
  // /auth/login route sanitizes returnTo server-side, so we pass it through raw.
  const returnTo = searchParams.get("returnTo") || "/book";

  // Build a real Cognito-initiating URL. These are genuine auth flows — no more
  // fake router.push into an onboarding that can't save.
  function loginHref(extra?: Record<string, string>): string {
    const params = new URLSearchParams({ returnTo, ...(extra ?? {}) });
    return `/auth/login?${params.toString()}`;
  }

  // Consent is action-implied (fine print under the CTAs), so every provider is
  // immediately actionable — no checkbox gate before the first tap.
  function startOAuth(provider: "Google" | "SignInWithApple") {
    window.location.assign(loginHref({ identity_provider: provider }));
  }

  function startEmail() {
    if (!email.trim()) {
      // Don't silently no-op: signal the missing email and move focus to it.
      setEmailHint(true);
      emailInputRef.current?.focus();
      return;
    }
    // login_hint prefills the email on the hosted UI; it's validated/ignored
    // server-side if it isn't a real address.
    window.location.assign(loginHref({ login_hint: email.trim() }));
  }

  // The email control points its aria-describedby at the empty-field hint.
  const emailDescribedBy = emailHint ? "signup-email-hint" : undefined;

  return (
    <AuthScreen>
      <motion.div
        className="w-full max-w-md rounded-2xl border border-(--cf-border) bg-(--cf-surface) p-8 shadow-(--cf-shadow-lg)"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Brand lockup + headline */}
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLockup className="mb-5" />
          <h1 className="text-[24px] font-bold leading-snug text-(--cf-text-1)">
            Start reading smarter
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-(--cf-text-3)">
            Turn any book into a skill you keep.
          </p>
        </div>

        {/* OAuth buttons */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => startOAuth("Google")}
            aria-label="Continue with Google"
            className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-(--cf-border-strong) bg-(--cf-surface-muted) px-4 text-[15px] font-medium text-(--cf-text-1) transition-colors duration-(--duration-fast) hover:bg-(--cf-surface-strong)"
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <button
            type="button"
            onClick={() => startOAuth("SignInWithApple")}
            aria-label="Continue with Apple"
            className="inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-(--cf-border-strong) bg-(--cf-surface-muted) px-4 text-[15px] font-medium text-(--cf-text-1) transition-colors duration-(--duration-fast) hover:bg-(--cf-surface-strong)"
          >
            <AppleIcon />
            Continue with Apple
          </button>
        </div>

        {/* Divider */}
        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-(--cf-border)" />
          <span className="text-[13px] text-(--cf-text-3)">or</span>
          <div className="h-px flex-1 bg-(--cf-border)" />
        </div>

        {/* Email input */}
        <div className="flex flex-col gap-3">
          <label htmlFor="signup-email" className="sr-only">
            Email address
          </label>
          <input
            ref={emailInputRef}
            id="signup-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (emailHint) setEmailHint(false);
            }}
            placeholder="you@example.com"
            onKeyDown={(e) => e.key === "Enter" && startEmail()}
            aria-invalid={emailHint}
            aria-describedby={emailDescribedBy}
            className="min-h-12 w-full rounded-xl border border-(--cf-border-strong) bg-(--cf-surface-muted) px-4 text-[15px] text-(--cf-text-1) placeholder:text-(--cf-text-3) transition-colors duration-(--duration-fast) focus:border-(--cf-accent)"
          />

          {emailHint && (
            <p
              id="signup-email-hint"
              role="alert"
              className="-mt-1 text-[13px] leading-relaxed text-(--cf-danger-text)"
            >
              Enter your email to continue.
            </p>
          )}

          <button
            type="button"
            onClick={startEmail}
            aria-describedby={emailDescribedBy}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-(--cf-accent) px-4 text-[15px] font-semibold text-(--cf-accent-contrast) transition duration-(--duration-fast) hover:brightness-110"
          >
            Continue with email &rarr;
          </button>
        </div>

        {/* Sign in link */}
        <p className="mt-5 text-center text-[14px] text-(--cf-text-3)">
          Already have an account?{" "}
          <a
            href={loginHref()}
            className="font-medium text-(--cf-accent) transition-colors duration-(--duration-fast) hover:brightness-110"
          >
            Sign in
          </a>
        </p>

        {/* Action-implied consent — standard consent-on-action fine print, so
            the providers stay one tap away with no gate before the first click. */}
        <p className="mt-6 text-center text-[13px] leading-relaxed text-(--cf-text-3)">
          By continuing, you agree to our{" "}
          <a
            href="/legal/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-(--cf-accent) underline underline-offset-2"
          >
            Terms of Service
          </a>{" "}
          and{" "}
          <a
            href="/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-(--cf-accent) underline underline-offset-2"
          >
            Privacy Policy
          </a>
          .
        </p>

        {/* Trust line */}
        <p className="mt-2 text-center text-[13px] text-(--cf-text-3)">
          No credit card required. Free forever for 2 books.
        </p>
      </motion.div>
    </AuthScreen>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  );
}
