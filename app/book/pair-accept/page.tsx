"use client";

import { Suspense, useCallback, useState } from "react";
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
      className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-(--cf-accent) px-4 text-cf-body-sm font-semibold text-(--cf-accent-contrast) transition duration-(--duration-fast) hover:brightness-110 ${className}`}
    />
  );
}

// Map the raw pair-repo API strings (and a 401 status) to warm, recovery-first
// microcopy in the gift-invalid voice (title + cause + recovery). The backend
// strings are an internal contract — never render them to the reader directly.
function friendlyPairError(status: number | null, raw: string): { title: string; body: string } {
  if (status === 401) {
    return {
      title: "One more step",
      body: "Your session expired before we could accept this invite. Sign in again, then accept it.",
    };
  }
  const r = raw.toLowerCase();
  if (r.includes("not found") || r.includes("missing its code")) {
    return {
      title: "We couldn't find that invite",
      body: "This reading-partner link isn't valid or has expired. Ask your partner to send you a fresh invite.",
    };
  }
  if (r.includes("expired")) {
    return {
      title: "This invite has expired",
      body: "Reading-partner links don't last forever. Ask your partner to send a new one.",
    };
  }
  if (r.includes("already used")) {
    return {
      title: "This invite was already used",
      body: "This link has already been accepted and can't be used again. Ask your partner for a fresh invite.",
    };
  }
  if (r.includes("cannot pair with yourself")) {
    return {
      title: "That's your own invite",
      body: "You can't pair with yourself. Share this link with the friend you want to read alongside.",
    };
  }
  if (r.includes("already has a partner") || r.includes("you already have a partner")) {
    return {
      title: "You're already paired up",
      body: "One of you already has a reading partner. Leave your current pairing first if you'd like to switch.",
    };
  }
  return {
    title: "We couldn't accept this invite",
    body: "Something went wrong on our end. Try the link again, or ask your partner to resend it.",
  };
}

// What a pairing shares, matching the partner card on Home (name, streak,
// books in progress, last active day). Home shows that card, with its "End
// partnership" control, only once a book has been started.
const SHARED_COPY =
  "You and your partner will see each other's name, reading streak, how many books you're reading and when you last read. You can end the pairing from the partner card on Home, which appears once you have started a book.";

function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function PairAcceptInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkCode = normalizeCode(searchParams?.get("code") ?? "");
  // ACCT-19: nothing is accepted until the reader taps "Accept invite"; a
  // missing code is typed in here instead of ending on an error.
  const [typedCode, setTypedCode] = useState("");
  const code = linkCode || normalizeCode(typedCode);

  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
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
          ? "Your session has expired. Sign in again to accept this invite."
          : err && typeof err === "object" && "message" in err
            ? String((err as BookClientError).message)
            : "We couldn't accept this invite.";
      setErrorStatus(status);
      setErrorMessage(msg);
      setState("error");
    }
  }, [code]);

  let body: React.ReactNode;
  if (state === "success") {
    body = (
      <PairCard icon={<CheckCircle2 className="h-7 w-7" />} tone="success">
        <h1 className="mb-2 text-[22px] font-bold text-(--cf-text-1)">You&apos;re reading partners!</h1>
        <p className="mb-6 text-cf-body-sm leading-relaxed text-(--cf-text-3)">
          Head to your dashboard to see your partner and keep each other accountable.
        </p>
        <PrimaryButton onClick={() => router.push("/dashboard")}>Go to dashboard</PrimaryButton>
      </PairCard>
    );
  } else if (state === "error") {
    // A 401 here means the page shell loaded with a cookie but the access token
    // was expired/invalid at the API. Offer re-auth with a relative returnTo back
    // to this invite so the reader can accept it once the session is refreshed.
    const returnTo = encodeURIComponent(
      code ? `/book/pair-accept?code=${encodeURIComponent(code)}` : "/book/pair-accept",
    );
    const friendly = friendlyPairError(errorStatus, errorMessage);
    body = (
      <PairCard icon={<AlertCircle className="h-7 w-7" />} tone="danger">
        <h1 className="mb-2 text-[22px] font-bold text-(--cf-text-1)">{friendly.title}</h1>
        <p className="mb-6 text-cf-body-sm leading-relaxed text-(--cf-text-3)">{friendly.body}</p>
        {errorStatus === 401 ? (
          <>
            <a
              href={`/auth/login?returnTo=${returnTo}`}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-(--cf-accent) px-4 text-cf-body-sm font-semibold text-(--cf-accent-contrast) transition duration-(--duration-fast) hover:brightness-110"
            >
              Sign in to continue
            </a>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-cf-body-sm font-semibold text-(--cf-text-3) transition duration-(--duration-fast) hover:text-(--cf-text-1)"
            >
              Go to dashboard
            </button>
          </>
        ) : (
          <>
            <PrimaryButton onClick={() => router.push("/dashboard")}>Go to dashboard</PrimaryButton>
            {!linkCode ? (
              <button
                type="button"
                onClick={() => setState("idle")}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-cf-body-sm font-semibold text-(--cf-text-3) transition duration-(--duration-fast) hover:text-(--cf-text-1)"
              >
                Enter a different code
              </button>
            ) : null}
          </>
        )}
      </PairCard>
    );
  } else {
    const busy = state === "loading";
    body = (
      <PairCard icon={<Users className="h-7 w-7" />} tone="accent">
        <h1 className="mb-2 text-[22px] font-bold text-(--cf-text-1)">Reading partner invite</h1>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy) void handleAccept();
          }}
        >
          {linkCode ? (
            <p className="mx-auto mb-4 mt-4 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3 font-mono text-cf-body tracking-widest text-(--cf-text-1)">
              {linkCode}
            </p>
          ) : (
            <div className="mb-4 mt-4 text-left">
              <label htmlFor="pair-code" className="mb-1.5 block text-cf-body-sm font-medium text-(--cf-text-2)">
                Invite code
              </label>
              <input
                id="pair-code"
                value={typedCode}
                onChange={(event) => setTypedCode(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="min-h-11 w-full rounded-xl border border-(--cf-border-strong) bg-(--cf-surface) px-4 font-mono text-cf-body uppercase tracking-widest text-(--cf-text-1) focus:border-(--cf-accent) focus:outline-none"
              />
            </div>
          )}
          <p className="mb-6 text-cf-body-sm leading-relaxed text-(--cf-text-3)">{SHARED_COPY}</p>
          <PrimaryButton type="submit" disabled={!code || busy} className="disabled:opacity-50">
            {busy ? "Accepting…" : "Accept invite"}
          </PrimaryButton>
        </form>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-cf-body-sm font-semibold text-(--cf-text-3) transition duration-(--duration-fast) hover:text-(--cf-text-1)"
        >
          Not now
        </button>
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
        <p className="text-cf-body-sm text-(--cf-text-3)">Loading…</p>
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
