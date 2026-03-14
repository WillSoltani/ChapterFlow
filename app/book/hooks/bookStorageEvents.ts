"use client";

export const BOOK_STORAGE_EVENT = "book-accelerator:storage-changed";

export function emitBookStorageChanged(scope: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(BOOK_STORAGE_EVENT, {
      detail: { scope, at: Date.now() },
    })
  );
}
