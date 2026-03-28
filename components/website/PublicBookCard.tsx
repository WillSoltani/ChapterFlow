"use client";

import { motion } from "framer-motion";
import { useState } from "react";

export interface PublicBookCardProps {
  id: string;
  title: string;
  author: string;
  category: string;
  chapters: number;
  difficulty: "easy" | "medium" | "hard";
  coverGradient: string;
  estimatedHours: number;
  isNew?: boolean;
  staffPick?: boolean;
  popular?: boolean;
  coverId?: string;
}

const difficultyColor: Record<PublicBookCardProps["difficulty"], string> = {
  easy: "var(--accent-teal)",
  medium: "var(--accent-blue)",
  hard: "var(--accent-amber)",
};

export function PublicBookCard({
  id,
  title,
  author,
  category,
  chapters,
  difficulty,
  coverGradient,
  estimatedHours,
  isNew,
  coverId,
}: PublicBookCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const coverPath = `/book-covers/${coverId || id}.jpg`;

  return (
    <motion.div
      layout
      className="group cursor-pointer"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Cover */}
      <div
        className="relative w-full overflow-hidden rounded-lg"
        style={{ aspectRatio: "2/3" }}
      >
        {/* Real cover image or gradient fallback */}
        {!imgFailed ? (
          <img
            src={coverPath}
            alt={`${title} cover`}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgFailed(true)}
            loading="lazy"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center p-4"
            style={{ background: coverGradient }}
          >
            <span className="text-white text-[10px] font-bold uppercase tracking-wider text-center leading-tight">
              {title}
            </span>
          </div>
        )}

        {/* Bottom inner shadow for readability */}
        <div
          className="absolute bottom-0 left-0 right-0 h-1/3"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.4), transparent)",
          }}
        />

        {/* Category badge: always visible on mobile, hover-only on desktop */}
        <div className="absolute top-2 left-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
          <span
            className="text-[8px] font-semibold rounded-full px-2 py-0.5"
            style={{
              color: "var(--text-primary)",
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            {category}
          </span>
        </div>

        {/* "New" badge */}
        {isNew && (
          <div className="absolute top-2 right-2">
            <span
              className="text-[7px] font-bold uppercase rounded-full px-1.5 py-0.5"
              style={{ background: "var(--accent-green)", color: "white" }}
            >
              New
            </span>
          </div>
        )}

        {/* Hover overlay (desktop) */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-250 flex flex-col justify-end p-3 pointer-events-none"
          style={{
            background:
              "linear-gradient(to top, rgba(11,11,15,0.9) 0%, rgba(11,11,15,0.4) 40%, transparent 70%)",
          }}
        >
          <span className="text-[9px]" style={{ color: "var(--text-secondary)" }}>
            {chapters} chapters · ~{estimatedHours}h
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: difficultyColor[difficulty] }}
            />
            <span
              className="text-[9px] capitalize"
              style={{ color: "var(--text-muted)" }}
            >
              {difficulty}
            </span>
          </div>
          <span
            className="text-[10px] font-semibold mt-2"
            style={{ color: "var(--accent-green)" }}
          >
            Start reading free →
          </span>
        </div>

        {/* Border overlay */}
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{ border: "1px solid rgba(255,255,255,0.06)" }}
        />
      </div>

      {/* Title + Author below cover */}
      <p
        className="text-[14px] font-semibold mt-2.5 line-clamp-2"
        style={{ color: "var(--text-heading)" }}
      >
        {title}
      </p>
      <p className="text-[12px] mt-0.5" style={{ color: "var(--text-muted)" }}>
        {author}
      </p>
    </motion.div>
  );
}
