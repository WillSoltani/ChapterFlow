"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { fetchBookJson } from "@/app/book/_lib/book-api";

type ClaimResult = {
  redeemed: boolean;
  proDays: number;
  proExpiresAt: string;
  message: string;
};

export default function GiftClaimPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const handleClaim = useCallback(async () => {
    setState("loading");
    try {
      const res = await fetchBookJson<ClaimResult>(
        `/app/api/book/me/gifts/${encodeURIComponent(code)}/claim`,
        { method: "POST" }
      );
      setResult(res);
      setState("success");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to redeem gift code.";
      setErrorMessage(msg);
      setState("error");
    }
  }, [code]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-(--cf-card) p-8 text-center shadow-xl">
        <h1 className="text-2xl font-bold text-(--cf-text-1) mb-2">
          Redeem Gift
        </h1>
        <p className="text-sm text-(--cf-text-3) mb-6">
          Code: <span className="font-mono font-semibold text-(--cf-text-1)">{code}</span>
        </p>

        {state === "idle" && (
          <button
            onClick={handleClaim}
            className="cf-btn-primary w-full rounded-xl py-3 text-sm font-semibold"
          >
            Claim Gift
          </button>
        )}

        {state === "loading" && (
          <p className="text-sm text-(--cf-text-3)">Redeeming...</p>
        )}

        {state === "success" && result && (
          <div className="space-y-4">
            <p className="text-lg font-semibold text-(--cf-accent)">
              {result.message}
            </p>
            <button
              onClick={() => router.push("/book/library")}
              className="cf-btn-primary w-full rounded-xl py-3 text-sm font-semibold"
            >
              Start Reading
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="space-y-4">
            <p className="text-sm text-red-400">{errorMessage}</p>
            <button
              onClick={() => router.push("/book/library")}
              className="cf-btn-secondary w-full rounded-xl py-3 text-sm"
            >
              Go to Library
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
