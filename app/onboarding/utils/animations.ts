import type { Variants, Transition } from "framer-motion";

/* ── Step transition variants (direction-aware) ── */

export const stepVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? 50 : -50,
  }),
  center: {
    opacity: 1,
    x: 0,
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction > 0 ? -50 : 50,
  }),
};

export const stepTransition: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

/* ── Card stagger variants ── */

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.15,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

/* ── Fade-in variants ── */

export const fadeIn: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

export const fadeInDelay = (delay: number): Variants => ({
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, delay, ease: "easeOut" },
  },
});

/* ── Checkmark spring ── */

export const checkmarkSpring = {
  initial: { scale: 0 },
  animate: { scale: [0, 1.3, 1] },
  transition: { type: "spring" as const, stiffness: 500, damping: 25 },
};

/* ── Sub-step transition (for Step 5 inner content) ── */

export const subStepVariants: Variants = {
  enter: { opacity: 0, x: 30 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
};

export const subStepTransition: Transition = {
  duration: 0.3,
  ease: [0.22, 1, 0.36, 1],
};
