"use client";

import { useEffect } from "react";
import { RouteError } from "@/components/ui/RouteError";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Home error:", error);
  }, [error]);

  return (
    <RouteError
      title="Something went wrong"
      message="We hit an unexpected error loading Home. Your progress is safe."
      reset={reset}
      primaryLink={{ href: "/book/library", label: "Go to your library" }}
    />
  );
}
