"use client";

import { motion } from "framer-motion";
import Link from "next/link";

interface BookRequestSuccessProps {
  title: string;
  email: string;
}

const popularBooks = [
  {
    title: "Atomic Habits",
    gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
  },
  {
    title: "Deep Work",
    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
  },
  {
    title: "Thinking Fast and Slow",
    gradient: "linear-gradient(135deg, #14b8a6, #0d9488)",
  },
];

export function BookRequestSuccess({ title, email }: BookRequestSuccessProps) {
  return (
    <motion.div
      className="flex flex-col items-center text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Checkmark circle */}
      <motion.div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: "var(--accent-teal)" }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 12 }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </motion.div>

      {/* Heading */}
      <p
        className="text-[18px] font-semibold mt-4"
        style={{
          color: "var(--accent-teal)",
          fontFamily: "var(--font-display)",
        }}
      >
        Request received!
      </p>

      {/* Confirmation message */}
      <p
        className="text-[14px] mt-2"
        style={{ color: "var(--text-secondary)" }}
      >
        We will email you at {email} when &lsquo;{title}&rsquo; is ready.
      </p>

      {/* Suggestion */}
      <p
        className="text-[12px] mt-3"
        style={{ color: "var(--text-muted)" }}
      >
        In the meantime, start with our most popular books:
      </p>

      {/* Mini book covers */}
      <div className="flex gap-3 justify-center mt-2">
        {popularBooks.map((book) => (
          <motion.div
            key={book.title}
            className="flex items-center justify-center rounded-md overflow-hidden"
            style={{
              width: 60,
              height: 80,
              background: book.gradient,
            }}
            whileHover={{ y: -2 }}
            transition={{ duration: 0.2 }}
          >
            <span className="text-white text-[7px] font-bold uppercase tracking-wider text-center leading-tight px-1">
              {book.title}
            </span>
          </motion.div>
        ))}
      </div>

      {/* CTA button */}
      <Link
        href="/auth/login?returnTo=%2Fbook"
        className="inline-flex items-center gap-1 mt-4 px-6 py-2.5 rounded-lg text-[14px] font-semibold text-white transition-all duration-200 hover:scale-[1.02]"
        style={{
          background: "var(--accent-green)",
          fontFamily: "var(--font-body)",
        }}
      >
        Start reading free →
      </Link>
    </motion.div>
  );
}
