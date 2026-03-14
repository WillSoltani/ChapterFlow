"use client";

import { BadgeCheck } from "lucide-react";
import { motion } from "framer-motion";

import { Section } from "@/components/Section";
import { certifications } from "@/content/certifications";

import { Card } from "@/components/ui/card";

export function CertificationsSection() {
  return (
    <Section
      id="certifications"
      title="Certifications"
      subtitle="Verified credentials with direct issuer verification links."
    >
      <p className="mb-4 text-xs font-semibold tracking-[0.22em] text-slate-400">
        CERTIFICATIONS
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {certifications.map((c, idx) => (
          <motion.div
            key={c.name}
            whileHover={{ y: -3, scale: 1.01 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
          >
            <Card className="group relative overflow-hidden border-white/10 bg-white/5 p-6 backdrop-blur">
              <div
                className={[
                  "pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100",
                  idx === 0
                    ? "bg-[radial-gradient(600px_circle_at_20%_10%,rgba(56,189,248,0.14),transparent_60%)]"
                    : idx === 1
                    ? "bg-[radial-gradient(600px_circle_at_20%_10%,rgba(34,197,94,0.12),transparent_60%)]"
                    : "bg-[radial-gradient(600px_circle_at_20%_10%,rgba(168,85,247,0.12),transparent_60%)]",
                ].join(" ")}
              />

              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-400">{c.issuer}</p>
                  <h3 className="mt-1 text-base font-semibold leading-snug bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">
                    {c.name}
                  </h3>
                  {c.year ? (
                    <p className="mt-2 text-xs text-slate-400">{c.year}</p>
                  ) : null}
                </div>

                {c.verifyUrl ? (
                  <a
                    href={c.verifyUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative inline-flex items-center gap-2 rounded-full
                              border border-sky-400/30
                              bg-sky-500/10
                              px-3 py-1.5
                              text-sm font-medium text-sky-200
                              transition
                              hover:border-sky-400/60
                              hover:bg-sky-500/20
                              focus:outline-none focus:ring-2 focus:ring-sky-400/40"
                  >
                    {/* glow on hover */}
                    <span className="pointer-events-none absolute -inset-1 rounded-full
                                    opacity-0 blur-md
                                    bg-sky-400/20
                                    transition
                                    group-hover:opacity-100" />

                    <motion.span
                      whileHover={{ rotate: [0, -10, 10, -6, 0] }}
                      transition={{ duration: 0.45 }}
                      className="relative z-10"
                    >
                      <BadgeCheck className="h-4 w-4" />
                    </motion.span>

                    <span className="relative z-10">Verify</span>
                  </a>
                ) : null}

              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
