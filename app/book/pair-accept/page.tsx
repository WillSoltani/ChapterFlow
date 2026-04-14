"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, CheckCircle, AlertCircle } from "lucide-react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { BookClientError } from "@/app/book/_lib/book-api";

type AcceptResult = {
  pair: { userId: string; partnerId: string; pairedAt: string };
  accepted: boolean;
};

function PairAcceptInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const [state, setState] = useState<"idle" | "loading" | "success" | "error">(
    code ? "idle" : "error",
  );
  const [errorMessage, setErrorMessage] = useState(
    code ? "" : "Invalid or expired invite link.",
  );

  const handleAccept = useCallback(async () => {
    if (!code) return;
    setState("loading");
    try {
      await fetchBookJson<AcceptResult>(
        `/app/api/book/me/pairs/accept/${encodeURIComponent(code)}`,
        { method: "POST" },
      );
      setState("success");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as BookClientError).message)
          : "Failed to accept invite.";
      setErrorMessage(msg);
      setState("error");
    }
  }, [code]);

  // Auto-accept on mount when code is present
  useEffect(() => {
    if (code && state === "idle") {
      handleAccept();
    }
  }, [code, state, handleAccept]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-(--cf-card) p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-(--cf-accent-soft)">
          <Users className="h-6 w-6 text-(--cf-accent)" />
        </div>

        <h1 className="text-2xl font-bold text-(--cf-text-1) mb-2">
          Reading Partner Invite
        </h1>

        {state === "loading" && (
          <p className="text-sm text-(--cf-text-3)">
            Accepting invite...
          </p>
        )}

        {state === "success" && (
          <div className="space-y-4">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-lg font-semibold text-(--cf-accent)">
              You&apos;re now reading partners!
            </p>
            <p className="text-sm text-(--cf-text-3)">
              Head to your dashboard to see your partner and stay accountable.
            </p>
            <button
              onClick={() => router.push("/book/home")}
              className="cf-btn cf-btn-primary w-full"
            >
              Go to Dashboard
            </button>
          </div>
        )}

        {state === "error" && (
          <div className="space-y-4">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-500/15">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <p className="text-sm text-red-400">{errorMessage}</p>
            <button
              onClick={() => router.push("/book/home")}
              className="cf-btn cf-btn-secondary w-full"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PairAcceptFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-(--cf-card) p-8 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-(--cf-accent-soft)">
          <Users className="h-6 w-6 text-(--cf-accent)" />
        </div>
        <h1 className="text-2xl font-bold text-(--cf-text-1) mb-2">
          Reading Partner Invite
        </h1>
        <p className="text-sm text-(--cf-text-3)">Loading...</p>
      </div>
    </div>
  );
}

export default function PairAcceptPage() {
  return (
    <Suspense fallback={<PairAcceptFallback />}>
      <PairAcceptInner />
    </Suspense>
  );
}
