"use client";

import { useEffect } from "react";
import { RouteError } from "@/components/ui/RouteError";

export default function RewardsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Rewards error:", error);
  }, [error]);

  return (
    <RouteError
      title="Something went wrong"
      message="We hit an unexpected error loading Rewards. Your progress is safe."
      reset={reset}
    />
  );
}
