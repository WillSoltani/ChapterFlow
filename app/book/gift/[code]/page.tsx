"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Gift, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { BookClientError } from "@/app/book/_lib/book-api";
import { AuthScreen } from "@/components/auth/AuthScreen";

type GiftPreview = {
  status: "available" | "redeemed" | "expired";
  giftType: string;
  proDays: number;
  senderName: string | null;
  isOwnGift: boolean;
};

type ClaimResult = {
  redeemed: boolean;
  proDays: number;
  proExpiresAt: string;
  message: string;
};

type Phase = "loading" | "ready" | "claiming" | "claimed";

function proWindowLabel(days: number): string {
  if (days === 7) return "a free week of ChapterFlow Pro";
  if (days === 1) return "a free day of ChapterFlow Pro";
  return `${days} days of ChapterFlow Pro`;
}

/** Format the gift's Pro-expiry ISO timestamp as a friendly date, or null if
 *  it can't be parsed (so we silently fall back to the generic message). */
function formatProExpiry(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Big centered card used by every terminal state. */
function GiftCard({
  icon,
  tone = "accent",
  children,
}: {
  icon: React.ReactNode;
  tone?: "accent" | "muted" | "danger";
  children: React.ReactNode;
}) {
  const ring =
    tone === "danger"
      ? "bg-(--cf-danger-soft) text-(--cf-danger-text)"
      : tone === "muted"
        ? "bg-(--cf-surface-muted) text-(--cf-text-3)"
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
      className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-(--cf-accent) px-4 text-cf-body-sm font-semibold text-(--cf-accent-contrast) transition duration-(--duration-fast) hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    />
  );
}

