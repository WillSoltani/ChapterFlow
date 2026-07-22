"use client";

import { Button } from "@/app/book/components/ui/Button";

export function MomentumEmptyState({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="rounded-3xl border border-(--cf-border) bg-(--cf-surface-strong) p-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) text-3xl">
        📖✨
      </div>
      <h3 className="text-lg font-semibold text-(--cf-text-1)">Your next chapter is waiting</h3>
      <p className="mt-2 text-sm text-(--cf-text-3)">
        Pick a book and start your first learning loop — it takes about 15 minutes.
      </p>
      <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button variant="primary" onClick={onBrowse}>Browse Library &rarr;</Button>
        <Button variant="secondary" onClick={onBrowse}>Recommended for you &rarr;</Button>
      </div>
    </div>
  );
}
