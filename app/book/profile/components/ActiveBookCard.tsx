"use client";

import { Button } from "@/app/book/components/ui/Button";
import { BookCover } from "@/components/ui/BookCover";

export function ActiveBookCard({
  title, author, bookId, coverImage, icon, progress, chapterLabel, eta, onContinue,
}: {
  title: string; author: string; bookId: string; coverImage?: string | undefined; icon: string;
  progress: number; chapterLabel: string; eta: string; onContinue: () => void;
}) {
  return (
    <div className="rounded-3xl border border-(--cf-border) bg-(--cf-surface) p-4 shadow-shadow-card">
      <div className="flex gap-4">
        <BookCover bookId={bookId} title={title} icon={icon} coverImage={coverImage} className="h-24 w-18 rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted)" fallbackClassName="text-3xl" sizes="72px" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-(--cf-text-1)">{title}</p>
          <p className="mt-1 text-sm text-(--cf-text-3)">{author}</p>
          <p className="mt-3 text-sm text-(--cf-text-2)">{chapterLabel}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-(--cf-border)">
            <div className="h-full rounded-full bg-linear-to-r from-(--cf-accent) to-(--cf-accent-strong)" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-xs text-(--cf-text-3)">{progress}% &bull; {eta}</p>
            <Button variant="secondary" size="sm" onClick={onContinue}>Continue</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
