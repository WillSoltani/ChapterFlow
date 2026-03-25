"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion, useDragControls } from "framer-motion";
import { X } from "lucide-react";
import type { OnboardingBook } from "@/app/onboarding/data/books";

interface BookSwapSheetProps {
  open: boolean;
  alternatives: OnboardingBook[];
  onSelect: (book: OnboardingBook) => void;
  onClose: () => void;
}

export default function BookSwapSheet({
  open,
  alternatives,
  onSelect,
  onClose,
}: BookSwapSheetProps) {
  const prefersReducedMotion = useReducedMotion();
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  function getDifficultyStyle(difficulty: string) {
    switch (difficulty?.toLowerCase()) {
      case "hard":
        return {
          background: "rgba(232,185,49,0.12)",
          color: "#E8B931",
          border: "1px solid rgba(232,185,49,0.2)",
        };
      case "easy":
        return {
          background: "rgba(45,212,191,0.12)",
          color: "#2DD4BF",
          border: "1px solid rgba(45,212,191,0.2)",
        };
      case "medium":
      default:
        return {
          background: "rgba(79,139,255,0.12)",
          color: "#4F8BFF",
          border: "1px solid rgba(79,139,255,0.2)",
        };
    }
  }

  function handleSelect(book: OnboardingBook) {
    onSelect(book);
    onClose();
  }

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const mobileSheetVariants = {
    hidden: { y: "100%" },
    visible: { y: 0 },
    exit: { y: "100%" },
  };

  const desktopModalVariants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
  };

  const transition = prefersReducedMotion
    ? { duration: 0.01 }
    : { type: "spring" as const, damping: 30, stiffness: 300 };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="backdrop"
          variants={backdropVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={{ duration: prefersReducedMotion ? 0.01 : 0.2 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "var(--cf-overlay)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          {/* Mobile sheet (<640px) */}
          <motion.div
            ref={sheetRef}
            key="mobile-sheet"
            className="swap-sheet-mobile"
            variants={mobileSheetVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={transition}
            drag="y"
            dragControls={dragControls}
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) onClose();
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: "80vh",
              background: "var(--cf-surface)",
              borderTop: "1px solid var(--cf-border)",
              borderRadius: "var(--radius-xl-val, 24px) var(--radius-xl-val, 24px) 0 0",
              padding: "12px 20px 32px",
              overflowY: "auto",
              display: "none",
            }}
          >
            {/* Drag handle */}
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: "var(--cf-text-soft)",
                margin: "0 auto 16px",
              }}
            />
            <SheetContent
              alternatives={alternatives}
              onSelect={handleSelect}
              onClose={onClose}
              getDifficultyStyle={getDifficultyStyle}
            />
          </motion.div>

          {/* Desktop modal (>=640px) */}
          <motion.div
            key="desktop-modal"
            className="swap-sheet-desktop"
            variants={desktopModalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={transition}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: "100%",
              maxWidth: 480,
              maxHeight: "80vh",
              background: "var(--cf-surface)",
              border: "1px solid var(--cf-border)",
              borderRadius: "var(--radius-xl-val, 24px)",
              padding: "24px",
              overflowY: "auto",
              boxShadow: "var(--cf-shadow-md)",
              display: "none",
            }}
          >
            <SheetContent
              alternatives={alternatives}
              onSelect={handleSelect}
              onClose={onClose}
              getDifficultyStyle={getDifficultyStyle}
            />
          </motion.div>

          <style>{`
            @media (max-width: 639px) {
              .swap-sheet-mobile { display: flex !important; flex-direction: column; }
              .swap-sheet-desktop { display: none !important; }
            }
            @media (min-width: 640px) {
              .swap-sheet-mobile { display: none !important; }
              .swap-sheet-desktop { display: flex !important; flex-direction: column; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SheetContent({
  alternatives,
  onSelect,
  onClose,
  getDifficultyStyle,
}: {
  alternatives: OnboardingBook[];
  onSelect: (book: OnboardingBook) => void;
  onClose: () => void;
  getDifficultyStyle: (d: string) => React.CSSProperties;
}) {
  return (
    <>
      <h3
        style={{
          fontFamily: "var(--font-sora, sans-serif)",
          fontSize: 18,
          fontWeight: 600,
          color: "var(--cf-text-1)",
          marginBottom: 4,
        }}
      >
        Swap this book
      </h3>
      <p
        style={{
          fontFamily: "var(--font-dm-sans, sans-serif)",
          fontSize: 14,
          color: "var(--cf-text-3)",
          marginBottom: 16,
        }}
      >
        Pick an alternative from the list below.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {alternatives.map((book) => (
          <button
            key={book.id ?? book.title}
            onClick={() => onSelect(book)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              minHeight: 48,
              padding: "10px 12px",
              background: "var(--cf-surface)",
              border: "1px solid var(--cf-border)",
              borderRadius: "var(--radius-md-val, 12px)",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "var(--cf-surface-muted)";
              e.currentTarget.style.borderColor =
                "var(--cf-border-strong)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background =
                "var(--cf-surface)";
              e.currentTarget.style.borderColor =
                "var(--cf-border)";
            }}
          >
            {/* Gradient cover thumbnail */}
            <div
              style={{
                width: 40,
                height: 56,
                borderRadius: 6,
                background: book.gradient,
                flexShrink: 0,
                boxShadow: "var(--cf-shadow-sm)",
              }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              <p
                style={{
                  fontFamily: "var(--font-dm-sans, sans-serif)",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--cf-text-1)",
                  margin: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {book.title}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-dm-sans, sans-serif)",
                  fontSize: 12,
                  color: "var(--cf-text-soft)",
                  margin: "2px 0 6px",
                }}
              >
                {book.author}
              </p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {book.category && (
                  <span
                    style={{
                      fontFamily: "var(--font-dm-sans, sans-serif)",
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 100,
                      background: "var(--cf-surface)",
                      border: "1px solid var(--cf-border)",
                      color: "var(--cf-text-3)",
                    }}
                  >
                    {book.category}
                  </span>
                )}
                {book.difficulty && (
                  <span
                    style={{
                      fontFamily: "var(--font-dm-sans, sans-serif)",
                      fontSize: 11,
                      padding: "2px 8px",
                      borderRadius: 100,
                      ...getDifficultyStyle(book.difficulty),
                    }}
                  >
                    {book.difficulty}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={onClose}
        style={{
          width: "100%",
          minHeight: 48,
          marginTop: 16,
          padding: "12px 24px",
          fontFamily: "var(--font-dm-sans, sans-serif)",
          fontSize: 15,
          fontWeight: 500,
          color: "var(--cf-text-3)",
          background: "transparent",
          border: "1px solid var(--cf-border)",
          borderRadius: "var(--radius-md-val, 12px)",
          cursor: "pointer",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background =
            "var(--cf-surface)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
      >
        Cancel
      </button>
    </>
  );
}
