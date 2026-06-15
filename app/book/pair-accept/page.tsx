"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, CheckCircle2, AlertCircle } from "lucide-react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { BookClientError } from "@/app/book/_lib/book-api";
import { AuthScreen } from "@/components/auth/AuthScreen";

type AcceptResult = {
  pair: { userId: string; partnerId: string; pairedAt: string };
  accepted: boolean;
};

function PairCard({
  icon,
  tone = "accent",
  children,
}: {
  icon: React.ReactNode;
  tone?: "accent" | "success" | "danger";
  children: React.ReactNode;
}) {
  const ring =
    tone === "danger"
      ? "bg-(--cf-danger-soft) text-(--cf-danger-text)"
      : tone === "success"
        ? "bg-(--cf-success-soft) text-(--cf-success-text)"
        : "bg-(--cf-accent-soft) text-(--cf-accent)";
  return (
    <div className="w-full max-w-md rounded-2xl border border-(--cf-border) bg-(--cf-surface) p-8 text-center shadow-(--cf-shadow-lg)">
      <div className={`mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl ${ring}`}>
        {icon}
      </div>
      {children}
    </div>
  );
}

function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-(--cf-accent) px-4 text-[14px] font-semibold text-(--cf-accent-contrast) transition duration-(--duration-fast) hover:brightness-110 ${className}`}
    />
  );
}

function PairAcceptInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");

  const [state, setState] = useState<"idle" | "loading" | "success" | "error">(
    code ? "idle" : "error",
  );
  const [errorMessage, setErrorMessage] = useState(
    code ? "" : "This invite link is missing its code. Ask your partner to share it again.",
  );
  const [errorStatus, setErrorStatus] = useState<number | null>(null);

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
      const status =
        err && typeof err === "object" && "status" in err
          ? Number((err as BookClientError).status)
          : null;
      const msg =
        status === 401
          ? "Your session has expired. Sign in again and we'll finish accepting this invite."
          : err && typeof err === "object" && "message" in err
            ? String((err as BookClientError).message)
            : "We couldn't accept this invite.";
      setErrorStatus(status);
      setErrorMessage(msg);
      setState("error");
    }
  }, [code]);

  // Auto-accept on mount when code is present (ref guards strict-mode double-fire)
  const startedRef = useRef(false);
  useEffect(() => {
    if (code && state === "idle" && !startedRef.current) {
      startedRef.current = true;
      handleAccept();
    }
  }, [code, state, handleAccept]);

  let body: React.ReactNode;
  if (state === "success") {
    body = (
      <PairCard icon={<CheckCircle2 className="h-7 w-7" />} tone="success">
        <h1 className="mb-2 text-[22px] font-bold text-(--cf-text-1)">You&apos;re reading partners!</h1>
        <p className="mb-6 text-[14px] leading-relaxed text-(--cf-text-3)">
          Head to your dashboard to see your partner and keep each other accountable.
        </p>
        <PrimaryButton onClick={() => router.push("/dashboard")}>Go to dashboard</PrimaryButton>
      </PairCard>
    );
  } else if (state === "error") {
    // A 401 here means the page shell loaded with a cookie but the access token
    // was expired/invalid at the API. Offer re-auth with a relative returnTo back
    // to this invite so the auto-accept retries once the session is refreshed.
    const returnTo = encodeURIComponent(
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : code
          ? `/book/pair-accept?code=${encodeURIComponent(code)}`
          : "/book/pair-accept",
    );
    body = (
      <PairCard icon={<AlertCircle className="h-7 w-7" />} tone="danger">
        <h1 className="mb-2 text-[22px] font-bold text-(--cf-text-1)">Reading partner invite</h1>
        <p className="mb-6 text-[14px] leading-relaxed text-(--cf-text-3)">{errorMessage}</p>
        {errorStatus === 401 ? (
          <>
            <a
              href={`/auth/login?returnTo=${returnTo}`}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-(--cf-accent) px-4 text-[14px] font-semibold text-(--cf-accent-contrast) transition duration-(--duration-fast) hover:brightness-110"
            >
              Sign in to continue
            </a>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-[14px] font-semibold text-(--cf-text-3) transition duration-(--duration-fast) hover:text-(--cf-text-1)"
            >
              Go to dashboard
            </button>
          </>
        ) : (
          <PrimaryButton onClick={() => router.push("/dashboard")}>Go to dashboard</PrimaryButton>
        )}
      </PairCard>
    );
  } else {
    body = (
      <PairCard icon={<Users className="h-7 w-7" />} tone="accent">
        <h1 className="mb-2 text-[22px] font-bold text-(--cf-text-1)">Reading partner invite</h1>
        <p className="text-[14px] text-(--cf-text-3)">Accepting your invite…</p>
      </PairCard>
    );
  }

  return <AuthScreen>{body}</AuthScreen>;
}

function PairAcceptFallback() {
  return (
    <AuthScreen>
      <PairCard icon={<Users className="h-7 w-7" />} tone="accent">
        <h1 className="mb-2 text-[22px] font-bold text-(--cf-text-1)">Reading partner invite</h1>
        <p className="text-[14px] text-(--cf-text-3)">Loading…</p>
      </PairCard>
    </AuthScreen>
  );
}

export default function PairAcceptPage() {
  return (
    <Suspense fallback={<PairAcceptFallback />}>
      <PairAcceptInner />
    </Suspense>
  );
}
