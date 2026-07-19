import { AlertTriangle } from "lucide-react";

export function ErrorAlert({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-xl border border-(--cf-danger-border) bg-(--cf-danger-soft) p-3 text-cf-label text-(--cf-danger-text)"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="leading-relaxed">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-1.5 text-cf-label-sm font-semibold underline underline-offset-2 hover:no-underline"
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}
