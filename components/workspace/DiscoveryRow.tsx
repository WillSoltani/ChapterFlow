"use client";

import Link from "next/link";
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
  reason?: string;
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
        style={{ color: "var(--cf-text-1)" }}
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
            className="flex flex-col"
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
            {book.reason && (
              <p
                className="mb-1.5 max-w-[170px] truncate text-[10px] font-medium"
                style={{ color: "var(--accent-emerald)" }}
              >
                Based on {book.reason}
              </p>
            )}
            {isPro ? (
              <BookCardWorkspace
                variant="user"
                book={{ id: book.id, title: book.title, author: book.author, coverUrl: book.coverUrl, progressPercent: 0, status: "not_started" as const, gradient: book.gradient }}
              />
            ) : (
              <BookCardWorkspace
                variant="pro"
                book={book}
              />
            )}
          </motion.div>
        ))}
      </div>

      {/* Pro conversion banner (free users only) */}
      {!isPro && (
        <motion.div
          className="mt-4 rounded-xl px-6 py-6 text-center"
          style={{
            background: "var(--cf-surface-muted)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid var(--cf-border)",
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
          <p className="text-sm" style={{ color: "var(--cf-text-3)" }}>
            Unlock your full library — 95+ books across 21 categories
          </p>
          <Link href="/pricing">
          <motion.span
            className="mt-3 inline-flex cursor-pointer items-center rounded-xl px-6 py-2.5 text-sm font-semibold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-(--cf-page-bg)"
            style={{
              background: "linear-gradient(to right, #f59e0b, #fbbf24)",
              boxShadow:
                "0 0 25px -5px rgba(245, 158, 11, 0.45), 0 4px 12px -3px rgba(245, 158, 11, 0.25)",
              transition: "box-shadow 300ms ease",
            }}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow =
                "0 0 35px -5px rgba(245, 158, 11, 0.65), 0 4px 15px -3px rgba(245, 158, 11, 0.35)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow =
                "0 0 25px -5px rgba(245, 158, 11, 0.45), 0 4px 12px -3px rgba(245, 158, 11, 0.25)";
            }}
          >
            Go Pro — $7.99/mo
          </motion.span>
          </Link>
          <p
            className="mt-2 text-xs"
            style={{ color: "var(--cf-text-soft)" }}
          >
            Join 2,400+ Pro readers
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
