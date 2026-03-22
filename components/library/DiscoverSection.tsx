"use client";

import { motion } from "framer-motion";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { DiscoverRow } from "./DiscoverRow";
import { CURATED_ROWS, resolveCuratedRow } from "./libraryData";
import type { LibraryBook } from "./libraryData";

interface DiscoverSectionProps {
  books: LibraryBook[];
  onBookClick: (bookId: string) => void;
  onBookmark: (bookId: string) => void;
}

export function DiscoverSection({
  books,
  onBookClick,
  onBookmark,
}: DiscoverSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="mt-12"
      style={{ maxWidth: 1080, margin: "48px auto 0" }}
    >
      <SectionLabel className="!text-(--accent-blue)">Discover</SectionLabel>

      {CURATED_ROWS.map((row, i) => {
        const rowBooks = resolveCuratedRow(row, books);
        return (
          <motion.div
            key={row.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 * (i + 1) }}
          >
            <DiscoverRow
              title={row.title}
              books={rowBooks}
              onBookClick={onBookClick}
              onBookmark={onBookmark}
            />
          </motion.div>
        );
      })}
    </motion.section>
  );
}
