// TODO: Implement real Rewards page
"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function RewardsPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-base)",
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
              "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(245,158,11,0.10))",
            border: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            margin: "0 auto 24px",
          }}
        >
          💎
        </div>
        <h1
          style={{ fontSize: 24, fontWeight: 600, color: "var(--text-heading)", marginBottom: 12 }}
        >
          Rewards
        </h1>
        <p
          style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 32 }}
        >
          Your Flow Points balance, reward catalog, and redemption history are
          being built. Your points are safe and waiting.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 24px",
            borderRadius: 12,
            backgroundColor: "var(--bg-surface-1)",
            border: "1px solid var(--border-default)",
            color: "var(--text-heading)",
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
