"use client";

import { useEffect } from "react";
import { RouteError } from "@/components/ui/RouteError";

export default function BookError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Book section error:", error);
  }, [error]);

  return (
    <RouteError
      title="Something went wrong"
      message="We hit an unexpected error loading this page. Your progress is safe."
      reset={reset}
    />
  );
}
