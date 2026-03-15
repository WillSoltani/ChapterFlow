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
            <p className="inline-flex rounded-full border border-emerald-300/30 bg-emerald-400/12 px-3 py-1 text-xs font-medium text-emerald-200">
              Quiz score: {Math.round(score)}%
            </p>
          ) : null}

          <div>
            <p className="text-sm font-medium text-slate-200">Summary</p>
            <div className="mt-2 space-y-1.5 text-sm text-slate-300">
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
            <p className="text-sm font-medium text-slate-200">Examples</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
              {chapter.examplesDetailed.map((example) => (
                <li key={example.id}>{example.title}</li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={onOpenReader}
            className="rounded-xl bg-linear-to-r from-sky-500 to-cyan-400 px-4 py-2 text-sm font-semibold text-white"
          >
            Open Chapter Reader
          </button>
        </div>
      ) : null}
    </InfoModal>
  );
}
