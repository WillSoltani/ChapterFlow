"use client";

import { InfoModal } from "@/app/book/home/components/InfoModal";
import type { BookChapter } from "@/app/book/data/mockChapters";

type ChapterSummaryModalProps = {
  open: boolean;
  chapter: BookChapter | null;
  score?: number;
  onClose: () => void;
  onOpenReader: () => void;
};

export function ChapterSummaryModal({
  open,
  chapter,
  score,
  onClose,
  onOpenReader,
}: ChapterSummaryModalProps) {
  return (
    <InfoModal
      open={open}
      title={chapter ? `${chapter.code} · ${chapter.title}` : "Chapter Summary"}
      onClose={onClose}
    >
      {chapter ? (
        <div className="space-y-4">
          {typeof score === "number" ? (
            <p className="inline-flex rounded-full border border-(--cf-success-border) bg-(--cf-success-soft) px-3 py-1 text-xs font-medium text-(--cf-success-text)">
              Quiz score: {Math.round(score)}%
            </p>
          ) : null}

          <div>
            <p className="text-sm font-medium text-(--cf-text-1)">Summary</p>
            <div className="mt-2 space-y-1.5 text-sm text-(--cf-text-2)">
              {chapter.summaryByDepth.standard.map((block) => (
                block.type === "paragraph" ? (
                  <p key={block.id}>{block.text}</p>
                ) : (
                  <p key={block.id} className="pl-2">
                    • {block.text}
                  </p>
                )
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-(--cf-text-1)">Examples</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-(--cf-text-2)">
              {chapter.examplesDetailed.map((example) => (
                <li key={example.id}>{example.title}</li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={onOpenReader}
            className="rounded-xl bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong) px-4 py-2 text-sm font-semibold text-white"
          >
            Open Chapter Reader
          </button>
        </div>
      ) : null}
    </InfoModal>
  );
}
