"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, BookOpen, Settings } from "lucide-react";
import type { LibraryBookEntry } from "@/app/book/_lib/library-data";

type BookDetailsProps = {
  entry: LibraryBookEntry;
  synopsis: string;
  estimatedDaysToFinish: number;
  onResetProgress: () => void;
  onRemoveFromLibrary: () => void;
};

function difficultyNote(difficulty: LibraryBookEntry["difficulty"]): string {
  if (difficulty === "Easy")
    return "Accessible concepts with light implementation effort.";
  if (difficulty === "Medium")
    return "Balanced depth with practical strategy and execution.";
  return "Dense concepts requiring slower, deliberate study sessions.";
}

export function BookDetails({
  entry,
  synopsis,
  estimatedDaysToFinish,
  onResetProgress,
  onRemoveFromLibrary,
}: BookDetailsProps) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <section className="space-y-3">
      {/* About This Book */}
      <div className="cf-panel overflow-hidden rounded-2xl">
        <button
          type="button"
          onClick={() => setAboutOpen((prev) => !prev)}
          aria-expanded={aboutOpen}
          aria-controls="bd-about-panel"
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-(--cf-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--cf-page-bg)"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium text-(--cf-text-1)">
            <BookOpen className="h-4 w-4 text-(--cf-text-3)" />
            About This Book
          </span>
          {aboutOpen ? (
            <ChevronUp className="h-4 w-4 text-(--cf-text-3)" />
          ) : (
            <ChevronDown className="h-4 w-4 text-(--cf-text-3)" />
          )}
        </button>

        {aboutOpen && (
          <div id="bd-about-panel" className="space-y-3 border-t border-(--cf-border) px-5 py-4">
            <p className="text-sm leading-relaxed text-(--cf-text-2)">{synopsis}</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-(--cf-text-3)">
              <span>
                Estimated pace: ~{estimatedDaysToFinish} day
                {estimatedDaysToFinish === 1 ? "" : "s"} at your daily goal
              </span>
              <span>Difficulty: {entry.difficulty}</span>
            </div>
            <p className="text-xs text-(--cf-text-3)">{difficultyNote(entry.difficulty)}</p>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="cf-panel overflow-hidden rounded-2xl">
        <button
          type="button"
          onClick={() => setSettingsOpen((prev) => !prev)}
          aria-expanded={settingsOpen}
          aria-controls="bd-settings-panel"
          className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-(--cf-surface-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--cf-accent) focus-visible:ring-offset-2 focus-visible:ring-offset-(--cf-page-bg)"
        >
          <span className="inline-flex items-center gap-2 text-sm font-medium text-(--cf-text-1)">
            <Settings className="h-4 w-4 text-(--cf-text-3)" />
            Settings
          </span>
          {settingsOpen ? (
            <ChevronUp className="h-4 w-4 text-(--cf-text-3)" />
          ) : (
            <ChevronDown className="h-4 w-4 text-(--cf-text-3)" />
          )}
        </button>

        {settingsOpen && (
          <div id="bd-settings-panel" className="border-t border-(--cf-border) px-5 py-4">
            <p className="text-xs text-(--cf-text-3)">
              These actions are permanent and cannot be undone.
            </p>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={onResetProgress}
                className="cf-btn cf-btn-danger w-full rounded-xl px-3 py-3 text-sm font-medium"
              >
                Reset progress
              </button>
              <button
                type="button"
                onClick={onRemoveFromLibrary}
                className="cf-btn cf-btn-secondary w-full rounded-xl px-3 py-3 text-sm"
              >
                Remove from library
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
