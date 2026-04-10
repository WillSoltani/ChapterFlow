"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Renders a transient banner when the user returns from a Stripe Checkout
 * redirect (?billing=success | cancelled), then strips the query param so
 * the message doesn't persist on refresh.
 */
export function BillingStatusBanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("billing");
  const [visible, setVisible] = useState<null | "success" | "cancelled">(null);

  useEffect(() => {
    if (status === "success" || status === "cancelled") {
      setVisible(status);
      // Strip the query param so the banner doesn't reappear on refresh.
      const url = new URL(window.location.href);
      url.searchParams.delete("billing");
      router.replace(url.pathname + (url.search ? url.search : ""));
      const t = window.setTimeout(() => setVisible(null), 6000);
      return () => window.clearTimeout(t);
    }
  }, [status, router]);

  if (!visible) return null;

  const isSuccess = visible === "success";
  return (
    <div
      role="status"
      style={{
        position: "fixed",
        top: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        padding: "12px 20px",
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 500,
        boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
        background: isSuccess ? "#0f9d58" : "#444",
        color: "#fff",
        maxWidth: 480,
        textAlign: "center",
      }}
    >
      {isSuccess
        ? "Payment successful — activating your Pro access. This may take a few seconds."
        : "Checkout cancelled. Your plan was not changed."}
    </div>
  );
}
