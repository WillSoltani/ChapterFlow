"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";
import { getFirstLoopContent, getQuizFeedback } from "@/app/onboarding/data/chapters";
import { useOnboarding } from "@/app/onboarding/hooks/useOnboarding";
import CanvasConfetti from "./CanvasConfetti";

interface MiniQuizProps {
  onComplete: (score: number) => void;
}

export default function MiniQuiz({ onComplete }: MiniQuizProps) {
  const prefersReducedMotion = useReducedMotion();
  const noMotion = !!prefersReducedMotion;
  const { tone } = useOnboarding();
  const content = getFirstLoopContent(tone);
  const questions = content.quiz;
  const feedback = getQuizFeedback(tone);

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showMiniConfetti, setShowMiniConfetti] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [score, setScore] = useState(0);

  const question = questions[currentQuestion];
  const isCorrect =
    selectedLetter !== null &&
    question.options.find((o) => o.letter === selectedLetter)?.isCorrect;

  const handleSelect = useCallback(
    (letter: string) => {
      if (showFeedback) return;

      setSelectedLetter(letter);
      setShowFeedback(true);

      const correct =
        question.options.find((o) => o.letter === letter)?.isCorrect ?? false;

      if (correct) {
        setScore((s) => s + 1);
        setShowMiniConfetti(true);
        setTimeout(() => setShowMiniConfetti(false), 2000);
      }

      const advanceDelay = correct ? 1000 : 1500;

      setTimeout(() => {
        if (currentQuestion < questions.length - 1) {
          setCurrentQuestion((q) => q + 1);
          setSelectedLetter(null);
          setShowFeedback(false);
        } else {
          const finalScore = correct ? score + 1 : score;
          setQuizFinished(true);
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
    const scoreColor = finalScore === questions.length ? "#3ECFB2" : "#5B8DEF";

    return (
      <motion.div
        initial={noMotion ? false : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: "40px 20px",
          textAlign: "center",
        }}
      >
        <p
          style={{
            fontFamily:
              "var(--font-jetbrains, 'JetBrains Mono', monospace)",
            fontSize: 28,
            fontWeight: 700,
            color: scoreColor,
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
      {/* Mini confetti on correct answer */}
      {showMiniConfetti && (
        <CanvasConfetti particleCount={30} duration={1500} />
      )}

      {/* Subtitle */}
      <p
        style={{
          fontFamily: "var(--font-dm-sans, sans-serif)",
          fontSize: 15,
          color: "var(--cf-text-3)",
          marginBottom: 24,
        }}
      >
        See if the idea stuck.
      </p>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestion}
          initial={noMotion ? false : { opacity: 0, x: 30 }}
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
              color: "var(--cf-text-soft)",
              textTransform: "uppercase",
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
              color: "var(--cf-text-1)",
              lineHeight: 1.5,
              marginBottom: 20,
            }}
          >
            {question.question}
          </p>

          {/* Answer options — full glass cards, no radio circles */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {question.options.map((option) => {
              const isThisCorrect = option.isCorrect;
              const isThisSelected = selectedLetter === option.letter;
              const dimmed =
                showFeedback && !isThisSelected && !isThisCorrect;

              let borderStyle = "1px solid var(--cf-border)";
              let bg = "var(--cf-surface-muted)";

              if (showFeedback) {
                if (isThisCorrect) {
                  borderStyle = "2px solid #3ECFB2";
                  bg = "rgba(62,207,178,0.12)";
                } else if (isThisSelected && !isCorrect) {
                  borderStyle = "2px solid rgba(239,68,68,0.5)";
                  bg = "rgba(239,68,68,0.10)";
                }
              }

              return (
                <motion.button
                  key={option.letter}
                  onClick={() => handleSelect(option.letter)}
                  disabled={showFeedback}
                  whileHover={
                    !showFeedback && !noMotion ? { scale: 1.01 } : {}
                  }
                  whileTap={
                    !showFeedback && !noMotion ? { scale: 0.98 } : {}
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    width: "100%",
                    minHeight: 48,
                    padding: showFeedback && (isThisCorrect || (isThisSelected && !isCorrect))
                      ? "11px 15px"
                      : "12px 16px",
                    borderRadius: 12,
                    cursor: showFeedback ? "default" : "pointer",
                    textAlign: "left",
                    transition: "background 0.2s, border-color 0.2s, opacity 0.2s",
                    background: bg,
                    border: borderStyle,
                    opacity: dimmed ? 0.4 : 1,
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    outline: "none",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-dm-sans, sans-serif)",
                      fontSize: 15,
                      color: "var(--cf-text-1)",
                      lineHeight: 1.4,
                    }}
                  >
                    {option.letter}) {option.text}
                  </span>

                  {/* Checkmark for correct answer */}
                  {showFeedback && isThisCorrect && (
                    <motion.div
                      initial={noMotion ? false : { scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 25,
                      }}
                      style={{ flexShrink: 0 }}
                    >
                      <CheckCircle
                        size={20}
                        style={{ color: "#3ECFB2" }}
                      />
                    </motion.div>
                  )}

                  {/* X for wrong selection */}
                  {showFeedback && isThisSelected && !isCorrect && (
                    <motion.div
                      initial={noMotion ? false : { scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 25,
                      }}
                      style={{ flexShrink: 0 }}
                    >
                      <XCircle
                        size={20}
                        style={{ color: "rgba(239,68,68,0.7)" }}
                      />
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>

          {/* Feedback text */}
          <AnimatePresence>
            {showFeedback && (
              <motion.p
                initial={noMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  fontFamily: "var(--font-dm-sans, sans-serif)",
                  fontSize: 14,
                  marginTop: 14,
                  fontWeight: isCorrect ? 500 : 400,
                  color: isCorrect ? "#3ECFB2" : "var(--cf-text-3)",
                  lineHeight: 1.5,
                }}
              >
                {isCorrect
                  ? feedback.correct
                  : question.explanation}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
