"use client";

import { motion } from "framer-motion";
import { BookRequestForm } from "./BookRequestForm";

interface ZeroResultsStateProps {
  searchQuery: string;
  onClearSearch: () => void;
  topCategories: { name: string; count: number }[];
  onSelectCategory: (category: string) => void;
}

export function ZeroResultsState({
  searchQuery,
  onClearSearch,
  topCategories,
  onSelectCategory,
}: ZeroResultsStateProps) {
  const handleSuccess = (_data: { title: string; author: string; email: string }) => {
    // Request submitted successfully
  };

  return (
    <section className="max-w-[560px] mx-auto py-10 text-center px-4">
      {/* Empty bookshelf illustration */}
      <div className="flex justify-center mb-6">
        <svg
          width="160"
          height="120"
          viewBox="0 0 160 120"
          fill="none"
          style={{ color: "var(--text-muted)" }}
        >
          {/* Shelf lines */}
          <line
            x1="20"
            y1="45"
            x2="140"
            y2="45"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="20"
            y1="75"
            x2="140"
            y2="75"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <line
            x1="20"
            y1="105"
            x2="140"
            y2="105"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />

          {/* Book lying flat on middle shelf */}
          <rect
            x="45"
            y="68"
            width="30"
            height="6"
            rx="1"
            stroke="currentColor"
            strokeWidth="1.2"
          />
          <line
            x1="50"
            y1="69.5"
            x2="70"
            y2="69.5"
            stroke="currentColor"
            strokeWidth="0.5"
            opacity="0.5"
          />

          {/* Book leaning at angle on top shelf */}
          <g transform="rotate(-12, 95, 35)">
            <rect
              x="85"
              y="18"
              width="18"
              height="26"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            {/* Spine line */}
            <line
              x1="89"
              y1="20"
              x2="89"
              y2="42"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity="0.4"
            />
            {/* Question mark */}
            <text
              x="96"
              y="36"
              textAnchor="middle"
              fill="currentColor"
              fontSize="12"
              fontWeight="600"
              opacity="0.6"
            >
              ?
            </text>
          </g>

          {/* Shelf support lines (vertical) */}
          <line
            x1="20"
            y1="40"
            x2="20"
            y2="110"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.3"
          />
          <line
            x1="140"
            y1="40"
            x2="140"
            y2="110"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.3"
          />
        </svg>
      </div>

      {/* Heading */}
      <h2
        className="text-[24px] font-bold"
        style={{
          color: "var(--text-heading)",
          fontFamily: "var(--font-display)",
        }}
      >
        We do not have &lsquo;
        <span style={{ color: "var(--accent-blue)" }}>{searchQuery}</span>
        &rsquo; yet.
      </h2>

      {/* Description */}
      <p
        className="text-[15px] max-w-[440px] mx-auto mt-2"
        style={{ color: "var(--text-secondary)" }}
      >
        But we can make it happen. Tell us what you want to read and we will
        build it, complete with chapter summaries, scenarios, and quizzes.
      </p>

      {/* Request form */}
      <div className="mt-6 max-w-[420px] mx-auto">
        <BookRequestForm initialTitle={searchQuery} onSuccess={handleSuccess} />
      </div>

      {/* Category exploration */}
      <p
        className="text-[13px] mt-6"
        style={{ color: "var(--text-muted)" }}
      >
        Or explore what is available:
      </p>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 justify-center mt-3">
        {topCategories.slice(0, 5).map((cat) => (
          <motion.button
            key={cat.name}
            type="button"
            onClick={() => onSelectCategory(cat.name)}
            className="px-3.5 py-1.5 rounded-full text-[12px] font-medium cursor-pointer transition-all duration-200"
            style={{
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-secondary)",
              fontFamily: "var(--font-body)",
            }}
            whileHover={{
              scale: 1.05,
              borderColor: "var(--accent-blue)",
            }}
            whileTap={{ scale: 0.97 }}
          >
            {cat.name}
            <span
              className="ml-1.5 text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              {cat.count}
            </span>
          </motion.button>
        ))}
      </div>

      {/* View all link */}
      <button
        type="button"
        onClick={onClearSearch}
        className="mt-3 text-[13px] cursor-pointer bg-transparent border-none transition-opacity duration-200 hover:opacity-80"
        style={{ color: "var(--accent-blue)" }}
      >
        View all books →
      </button>
    </section>
  );
}
