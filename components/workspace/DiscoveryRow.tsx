"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BookCardWorkspace } from "./BookCardWorkspace";

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

interface DiscoveryRowProps {
  books: ProBook[];
  isPro: boolean;
}

const ease = [0.22, 1, 0.36, 1] as const;

export function DiscoveryRow({ books, isPro }: DiscoveryRowProps) {
  const prefersReducedMotion = useReducedMotion();

  if (books.length === 0) return null;

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
      {/* Header */}
      <h2
        className="mb-4 font-(family-name:--font-display) text-xl font-semibold"
        style={{ color: "#F0F0F0" }}
      >
        Recommended for You
      </h2>

      {/* Book cards */}
      <div
        className="hide-scrollbar flex gap-3 overflow-x-auto pb-2"
        role="list"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {books.map((book, i) => (
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
            <BookCardWorkspace variant="pro" book={book} />
          </motion.div>
        ))}
      </div>

      {/* Pro conversion banner (free users only) */}
      {!isPro && (
        <motion.div
          className="mt-4 rounded-xl px-6 py-4 text-center"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
          initial={prefersReducedMotion ? undefined : { opacity: 0 }}
          whileInView={prefersReducedMotion ? undefined : { opacity: 1 }}
          viewport={{ once: true }}
          transition={
            prefersReducedMotion
              ? undefined
              : { duration: 0.5, delay: 0.3, ease }
          }
        >
          <p className="text-sm" style={{ color: "#A0A0B8" }}>
            Unlock your full library — 95+ books across 21 categories
          </p>
          <button
            className="mt-2.5 cursor-pointer rounded-lg px-6 py-2 text-sm font-semibold text-white transition-all hover:scale-[1.02]"
            style={{
              background: "linear-gradient(135deg, #7C3AED, #6D28D9)",
              boxShadow: "0 0 16px rgba(124,58,237,0.25)",
            }}
          >
            Go Pro — $7.99/mo
          </button>
          <p className="mt-1.5 text-[11px]" style={{ color: "#6B6B80" }}>
            Join 2,400+ Pro readers
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
