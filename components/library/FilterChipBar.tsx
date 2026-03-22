"use client";

import { TOP_CATEGORIES } from "./libraryData";

export type StatusFilter = "all" | "in_progress" | "not_started" | "completed";
export type DifficultyFilter = "easy" | "medium" | "hard";

interface FilterChipBarProps {
  statusFilter: StatusFilter;
  categoryFilters: string[];
  difficultyFilters: DifficultyFilter[];
  statusCounts: Record<StatusFilter, number>;
  onStatusChange: (status: StatusFilter) => void;
  onCategoryToggle: (category: string) => void;
  onDifficultyToggle: (difficulty: DifficultyFilter) => void;
  onClearAll: () => void;
  onOpenCategoryModal: () => void;
}

const STATUS_CHIP_STYLES: Record<
  Exclude<StatusFilter, "all">,
  { bg: string; border: string; color: string }
> = {
  in_progress: {
    bg: "rgba(45,212,191,0.12)",
    border: "rgba(45,212,191,0.3)",
    color: "var(--accent-blue)",
  },
  completed: {
    bg: "rgba(45,212,191,0.12)",
    border: "rgba(45,212,191,0.3)",
    color: "var(--accent-teal)",
  },
  not_started: {
    bg: "rgba(122,122,144,0.12)",
    border: "rgba(122,122,144,0.3)",
    color: "var(--text-secondary)",
  },
};

const DIFFICULTY_COLORS: Record<DifficultyFilter, string> = {
  easy: "var(--accent-teal)",
  medium: "var(--accent-blue)",
  hard: "var(--accent-flame)",
};

function Chip({
  active,
  onClick,
  children,
  activeStyle,
  showClose,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  activeStyle?: { bg: string; border: string; color: string };
  showClose?: boolean;
}) {
  const baseStyle = active && activeStyle
    ? {
        background: activeStyle.bg,
        border: `1px solid ${activeStyle.border}`,
        color: activeStyle.color,
      }
    : active
    ? {
        background: "var(--accent-blue)",
        border: "1px solid var(--accent-blue)",
        color: "white",
      }
    : {
        background: "transparent",
        border: "1px solid var(--border-subtle)",
        color: "var(--text-secondary)",
      };

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-all duration-200"
      style={baseStyle}
    >
      {children}
      {showClose && active && (
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-1"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
    </button>
  );
}

function Divider() {
  return (
    <div
      className="flex-shrink-0"
      style={{
        width: 1,
        height: 16,
        background: "var(--border-subtle)",
      }}
    />
  );
}

export function FilterChipBar({
  statusFilter,
  categoryFilters,
  difficultyFilters,
  statusCounts,
  onStatusChange,
  onCategoryToggle,
  onDifficultyToggle,
  onClearAll,
  onOpenCategoryModal,
}: FilterChipBarProps) {
  const hasActive =
    statusFilter !== "all" ||
    categoryFilters.length > 0 ||
    difficultyFilters.length > 0;

  return (
    <div className="scrollbar-hide mt-4 flex items-center gap-2 overflow-x-auto pb-1">
      {/* All */}
      <Chip active={statusFilter === "all"} onClick={() => onStatusChange("all")}>
        All
      </Chip>

      {/* Status chips */}
      <Chip
        active={statusFilter === "in_progress"}
        onClick={() =>
          onStatusChange(statusFilter === "in_progress" ? "all" : "in_progress")
        }
        activeStyle={STATUS_CHIP_STYLES.in_progress}
        showClose
      >
        In Progress ({statusCounts.in_progress})
      </Chip>
      <Chip
        active={statusFilter === "not_started"}
        onClick={() =>
          onStatusChange(statusFilter === "not_started" ? "all" : "not_started")
        }
        activeStyle={STATUS_CHIP_STYLES.not_started}
        showClose
      >
        Not Started ({statusCounts.not_started})
      </Chip>
      <Chip
        active={statusFilter === "completed"}
        onClick={() =>
          onStatusChange(statusFilter === "completed" ? "all" : "completed")
        }
        activeStyle={STATUS_CHIP_STYLES.completed}
        showClose
      >
        Completed ({statusCounts.completed})
      </Chip>

      <Divider />

      {/* Category chips */}
      {TOP_CATEGORIES.map((cat) => (
        <Chip
          key={cat}
          active={categoryFilters.includes(cat)}
          onClick={() => onCategoryToggle(cat)}
          showClose
        >
          {cat}
        </Chip>
      ))}

      {/* More chip */}
      <Chip active={false} onClick={onOpenCategoryModal}>
        More +
      </Chip>

      <Divider />

      {/* Difficulty chips */}
      {(["easy", "medium", "hard"] as DifficultyFilter[]).map((d) => (
        <Chip
          key={d}
          active={difficultyFilters.includes(d)}
          onClick={() => onDifficultyToggle(d)}
          showClose
        >
          <span
            className="inline-block h-[6px] w-[6px] rounded-full"
            style={{ background: DIFFICULTY_COLORS[d] }}
          />
          {d.charAt(0).toUpperCase() + d.slice(1)}
        </Chip>
      ))}

      {/* Clear all */}
      {hasActive && (
        <button
          type="button"
          onClick={onClearAll}
          className="cursor-pointer whitespace-nowrap text-[12px] transition-colors"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-heading)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          Clear all
        </button>
      )}
    </div>
  );
}
