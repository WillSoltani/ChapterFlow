"use client";

import { useState } from "react";
import { useReviewQueue } from "@/app/book/hooks/useReviewQueue";
import type { FSRSRating } from "@/app/app/api/book/_lib/types";

type Props = {
  bookId?: string;
  onClose: () => void;
};

const RATING_CONFIG: Record<FSRSRating, { label: string; sublabel: string; className: string }> = {
  1: { label: "Again", sublabel: "Review tomorrow", className: "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20" },
  2: { label: "Hard", sublabel: "Review in 2-3 days", className: "border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20" },
  3: { label: "Good", sublabel: "Review in ~1 week", className: "border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20" },
  4: { label: "Easy", sublabel: "Review in ~2 weeks", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" },
};

export function ReviewSessionFSRS({ bookId, onClose }: Props) {
  const {
    currentCard,
    isComplete,
    remaining,
    loading,
    cards,
    submitRating,
  } = useReviewQueue(bookId);

  const [flipped, setFlipped] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-500" />
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="max-w-md rounded-xl bg-gray-900 p-8 text-center">
          <p className="text-lg font-semibold text-gray-100">No reviews pending</p>
          <p className="mt-2 text-sm text-gray-400">Check back tomorrow!</p>
          <button
            onClick={onClose}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="max-w-md rounded-xl bg-gray-900 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
            <span className="text-2xl">&#10003;</span>
          </div>
          <p className="text-xl font-bold text-gray-100">Review Complete!</p>
          <p className="mt-2 text-sm text-gray-400">
            Reviewed {cards.length} card{cards.length !== 1 ? "s" : ""}. Your memory is getting stronger.
          </p>
          <button
            onClick={onClose}
            className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  if (!currentCard) return null;

  const handleRate = async (rating: FSRSRating) => {
    setSubmitting(true);
    await submitRating(rating);
    setFlipped(false);
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <span className="text-sm font-semibold text-gray-200">Spaced Review</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{remaining} remaining</span>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            &#10005;
          </button>
        </div>
      </div>

      {/* Card */}
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-lg">
          <div
            className="min-h-[200px] cursor-pointer rounded-xl border border-gray-700 bg-gray-900 p-6"
            onClick={() => !flipped && setFlipped(true)}
          >
            {!flipped ? (
              <div>
                <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">
                  Question
                </p>
                <p className="text-lg leading-relaxed text-gray-100">
                  {currentCard.front}
                </p>
                <p className="mt-6 text-center text-xs text-gray-600">
                  Tap to reveal answer
                </p>
              </div>
            ) : (
              <div>
                <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-wider text-gray-500">
                  Answer
                </p>
                <p className="text-lg leading-relaxed text-gray-100">
                  {currentCard.back}
                </p>
              </div>
            )}
          </div>

          {/* Source info */}
          <p className="mt-2 text-center text-xs text-gray-600">
            {currentCard.bookId} &middot; Ch {currentCard.chapterNumber}
          </p>

          {/* Rating buttons */}
          {flipped && (
            <div className="mt-4 grid grid-cols-4 gap-2">
              {([1, 2, 3, 4] as FSRSRating[]).map((rating) => {
                const config = RATING_CONFIG[rating];
                return (
                  <button
                    key={rating}
                    onClick={() => handleRate(rating)}
                    disabled={submitting}
                    className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${config.className}`}
                  >
                    <span>{config.label}</span>
                    <span className="text-[0.6rem] font-normal opacity-60">
                      {config.sublabel}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
