"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { ReviewSessionFSRS } from "@/components/review/ReviewSessionFSRS";

/** PROG-22: the spaced-review session as its own page, opened from Progress. */
export function ReviewPageClient() {
  const router = useRouter();
  const handleClose = useCallback(() => router.push("/book/progress"), [router]);

  return (
    <main id="main" tabIndex={-1} className="cf-app-shell min-h-screen focus:outline-none">
      <h1 className="sr-only">Spaced review</h1>
      <ReviewSessionFSRS onClose={handleClose} />
    </main>
  );
}
