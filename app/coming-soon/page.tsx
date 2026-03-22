"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Construction } from "lucide-react";

export default function ComingSoonPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center relative overflow-hidden" style={{ background: "#0A0E1A" }}>
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden="true">
        <div
          className="absolute rounded-full"
          style={{
            top: -200,
            left: -150,
            width: 500,
            height: 500,
            background: "radial-gradient(circle, rgba(124,107,240,0.08) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            bottom: -150,
            right: -100,
            width: 400,
            height: 400,
            background: "radial-gradient(circle, rgba(62,207,178,0.06) 0%, transparent 70%)",
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
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
          }}
        >
          <Construction size={32} style={{ color: "#E8B931" }} />
        </div>

        <h1
          style={{
            fontFamily: "var(--font-sora, sans-serif)",
            fontSize: 28,
            fontWeight: 600,
            color: "rgba(255,255,255,0.93)",
          }}
        >
          Coming soon
        </h1>

        <p
          style={{
            fontFamily: "var(--font-dm-sans, sans-serif)",
            fontSize: 16,
            color: "rgba(255,255,255,0.50)",
            marginTop: 8,
            maxWidth: 400,
            lineHeight: 1.5,
          }}
        >
          This feature is being built. Check back soon.
        </p>

        <button
          onClick={() => router.back()}
          className="cursor-pointer"
          style={{
            marginTop: 32,
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "var(--font-dm-sans, sans-serif)",
            fontSize: 14,
            color: "rgba(255,255,255,0.50)",
            background: "none",
            border: "none",
            transition: "color 200ms",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.80)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.50)")}
        >
          <ArrowLeft size={16} />
          Go back
        </button>
      </motion.div>
    </div>
  );
}
