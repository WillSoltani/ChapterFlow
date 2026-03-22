"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { FIRST_LOOP_CONTENT } from "@/app/onboarding/data/chapters";
import { ConfettiEffect } from "@/components/ui/ConfettiEffect";

interface MiniQuizProps {
  onComplete: (score: number) => void;
}

export default function MiniQuiz({ onComplete }: MiniQuizProps) {
  const prefersReducedMotion = useReducedMotion();
  const questions = FIRST_LOOP_CONTENT.quiz;

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [score, setScore] = useState(0);

  const question = questions[currentQuestion];
  const correctIndex = question.options.findIndex((o) => o.isCorrect);
  const isCorrect = selectedLetter !== null && question.options.find((o) => o.letter === selectedLetter)?.isCorrect;

  const handleSelect = useCallback(
    (letter: string) => {
      if (showFeedback) return;

      setSelectedLetter(letter);
      setShowFeedback(true);

      const correct = question.options.find((o) => o.letter === letter)?.isCorrect ?? false;

      if (correct) {
        setScore((s) => s + 1);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1500);
      }

      const advanceDelay = correct ? 800 : 1200;

      setTimeout(() => {
        if (currentQuestion < questions.length - 1) {
          setCurrentQuestion((q) => q + 1);
          setSelectedLetter(null);
          setShowFeedback(false);
        } else {
          const finalScore = correct ? score + 1 : score;
          setQuizFinished(true);
          // Use a ref-stable score since setState is async
          setTimeout(() => onComplete(finalScore), 1500);
        }
      }, advanceDelay);
    },
    [showFeedback, question, currentQuestion, questions.length, score, onComplete]
  );

  if (quizFinished) {
    const finalScore = score;
    const finalScoreText =
      finalScore === questions.length
        ? `${finalScore}/${questions.length} — Perfect score!`
        : `${finalScore}/${questions.length} — Good start!`;

    return (
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: "40px 20px",
          textAlign: "center" as const,
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-jetbrains, var(--font-dm-sans, monospace))",
            fontSize: 28,
            fontWeight: 700,
            color: "var(--text-heading, #FAFAFA)",
            margin: 0,
          }}
        >
          {finalScoreText}
        </p>
      </motion.div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      {/* Confetti */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <ConfettiEffect trigger={showConfetti} />
      </div>

      {/* Subtitle */}
      <p
        style={{
          fontFamily: "var(--font-dm-sans, sans-serif)",
          fontSize: 15,
          color: "var(--text-secondary, #8B8B9E)",
          marginBottom: 24,
        }}
      >
        See if the idea stuck.
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion}
          initial={prefersReducedMotion ? false : { opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
        >
          {/* Question label */}
          <p
            style={{
              fontFamily: "var(--font-dm-sans, sans-serif)",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--text-muted, #5A5A6E)",
              textTransform: "uppercase" as const,
              letterSpacing: "0.06em",
              marginBottom: 12,
            }}
          >
            Question {currentQuestion + 1} of {questions.length}
          </p>

          {/* Question text */}
          <p
            style={{
              fontFamily: "var(--font-dm-sans, sans-serif)",
              fontSize: 18,
              fontWeight: 500,
              color: "var(--text-primary, #E2E2E6)",
              lineHeight: 1.5,
              marginBottom: 20,
            }}
          >
            {question.question}
          </p>

          {/* Options */}
          <div
            style={{
              display: "flex",
              flexDirection: "column" as const,
              gap: 10,
            }}
          >
            {question.options.map((option, i) => {
              const isThisCorrect = option.isCorrect;
              const isThisSelected = selectedLetter === option.letter;
              const dimmed = showFeedback && !isThisSelected && !isThisCorrect;

              let borderColor = "var(--border-subtle, rgba(255,255,255,0.06))";
              let bg = "var(--bg-glass, rgba(255,255,255,0.03))";

              if (showFeedback) {
                if (isThisCorrect) {
                  borderColor = "rgba(45,212,191,0.4)";
                  bg = "rgba(45,212,191,0.08)";
                } else if (isThisSelected && !isCorrect) {
                  borderColor = "rgba(239,90,90,0.3)";
                  bg = "rgba(239,90,90,0.08)";
                }
              }

              return (
                <button
                  key={option.letter}
                  onClick={() => handleSelect(option.letter)}
                  disabled={showFeedback}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    minHeight: 48,
                    padding: "12px 16px",
                    borderRadius: "var(--radius-md-val, 12px)",
                    cursor: showFeedback ? "default" : "pointer",
                    textAlign: "left" as const,
                    transition: "background 0.2s, border-color 0.2s",
                    background: bg,
                    border: `1px solid ${borderColor}`,
                    opacity: dimmed ? 0.5 : 1,
                  }}
                >
                  {/* Radio circle */}
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      border: `2px solid ${
                        showFeedback && isThisCorrect
                          ? "var(--accent-teal, #2DD4BF)"
                          : showFeedback && isThisSelected && !isCorrect
                            ? "rgba(239,90,90,0.6)"
                            : "var(--border-medium, rgba(255,255,255,0.10))"
                      }`,
                      background:
                        showFeedback && isThisCorrect
                          ? "rgba(45,212,191,0.15)"
                          : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all 0.2s",
                    }}
                  >
                    {showFeedback && isThisCorrect && (
                      <motion.div
                        initial={prefersReducedMotion ? false : { scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 15,
                        }}
                      >
                        <Check
                          size={14}
                          style={{ color: "var(--accent-teal, #2DD4BF)" }}
                        />
                      </motion.div>
                    )}
                  </div>

                  <span
                    style={{
                      fontFamily: "var(--font-dm-sans, sans-serif)",
                      fontSize: 15,
                      color: "var(--text-primary, #E2E2E6)",
                      lineHeight: 1.4,
                    }}
                  >
                    {option.text}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Feedback text */}
          <AnimatePresence>
            {showFeedback && (
              <motion.p
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  fontFamily: "var(--font-dm-sans, sans-serif)",
                  fontSize: 14,
                  marginTop: 14,
                  color: isCorrect
                    ? "var(--accent-teal, #2DD4BF)"
                    : "var(--text-secondary, #8B8B9E)",
                  lineHeight: 1.5,
                }}
              >
                {isCorrect
                  ? "That's it!"
                  : `Not quite — ${question.explanation}`}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
