"use client";

import { ArrowRight } from "lucide-react";

type ContinueButtonProps = {
  ready: boolean;
  onClick: () => void;
  readyText: string;
  lockedText?: string;
};

export function ContinueButton({
  ready,
  onClick,
  readyText,
  lockedText = "Keep reading to continue...",
}: ContinueButtonProps) {
  return (
    <div className="mt-8 flex justify-center">
      <button
        type="button"
        disabled={!ready}
        onClick={onClick}
        className={[
          "flex items-center gap-2 rounded-2xl px-8 py-4 text-base font-bold transition-all duration-300",
          ready
            ? "bg-(--cr-accent) text-(--cr-text-inverse) shadow-[0_0_0_0_rgba(77,182,172,0.4)] hover:shadow-[0_4px_20px_rgba(77,182,172,0.3)] hover:opacity-90"
            : "cursor-not-allowed bg-(--cr-bg-surface-3) text-(--cr-text-disabled)",
        ].join(" ")}
        style={
          ready
            ? { animation: "cr-pulse-glow 2s ease-in-out infinite" }
            : undefined
        }
      >
        {ready ? (
          <>
            {readyText}
            <ArrowRight className="h-5 w-5" />
          </>
        ) : (
          lockedText
        )}
      </button>
    </div>
  );
}
