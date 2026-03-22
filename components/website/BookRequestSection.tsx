"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BookRequestForm } from "./BookRequestForm";
import { BookRequestSuccess } from "./BookRequestSuccess";

interface SubmissionData {
  title: string;
  author: string;
  email: string;
}

export function BookRequestSection() {
  const [submitted, setSubmitted] = useState(false);
  const [submissionData, setSubmissionData] = useState<SubmissionData | null>(null);

  const handleSuccess = (data: SubmissionData) => {
    setSubmissionData(data);
    setSubmitted(true);
  };

  return (
    <section className="mt-16 mb-16 max-w-[640px] mx-auto px-4">
      {/* Decorative divider */}
      <div className="flex justify-center mb-10">
        <div
          className="h-px w-[200px]"
          style={{
            background:
              "linear-gradient(to right, transparent, rgba(79,139,255,0.3), transparent)",
          }}
        />
      </div>

      {/* Glass card */}
      <div
        className="p-10 text-center rounded-2xl"
        style={{
          background: "var(--bg-glass)",
          backgroundImage:
            "linear-gradient(135deg, rgba(79,139,255,0.03), transparent 50%, rgba(45,212,191,0.03))",
          border: "1px solid var(--border-medium)",
          boxShadow: "0 0 40px rgba(79,139,255,0.04)",
        }}
      >
        {/* Icon */}
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
          style={{
            background: "rgba(79,139,255,0.08)",
            border: "1px solid rgba(79,139,255,0.12)",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-blue)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Book */}
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            {/* Plus symbol */}
            <line x1="12" y1="8" x2="12" y2="14" />
            <line x1="9" y1="11" x2="15" y2="11" />
          </svg>
        </div>

        {/* Heading */}
        <h3
          className="text-[22px] font-bold"
          style={{
            color: "var(--text-heading)",
            fontFamily: "var(--font-display)",
          }}
        >
          Not finding what you are looking for?
        </h3>

        {/* Description */}
        <p
          className="text-[15px] max-w-[460px] mx-auto mt-2"
          style={{
            color: "var(--text-secondary)",
            lineHeight: 1.7,
          }}
        >
          Tell us what book you would like to read on ChapterFlow. We will
          structure it with summaries, scenarios, and quizzes, and notify you the
          moment it is ready.
        </p>

        {/* Form / Success area */}
        <div className="mt-6 max-w-[420px] mx-auto">
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.div
                key="form"
                initial={{ opacity: 1 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <BookRequestForm onSuccess={handleSuccess} />
              </motion.div>
            ) : (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
              >
                <BookRequestSuccess
                  title={submissionData!.title}
                  email={submissionData!.email}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Trust signals */}
        <div className="flex gap-4 justify-center mt-5 flex-wrap">
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            No spam, ever
          </span>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            One notification when ready
          </span>
          <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            It is free
          </span>
        </div>
      </div>
    </section>
  );
}
