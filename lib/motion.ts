import type { Variants, Transition } from "framer-motion";

/* ── Spring presets ── */

export const springs = {
  snappy: { type: "spring" as const, visualDuration: 0.25, bounce: 0.1 },
  default: { type: "spring" as const, visualDuration: 0.35, bounce: 0.15 },
  bouncy: { type: "spring" as const, visualDuration: 0.4, bounce: 0.25 },
  gentle: { type: "spring" as const, visualDuration: 0.5, bounce: 0.1 },
} as const;

/* ── Easing presets ── */

export const easings = {
  out: [0.25, 0.1, 0.25, 1] as const,
  outCubic: [0.22, 1, 0.36, 1] as const,
  inOut: [0.4, 0, 0.2, 1] as const,
};

/* ── Duration presets (seconds) ── */

export const durations = {
  instant: 0.1,
  micro: 0.15,
  fast: 0.2,
  normal: 0.3,
  slow: 0.5,
  page: 0.4,
  progressFill: 0.6,
  ringFill: 0.8,
  countUp: 0.6,
};

/* ── Page transition ── */

export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0 },
  transition: { duration: durations.normal, ease: easings.out },
};

/* ── Stagger containers ── */

export const staggerContainer = (
  staggerDelay = 0.05,
  delayChildren = 0
): Variants => ({
  hidden: {},
  visible: {
    transition: { staggerChildren: staggerDelay, delayChildren },
  },
});

/* ── Fade-in-up item (for use inside stagger containers) ── */

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: durations.normal, ease: easings.out },
  },
};

/* ── Card interaction presets ── */

export const cardHover = {
  whileHover: { y: -2 },
  whileTap: { scale: 0.98 },
  transition: springs.snappy,
};

export const buttonTap = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.97 },
  transition: springs.snappy,
};

/* ── Toast presets ── */

export const toastTransition: Transition = {
  ...springs.bouncy,
};

export const toastVariants: Variants = {
  initial: { x: 100, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 100, opacity: 0, transition: { duration: durations.fast } },
};

/* ── Celebration spring (badges, achievements) ── */

export const celebrationSpring = {
  type: "spring" as const,
  visualDuration: 0.4,
  bounce: 0.25,
};
