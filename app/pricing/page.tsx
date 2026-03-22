// TODO: Implement real Pricing/Go Pro page
"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function PricingPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0a0a12",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        style={{ textAlign: "center", maxWidth: 480 }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background:
              "linear-gradient(135deg, rgba(245,158,11,0.15), rgba(251,191,36,0.10))",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            margin: "0 auto 24px",
          }}
        >
          ✨
        </div>
        <h1
          style={{ fontSize: 24, fontWeight: 600, color: "#F0F0F0", marginBottom: 12 }}
        >
          Go Pro
        </h1>
        <p
          style={{ fontSize: 15, color: "#A0A0B8", lineHeight: 1.6, marginBottom: 32 }}
        >
          Our Pro upgrade page is being finalized. Pro gives you unlimited
          access to 95+ books, Deeper depth mode, and 2x Flow Points — all for
          $7.99 CAD/month.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 24px",
            borderRadius: 12,
            backgroundColor: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.10)",
            color: "#F0F0F0",
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          ← Back to Dashboard
        </Link>
      </motion.div>
    </div>
  );
}
