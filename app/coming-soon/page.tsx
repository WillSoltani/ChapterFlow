"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Construction } from "lucide-react";

export default function ComingSoonPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative overflow-hidden" style={{ background: "var(--bg-base)" }}>
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div
          className="absolute rounded-full"
          style={{
            top: -200,
            left: -150,
            width: 500,
            height: 500,
            background: "radial-gradient(circle, color-mix(in srgb, var(--accent-cyan) 8%, transparent) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            bottom: -150,
            right: -100,
            width: 400,
            height: 400,
            background: "radial-gradient(circle, color-mix(in srgb, var(--accent-cyan) 6%, transparent) 0%, transparent 70%)",
          }}
        />
      </div>

      <motion.div
        className="relative z-10 flex flex-col items-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: "var(--bg-surface-1)",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <Construction size={32} style={{ color: "var(--accent-amber)" }} />
        </div>

        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 600,
            color: "var(--text-heading)",
          }}
        >
          Coming soon
        </h1>

        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 16,
            color: "var(--text-secondary)",
            marginTop: 8,
            maxWidth: 400,
            lineHeight: 1.5,
          }}
        >
          We&apos;re still putting this part of ChapterFlow together. Your books,
          progress, and streak are all waiting on your dashboard in the meantime.
        </p>

        <div
          style={{
            marginTop: 32,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
          }}
        >
          <button
            onClick={() => router.push("/dashboard")}
            className="cursor-pointer"
            style={{
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 24px",
              borderRadius: 12,
              fontFamily: "var(--font-body)",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--accent-cyan)",
              background: "color-mix(in srgb, var(--accent-cyan) 8%, transparent)",
              border: "1px solid color-mix(in srgb, var(--accent-cyan) 40%, transparent)",
              transition: "background 200ms",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "color-mix(in srgb, var(--accent-cyan) 14%, transparent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "color-mix(in srgb, var(--accent-cyan) 8%, transparent)")
            }
          >
            Go to your dashboard
          </button>

          <button
            onClick={() => router.back()}
            className="cursor-pointer"
            style={{
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "var(--text-secondary)",
              background: "none",
              border: "none",
              transition: "color 200ms",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-heading)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            <ArrowLeft size={16} />
            Go back
          </button>
        </div>
      </motion.div>
    </div>
  );
}
