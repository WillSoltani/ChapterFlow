"use client";

import { motion } from "framer-motion";
import { OptionCard } from "./OptionCard";
import type { PersonalizationChoice } from "./chapterData";

/* ── SVG icons (18×18, stroke only) ── */

const BriefcaseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="14" height="10" rx="2" />
    <path d="M6 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </svg>
);

const LightbulbIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 2a5 5 0 0 0-3 9v2h6v-2a5 5 0 0 0-3-9Z" />
    <path d="M7 15h4" />
  </svg>
);

const CycleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 3.5L12 6h3a5 5 0 0 1-1.5 8.5" />
    <path d="M3.5 14.5L6 12H3a5 5 0 0 1 1.5-8.5" />
  </svg>
);

const SeedlingIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="var(--accent-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 16V8" />
    <path d="M9 8c0-3 3-5 6-5-1 3-3 5-6 5Z" />
    <path d="M9 11c0-3-3-5-6-5 1 3 3 5 6 5Z" />
  </svg>
);

/* ── Options data ── */

const options: {
  id: PersonalizationChoice;
  icon: React.ReactNode;
  title: string;
  description: string;
}[] = [
  { id: "work",     icon: <BriefcaseIcon />, title: "Move faster at work",  description: "Books that sharpen judgment, leadership, and decisions." },
  { id: "thinking", icon: <LightbulbIcon />, title: "Think more clearly",   description: "Frameworks that help you reason through hard choices." },
  { id: "habits",   icon: <CycleIcon />,     title: "Build better habits",  description: "Systems that turn ideas into daily action." },
  { id: "growth",   icon: <SeedlingIcon />,   title: "Grow as a person",     description: "Books for relationships, self-awareness, and everyday life." },
];

/* ── Stagger variants ── */

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.4 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

/* ── Component ── */

interface Step1PersonalizeProps {
  userName: string;
  personalizationChoice: PersonalizationChoice | null;
  onSelect: (choice: PersonalizationChoice) => void;
}

export function Step1Personalize({
  userName,
  personalizationChoice,
  onSelect,
}: Step1PersonalizeProps) {
  return (
    <div className="flex flex-col items-center w-full" style={{ maxWidth: 600 }}>
      {/* Greeting */}
      <motion.h1
        className="text-center"
        style={{
          fontFamily: "var(--font-sora)",
          fontSize: "clamp(28px, 5vw, 36px)",
          fontWeight: 700,
          color: "var(--text-heading)",
        }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" as const }}
      >
        Welcome to ChapterFlow, {userName}.
      </motion.h1>

      <motion.p
        className="text-center mt-2"
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: 16,
          color: "var(--text-secondary)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        One question so your first session feels like yours.
      </motion.p>

      {/* Question label */}
      <motion.span
        className="mt-10"
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase" as const,
          letterSpacing: "0.15em",
          color: "var(--text-muted)",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.4 }}
      >
        What matters most to you right now?
      </motion.span>

      {/* 2×2 grid (1-col on mobile) */}
      <motion.div
        className="mt-5 w-full grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-3"
        variants={gridVariants}
        initial="hidden"
        animate="show"
      >
        {options.map((opt) => (
          <motion.div key={opt.id} variants={cardVariants}>
            <OptionCard
              id={opt.id}
              icon={opt.icon}
              title={opt.title}
              description={opt.description}
              selected={personalizationChoice === opt.id}
              onSelect={(id) => onSelect(id as PersonalizationChoice)}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