function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-(--cf-border-strong) px-4 text-cf-body-sm font-medium text-(--cf-text-1) transition-colors duration-(--duration-fast) hover:bg-(--cf-surface-muted) ${className}`}
    />
  );
}

export default function GiftClaimPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [preview, setPreview] = useState<GiftPreview | null>(null);
  const [previewError, setPreviewError] = useState<{
    notFound: boolean;
    unauthenticated: boolean;
    message: string;
  } | null>(null);
  const [claimError, setClaimError] = useState("");
  const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);

  // Fetch the preview once on mount so the recipient sees the value + sender
  // before the irreversible claim.
  const previewStarted = useRef(false);
  useEffect(() => {
    if (previewStarted.current) return;
    previewStarted.current = true;
    (async () => {
      try {
        const res = await fetchBookJson<GiftPreview>(
          `/app/api/book/me/gifts/${encodeURIComponent(code)}`,
        );
        setPreview(res);
        setPhase("ready");
      } catch (err: unknown) {
        const e = err as BookClientError;
        setPreviewError({
          notFound: e?.code === "gift_not_found" || e?.status === 404,
          // Token expired mid-mount (middleware usually catches logged-out
          // users first, but this covers the edge): show a sign-in path
          // instead of a dead-end generic error.
          unauthenticated: e?.status === 401 || e?.status === 403,
          message: e?.message || "We couldn't load this gift.",
        });
        setPhase("ready");
      }
    })();
  }, [code]);

  const handleClaim = useCallback(async () => {
    setPhase("claiming");
    setClaimError("");
    try {
      const res = await fetchBookJson<ClaimResult>(
        `/app/api/book/me/gifts/${encodeURIComponent(code)}/claim`,
        { method: "POST" },
      );
      setClaimResult(res);
      setPhase("claimed");
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message: string }).message)
          : "Failed to redeem gift code.";
      setClaimError(msg);
      setPhase("ready");
    }
  }, [code]);

  // ── Render ────────────────────────────────────────────────────────────
  let body: React.ReactNode;

  if (phase === "loading") {
    body = (
      <GiftCard icon={<Gift className="h-7 w-7" />} tone="accent">
        <p className="text-sm text-(--cf-text-3)">Unwrapping your gift…</p>
      </GiftCard>
    );
  } else if (phase === "claimed" && claimResult) {
    const expiryLabel = formatProExpiry(claimResult.proExpiresAt);
    body = (
      <GiftCard icon={<CheckCircle2 className="h-7 w-7" />} tone="accent">
        <h1 className="mb-2 text-[22px] font-bold text-(--cf-text-1)">You&apos;re all set</h1>
        <p className="mb-2 text-cf-body-sm leading-relaxed text-(--cf-text-3)">{claimResult.message}</p>
        {expiryLabel && (
          <p className="mb-6 text-cf-body-sm font-medium leading-relaxed text-(--cf-text-1)">
            Pro is yours through {expiryLabel}.
          </p>
        )}
        <PrimaryButton onClick={() => router.push("/book/library")}>Start reading</PrimaryButton>
      </GiftCard>
    );
  } else if (previewError?.unauthenticated) {
    const returnTo = encodeURIComponent(
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : `/book/gift/${code}`,
    );
    body = (
      <GiftCard icon={<Gift className="h-7 w-7" />} tone="accent">
        <h1 className="mb-2 text-[22px] font-bold text-(--cf-text-1)">Sign in to claim your gift</h1>
        <p className="mb-6 text-cf-body-sm leading-relaxed text-(--cf-text-3)">
          You&apos;ll need to be signed in to add this gift to your account. Sign in
          and we&apos;ll bring you right back here.
        </p>
        <a
          href={`/auth/login?returnTo=${returnTo}`}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-(--cf-accent) px-4 text-cf-body-sm font-semibold text-(--cf-accent-contrast) transition duration-(--duration-fast) hover:brightness-110"
        >
          Sign in to continue
        </a>
      </GiftCard>
    );
  } else if (previewError) {
    body = (
      <GiftCard icon={<AlertCircle className="h-7 w-7" />} tone="danger">
        <h1 className="mb-2 text-[22px] font-bold text-(--cf-text-1)">
          {previewError.notFound ? "We couldn't find that gift" : "Something went wrong"}
        </h1>
        <p className="mb-6 text-cf-body-sm leading-relaxed text-(--cf-text-3)">
          {previewError.notFound
            ? "This gift code isn't valid. Double-check the link, or ask the sender to share it again."
            : previewError.message}
        </p>
        <SecondaryButton onClick={() => router.push("/book/library")}>Browse the library</SecondaryButton>
      </GiftCard>
    );
  } else if (preview && preview.status === "redeemed") {
    body = (
      <GiftCard icon={<CheckCircle2 className="h-7 w-7" />} tone="muted">
        <h1 className="mb-2 text-[22px] font-bold text-(--cf-text-1)">This gift was already claimed</h1>
        <p className="mb-6 text-cf-body-sm leading-relaxed text-(--cf-text-3)">
          This code has already been redeemed and can&apos;t be used again.
        </p>
        <SecondaryButton onClick={() => router.push("/book/library")}>Browse the library</SecondaryButton>
      </GiftCard>
    );
  } else if (preview && preview.status === "expired") {
    body = (
      <GiftCard icon={<Clock className="h-7 w-7" />} tone="muted">
        <h1 className="mb-2 text-[22px] font-bold text-(--cf-text-1)">This gift has expired</h1>
        <p className="mb-6 text-cf-body-sm leading-relaxed text-(--cf-text-3)">
          This gift code is no longer active. Ask the sender to send a fresh one.
        </p>
        <SecondaryButton onClick={() => router.push("/book/library")}>Browse the library</SecondaryButton>
      </GiftCard>
    );
  } else if (preview && preview.isOwnGift) {
    body = (
      <GiftCard icon={<Gift className="h-7 w-7" />} tone="muted">
        <h1 className="mb-2 text-[22px] font-bold text-(--cf-text-1)">This is your gift to give</h1>
        <p className="mb-2 text-cf-body-sm leading-relaxed text-(--cf-text-3)">
          You created this code. Share it with a friend so they can unlock{" "}
          {proWindowLabel(preview.proDays)}.
        </p>
        <p className="mb-6 text-cf-label text-(--cf-text-3)">
          Code: <span className="font-mono font-semibold text-(--cf-text-1)">{code}</span>
        </p>
        <SecondaryButton onClick={() => router.push("/book/library")}>Back to the library</SecondaryButton>
      </GiftCard>
    );
  } else if (preview) {
    // available
    const headline = preview.senderName
      ? `${preview.senderName} sent you ${proWindowLabel(preview.proDays)}`
      : `You've been sent ${proWindowLabel(preview.proDays)}`;
    body = (
      <GiftCard icon={<Gift className="h-7 w-7" />} tone="accent">
        <p className="mb-1 text-cf-label font-medium uppercase tracking-wide text-(--cf-accent)">
          A gift for you
        </p>
        <h1 className="mb-3 text-[22px] font-bold leading-snug text-(--cf-text-1)">{headline}</h1>
        <p className="mb-6 text-cf-body-sm leading-relaxed text-(--cf-text-3)">
          Pro unlocks the full library and every learning tool. Claim it now — it&apos;s yours to keep
          for the gift window.
        </p>
        {/* Always-mounted live region so a claim failure is announced to
            screen readers the moment the text is injected. */}
        <p
          role="alert"
          aria-live="assertive"
          className="mb-3 text-cf-label text-(--cf-danger-text) empty:hidden"
        >
          {claimError}
        </p>
        <PrimaryButton onClick={handleClaim} disabled={phase === "claiming"}>
          {phase === "claiming" ? "Claiming…" : "Claim your gift"}
        </PrimaryButton>
      </GiftCard>
    );
  } else {
    body = null;
  }

  return <AuthScreen>{body}</AuthScreen>;
}
