"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BookCardWorkspace } from "./BookCardWorkspace";

interface UserBook {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  progressPercent: number;
  status: "not_started" | "in_progress" | "completed";
  gradient?: string;
}

interface ProBook {
  id: string;
  title: string;
  author: string;
  coverUrl: string;
  rating: number;
  readerCount: number;
  category: string;
  gradient?: string;
}

interface BookRowProps {
  userBooks: UserBook[];
  recommendedProBooks: ProBook[];
  isNewUser?: boolean;
}

const ease = [0.22, 1, 0.36, 1] as const;

export function BookRow({
  userBooks,
  recommendedProBooks,
  isNewUser = false,
}: BookRowProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className="mt-9"
      initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16 }}
      whileInView={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={
        prefersReducedMotion
          ? undefined
          : { duration: 0.5, ease }
      }
    >
      {/* Section header */}
      <div className="mb-4 flex items-end justify-between">
        <h2
          className="font-(family-name:--font-display) text-xl font-semibold"
          style={{ color: "#F0F0F0" }}
        >
          {isNewUser ? "Build Your Bookshelf" : "Your Books"}
        </h2>
        <button
          className="cursor-pointer text-sm font-medium transition-colors hover:underline"
          style={{ color: "#7C3AED" }}
        >
          Browse Library →
        </button>
      </div>

      {/* Horizontal scroll row */}
      <div
        className="hide-scrollbar flex gap-3 overflow-x-auto pb-2"
        role="list"
        style={{
          scrollSnapType: "x mandatory",
        }}
      >
        {/* User's books */}
        {userBooks.map((book, i) => (
          <motion.div
            key={book.id}
            style={{ scrollSnapAlign: "start" }}
            initial={
              prefersReducedMotion ? undefined : { opacity: 0, y: 12 }
            }
            whileInView={
              prefersReducedMotion ? undefined : { opacity: 1, y: 0 }
            }
            viewport={{ once: true }}
            transition={
              prefersReducedMotion
                ? undefined
                : { duration: 0.4, delay: i * 0.06, ease }
            }
          >
            <BookCardWorkspace variant="user" book={book} />
          </motion.div>
        ))}

        {/* Pro recommendations */}
        {recommendedProBooks.map((book, i) => (
          <motion.div
            key={book.id}
            style={{ scrollSnapAlign: "start" }}
            initial={
              prefersReducedMotion ? undefined : { opacity: 0, y: 12 }
            }
            whileInView={
              prefersReducedMotion ? undefined : { opacity: 1, y: 0 }
            }
            viewport={{ once: true }}
            transition={
              prefersReducedMotion
                ? undefined
                : {
                    duration: 0.4,
                    delay: (userBooks.length + i) * 0.06,
                    ease,
                  }
            }
          >
            <BookCardWorkspace variant="pro" book={book} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
