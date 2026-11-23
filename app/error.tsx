"use client";

import { useEffect } from "react";
import { SUPPORT_EMAIL } from "@/lib/legal-entity";
import { RouteError } from "@/components/ui/RouteError";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <RouteError
      title="Something went wrong"
      message="An unexpected error occurred. Please try again."
      reset={reset}
      primaryLink={{ href: "/dashboard", label: "Go to your dashboard" }}
      footer={
        <>
          Still stuck? Contact{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-(--cf-accent) underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </>
      }
    />
  );
}
