"use client";

import { motion } from "framer-motion";

interface OnboardingFooterProps {
  currentStep: 1 | 2 | 3;
  buttonText: string;
  buttonDisabled: boolean;
  onButtonClick: () => void;
  visible: boolean;
}

export function OnboardingFooter({
  currentStep,
  buttonText,
  buttonDisabled,
  onButtonClick,
  visible,
}: OnboardingFooterProps) {
  if (!visible) return null;

  const isStep3 = currentStep === 3;
  const label = buttonText.replace(" →", "");

  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-40 flex flex-col items-center gap-3 md:flex-row md:justify-between"
      style={{ padding: isStep3 ? "20px 20px" : "16px 20px" }}
    >
      <span
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: 13,
          color: "var(--text-muted)",
        }}
      >
        Step {currentStep} of 3
      </span>

      <motion.button
        onClick={onButtonClick}
        disabled={buttonDisabled}
        className="w-full cursor-pointer md:w-auto"
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: 15,
          fontWeight: 600,
          color: "#fff",
          background: "var(--accent-green)",
          padding: isStep3 ? "14px 32px" : "12px 28px",
          borderRadius: "var(--radius-md-val)",
          border: "none",
          opacity: buttonDisabled ? 0.35 : 1,
          pointerEvents: buttonDisabled ? "none" : "auto",
        }}
        whileHover={
          buttonDisabled
            ? undefined
            : {
                scale: 1.02,
                backgroundColor: "#22C55E",
                boxShadow: "0 0 16px rgba(52,211,153,0.15)",
              }
        }
        whileTap={buttonDisabled ? undefined : { scale: 0.98 }}
        /* Step 3 pulse glow */
        {...(isStep3 && !buttonDisabled
          ? {
              animate: {
                boxShadow: [
                  "0 0 0 0 rgba(52,211,153,0)",
                  "0 0 20px 4px rgba(52,211,153,0.15)",
                  "0 0 0 0 rgba(52,211,153,0)",
                ],
              },
              transition: {
                boxShadow: {
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut" as const,
                },
              },
            }
          : {})}
      >
        {label}{" "}
        <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">
          &rarr;
        </span>
      </motion.button>
    </footer>
  );
}
