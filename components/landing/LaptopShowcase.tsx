"use client";

import { useRef, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValueEvent,
} from "framer-motion";
import { LaptopFrame } from "./LaptopFrame";
import { LaptopScreen } from "./LaptopScreen";
import { LaptopShowcaseMobile } from "./LaptopShowcaseMobile";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { GreenCTA } from "@/components/ui/GreenCTA";

/* ------------------------------------------------------------------ */
/*  Desktop: scroll-driven cinematic laptop animation                  */
/* ------------------------------------------------------------------ */

function LaptopShowcaseDesktop() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  /* ---------- Phase 1: Scale down (0% -> 40%) ---------- */
  const laptopScale = useTransform(scrollYProgress, [0, 0.4], [2.5, 1], {
    clamp: true,
  });
  const laptopRotateX = useTransform(scrollYProgress, [0, 0.4], [8, 0], {
    clamp: true,
  });

  /* ---------- Phase 2: Settle + reveal text (35% -> 50%) ---------- */
  const headingOpacity = useTransform(scrollYProgress, [0.35, 0.5], [0, 1]);
  const headingY = useTransform(scrollYProgress, [0.35, 0.5], [-20, 0]);
  const shadowOpacity = useTransform(scrollYProgress, [0.35, 0.5], [0, 1]);

  /* ---------- Phase 3: Content states (60% -> 100%) ---------- */
  const [activeState, setActiveState] = useState(0);
  const [screenBlur, setScreenBlur] = useState(12);

  useMotionValueEvent(scrollYProgress, "change", (latest: number) => {
    // Blur: full at top, fully clear by 35%
    if (latest < 0.35) {
      const nextBlur = 12 - (latest / 0.35) * 12;
      setScreenBlur(Math.max(0, Math.round(nextBlur * 100) / 100));
    } else {
      setScreenBlur(0);
    }

    // Content state transitions
    if (latest < 0.73) {
      setActiveState(0);
    } else if (latest < 0.86) {
      setActiveState(1);
    } else {
      setActiveState(2);
    }
  });

  /* ---------- CTA appearance ---------- */
  const ctaOpacity = useTransform(scrollYProgress, [0.9, 1.0], [0, 1]);
  const ctaY = useTransform(scrollYProgress, [0.9, 1.0], [20, 0]);

  /* ---------- Glow ---------- */
  const glowOpacity = useTransform(scrollYProgress, [0.3, 0.5], [0, 1]);

  return (
    <section ref={sectionRef} className="relative" style={{ height: "300vh" }}>
      {/* Top gradient fade for smooth entry */}
      <div
        className="absolute top-0 left-0 right-0 pointer-events-none z-10"
        style={{
          height: 200,
          background:
            "linear-gradient(180deg, var(--bg-base) 0%, transparent 100%)",
        }}
      />

      {/* Sticky viewport container */}
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center overflow-hidden">
        {/* Background shade overlay that darkens slightly during animation */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 40%, rgba(11,11,15,0.4) 0%, rgba(11,11,15,0.9) 100%)",
            opacity: glowOpacity,
          }}
        />
        {/* ---- Heading (fades in during Phase 2) ---- */}
        <motion.div
          className="text-center mb-8 px-4"
          style={{ opacity: headingOpacity, y: headingY }}
        >
          <SectionLabel>SEE IT IN ACTION</SectionLabel>
          <h2
            className="mt-3 text-[26px] md:text-[36px] font-bold leading-[1.1] tracking-[-0.02em]"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--text-heading)",
            }}
          >
            This is what reading looks like on ChapterFlow.
          </h2>
          <p
            className="mt-2 text-[14px] max-w-[500px] mx-auto"
            style={{
              fontFamily: "var(--font-body)",
              color: "var(--text-secondary)",
            }}
          >
            Summary. Scenario. Quiz. Unlock. Every chapter, every book.
          </p>
        </motion.div>

        {/* ---- Laptop with 3D perspective ---- */}
        <div
          style={{ perspective: 2000 }}
          className="relative w-full flex justify-center px-4"
        >
          {/* Ambient glow */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 50% 50%, rgba(34,211,238,0.08) 0%, transparent 70%)",
              filter: "blur(40px)",
              opacity: glowOpacity,
            }}
          />

          {/* Laptop wrapper */}
          <motion.div
            className="w-full max-w-[900px]"
            style={{
              scale: laptopScale,
              rotateX: laptopRotateX,
              willChange: "transform",
            }}
          >
            <LaptopFrame>
              <LaptopScreen
                activeState={activeState}
                screenBlur={screenBlur}
              />
            </LaptopFrame>

            {/* Ground shadow */}
            <motion.div
              className="mx-auto mt-2"
              style={{
                width: "80%",
                height: 20,
                background:
                  "radial-gradient(ellipse, rgba(0,0,0,0.3) 0%, transparent 70%)",
                filter: "blur(10px)",
                opacity: shadowOpacity,
              }}
            />
          </motion.div>
        </div>

        {/* ---- Indicator dots ---- */}
        <div className="flex gap-2 mt-6">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: 8,
                height: 8,
                background:
                  activeState === i
                    ? "var(--accent-blue)"
                    : "var(--border-medium)",
              }}
            />
          ))}
        </div>

        {/* ---- CTA (appears at the end of the scroll) ---- */}
        <motion.div className="mt-6" style={{ opacity: ctaOpacity, y: ctaY }}>
          <GreenCTA href="/auth/login?returnTo=%2Fbook">Start reading free</GreenCTA>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Public export: responsive wrapper                                  */
/* ------------------------------------------------------------------ */

export function LaptopShowcase() {
  return (
    <>
      {/* Desktop: scroll-driven animation */}
      <div className="hidden lg:block">
        <LaptopShowcaseDesktop />
      </div>

      {/* Mobile / Tablet: static with tab switching */}
      <div className="lg:hidden">
        <LaptopShowcaseMobile />
      </div>
    </>
  );
}
