"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

/* ── Google icon SVG ── */
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/* ── Apple icon SVG ── */
function AppleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-2.12 4.45-3.74 4.25z" />
    </svg>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const handleEmailContinue = () => {
    if (email.trim()) {
      router.push("/onboarding");
    }
  };

  const handleOAuthContinue = () => {
    router.push("/onboarding");
  };

  return (
    <div
      className="relative min-h-screen flex items-center justify-center px-5"
      style={{ background: "var(--bg-base)" }}
    >
      {/* Background orbs */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div
          className="absolute"
          style={{
            width: 600,
            height: 600,
            top: "-15%",
            left: "-10%",
            background: "radial-gradient(circle, rgba(124,107,240,0.12), transparent 70%)",
          }}
        />
        <div
          className="absolute"
          style={{
            width: 500,
            height: 500,
            bottom: "-15%",
            right: "-10%",
            background: "radial-gradient(circle, rgba(62,207,178,0.08), transparent 70%)",
          }}
        />
      </div>

      {/* Signup card */}
      <motion.div
        className="relative z-10 w-full"
        style={{
          maxWidth: 440,
          padding: 32,
          background: "rgba(255, 255, 255, 0.06)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          borderRadius: "var(--radius-xl-val)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
        }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center gap-2.5 mb-5">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="3" y="2" width="14" height="20" rx="2"
                stroke="var(--accent-blue)" strokeWidth="1.5"
              />
              <path
                d="M7 7h6M7 11h6M7 15h4"
                stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round"
              />
              <rect
                x="7" y="4" width="14" height="20" rx="2"
                fill="var(--bg-base)" stroke="var(--accent-blue)" strokeWidth="1.5"
              />
              <path
                d="M11 9h6M11 13h6M11 17h4"
                stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round"
              />
            </svg>
            <span
              style={{
                fontFamily: "var(--font-sora)",
                fontSize: 20,
                fontWeight: 700,
                color: "var(--text-heading)",
              }}
            >
              ChapterFlow
            </span>
          </div>

          <h1
            style={{
              fontFamily: "var(--font-sora)",
              fontSize: 28,
              fontWeight: 600,
              color: "var(--text-heading)",
              textAlign: "center",
            }}
          >
            Start reading smarter
          </h1>
          <p
            className="mt-2"
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: 15,
              color: "var(--text-secondary)",
              textAlign: "center",
            }}
          >
            Turn any book into a skill you keep.
          </p>
        </div>

        {/* OAuth buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleOAuthContinue}
            className="w-full flex items-center justify-center gap-3 cursor-pointer transition-all duration-200"
            style={{
              minHeight: 48,
              padding: "12px 16px",
              background: "#ffffff",
              color: "#1f2937",
              fontFamily: "var(--font-dm-sans)",
              fontSize: 15,
              fontWeight: 500,
              borderRadius: "var(--radius-md-val)",
              border: "none",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.01)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <button
            onClick={handleOAuthContinue}
            className="w-full flex items-center justify-center gap-3 cursor-pointer transition-all duration-200"
            style={{
              minHeight: 48,
              padding: "12px 16px",
              background: "rgba(255,255,255,0.04)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-dm-sans)",
              fontSize: 15,
              fontWeight: 500,
              borderRadius: "var(--radius-md-val)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
              e.currentTarget.style.transform = "scale(1.01)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <AppleIcon />
            Continue with Apple
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1" style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
          <span
            style={{
              fontFamily: "var(--font-dm-sans)",
              fontSize: 13,
              color: "var(--text-muted)",
            }}
          >
            or
          </span>
          <div className="flex-1" style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />
        </div>

        {/* Email input */}
        <div className="flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            onKeyDown={(e) => e.key === "Enter" && handleEmailContinue()}
            className="w-full transition-all duration-200"
            style={{
              minHeight: 48,
              padding: "12px 16px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "var(--radius-md-val)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-dm-sans)",
              fontSize: 15,
              outline: "none",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--accent-blue)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(79,139,255,0.15)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />

          <button
            onClick={handleEmailContinue}
            className="w-full cursor-pointer transition-all duration-200"
            style={{
              minHeight: 48,
              padding: "12px 16px",
              background: "var(--accent-green)",
              color: "#0A0E1A",
              fontFamily: "var(--font-dm-sans)",
              fontSize: 15,
              fontWeight: 600,
              borderRadius: "var(--radius-md-val)",
              border: "none",
              boxShadow: "0 0 20px rgba(52,211,153,0.15)",
              opacity: email.trim() ? 1 : 0.5,
              pointerEvents: email.trim() ? "auto" : "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = "brightness(1.1)";
              e.currentTarget.style.transform = "scale(1.02)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "brightness(1)";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            Continue with email &rarr;
          </button>
        </div>

        {/* Sign in link */}
        <p
          className="text-center mt-5"
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: 14,
            color: "var(--text-secondary)",
          }}
        >
          Already have an account?{" "}
          <a
            href="/auth/login"
            className="transition-colors duration-200"
            style={{ color: "var(--accent-blue)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#6EA3FF")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--accent-blue)")}
          >
            Sign in
          </a>
        </p>

        {/* Trust line */}
        <p
          className="text-center mt-6"
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: 13,
            color: "var(--text-muted)",
          }}
        >
          No credit card required. Free forever for 2 books.
        </p>
      </motion.div>
    </div>
  );
}
