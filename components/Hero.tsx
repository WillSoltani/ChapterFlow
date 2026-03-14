"use client";

import { motion, type Variants } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Github, Linkedin, ArrowDown } from "lucide-react";

const container: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      staggerChildren: 0.1,
      duration: 0.5,
      ease: "easeOut",
    },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" },
  },
};

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* decorative blur orbs (valid Tailwind opacity + mobile-friendly sizing) */}
      <div className="pointer-events-none absolute -top-24 left-6 h-56 w-56 rounded-full bg-sky-400/10 blur-3xl sm:left-10 sm:h-72 sm:w-72" />
      <div className="pointer-events-none absolute top-24 right-4 h-56 w-56 rounded-full bg-violet-400/10 blur-3xl sm:right-6 sm:h-72 sm:w-72" />

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative mx-auto flex max-w-6xl flex-col items-center px-4 py-16 text-center sm:px-6 sm:py-24"
      >
        {/* Availability badge */}
        <motion.div
          variants={item}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-xs text-emerald-200 sm:px-4 sm:py-2 sm:text-sm"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </span>
          Open to impactful roles and select project collaborations.
        </motion.div>

        {/* Name */}
        <motion.h1
          variants={item}
          className="mt-6 text-3xl font-semibold tracking-tight sm:text-5xl md:text-6xl"
        >
          <span className="bg-gradient-to-b from-white to-slate-300 bg-clip-text text-transparent">
            Will Soltani
          </span>
        </motion.h1>

        {/* Title */}
        <motion.p
          variants={item}
          className="mt-3 text-base text-sky-300 sm:text-lg md:text-xl"
        >
          Cloud Engineer | AWS Solutions Architect
        </motion.p>

        {/* Summary */}
        <motion.p
          variants={item}
          className="mt-6 max-w-xl text-sm leading-relaxed text-slate-300 sm:mt-8 sm:max-w-2xl sm:text-base"
        >
          I build reliable, scalable, cost-aware cloud systems on AWS and ship
          portfolio-grade projects with real security, observability, and CI/CD.
        </motion.p>

        {/* Location */}
        <motion.p
          variants={item}
          className="mt-3 text-xs text-slate-400 sm:text-sm"
        >
          Halifax, NS · Remote-friendly
        </motion.p>

        {/* Social buttons: stacked on mobile, side-by-side on >= sm */}
        <motion.div
          variants={item}
          className="mt-7 grid w-full max-w-sm grid-cols-1 gap-3 sm:mt-8 sm:w-auto sm:max-w-none sm:grid-cols-2"
        >
          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
            <Button
              asChild
              variant="outline"
              className="border-white/15 bg-white/5 text-slate-200 hover:bg-white/15 hover:text-white hover:shadow-lg"
            >
              <a href="https://github.com/WillSoltani" target="_blank" rel="noreferrer">
                <span className="inline-flex items-center gap-2">
                  <Github className="h-4 w-4" />
                  GitHub
                </span>
              </a>
            </Button>
          </motion.div>

          <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}>
            <Button
              asChild
              variant="outline"
              className="border-white/15 bg-white/5 text-slate-200 hover:bg-white/15 hover:text-white hover:shadow-lg"
            >
              <a href="https://www.linkedin.com/in/will-soltani" target="_blank" rel="noreferrer">
                <span className="inline-flex items-center gap-2">
                  <Linkedin className="h-4 w-4" />
                  Linkedin
                </span>
              </a>
            </Button>

          </motion.div>
        </motion.div>

        {/* Primary CTA */}
        <motion.div
          variants={item}
          className="mt-4 grid w-full max-w-sm grid-cols-1 gap-3 sm:mt-6 sm:w-auto sm:max-w-none sm:grid-cols-2"
        >
          <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }}>
            <Button
              asChild
              className="w-full border border-white/10 bg-white/10 text-slate-100 hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-sky-300/40 sm:w-auto"
            >
              <a href="#projects">View Projects &amp; Case Studies</a>
            </Button>
          </motion.div>
          <motion.div whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }}>
            <Button
              asChild
              variant="outline"
              className="w-full border-cyan-300/25 bg-cyan-400/8 text-cyan-100 hover:bg-cyan-400/14 hover:text-cyan-50 sm:w-auto"
            >
              <a href="/book">Explore ChapterFlow</a>
            </Button>
          </motion.div>
        </motion.div>

        {/* Scroll indicator: hide on very small screens */}
        <motion.a
          href="#certifications"
          className="mt-10 hidden items-center gap-2 text-xs text-slate-400 hover:text-slate-200 sm:inline-flex"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.9 } }}
        >
          <motion.span
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="inline-flex items-center gap-2"
          >
            Scroll
            <ArrowDown className="h-4 w-4" />
          </motion.span>
        </motion.a>
      </motion.div>
    </section>
  );
}
