import { DUR, EASE } from "@/lib/motion";

export const badgeContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

export const badgeItemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: DUR.page, ease: EASE.standard } },
};
