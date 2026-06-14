"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Users, Bell, UserPlus, X, Copy, Check } from "lucide-react";
import { fetchBookJson, BookClientError } from "@/app/book/_lib/book-api";
import type { BookUserPairItem } from "@/app/app/api/book/_lib/types";

/** PII-safe partner summary returned by GET /me/pairs (see pair-repo.getActivePairWithPartner). */
type PairPartner = {
  displayName: string | null;
  currentStreak: number;
  booksInProgress: number;
  lastActiveDate: string | null;
};

type PairResponse = { pair: BookUserPairItem | null; partner: PairPartner | null };

/**
 * Coarse, day-granularity activity label — never reveals an exact timestamp.
 * The partner's lastActiveDate is stored in their own local calendar day, so we
 * anchor "today" to the viewer's LOCAL day (not UTC) to avoid a systematic
 * off-by-one for every non-UTC viewer. A partner in a different timezone is
 * inherently imprecise at day granularity, which this label is fine with.
 */
function formatLastActive(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  if (dateStr >= today) return "active today";
  // Anchor both sides to local midnight so the delta is whole days (Math.round absorbs DST).
  const days = Math.round((Date.parse(`${today}T00:00:00`) - Date.parse(`${dateStr}T00:00:00`)) / 86_400_000);
  if (!Number.isFinite(days) || days < 1) return null;
  if (days === 1) return "active yesterday";
  return `active ${days}d ago`;
}

/** Build the partner's activity subtitle, e.g. "12-day streak · 2 books in progress · active today". */
function partnerActivityLabel(partner: PairPartner | null, pairedAt: string): string {
  const parts: string[] = [];
  if (partner) {
    if (partner.currentStreak > 0) parts.push(`${partner.currentStreak}-day streak`);
    if (partner.booksInProgress > 0) {
      parts.push(`${partner.booksInProgress} book${partner.booksInProgress === 1 ? "" : "s"} in progress`);
    }
    const active = formatLastActive(partner.lastActiveDate);
    if (active) parts.push(active);
  }
  if (parts.length > 0) return parts.join(" · ");
  // No activity signal yet — fall back to the pairing date.
  return `Paired since ${new Date(pairedAt).toLocaleDateString()}`;
}

export function PartnerProgressCard({ enabled }: { enabled: boolean }) {
  const [pair, setPair] = useState<BookUserPairItem | null>(null);
  const [partner, setPartner] = useState<PairPartner | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [nudging, setNudging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [nudgeSent, setNudgeSent] = useState(false);
  const [nudgeError, setNudgeError] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState(false);
  const fetchingRef = useRef(false);

  const refreshPair = useCallback(() => {
    if (!enabled || fetchingRef.current) return;
    fetchingRef.current = true;
    fetchBookJson<PairResponse>("/app/api/book/me/pairs")
      .then((data) => { setPair(data.pair); setPartner(data.partner); })
      .catch(() => {})
      .finally(() => { fetchingRef.current = false; });
  }, [enabled]);

  // Initial load
  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    fetchBookJson<PairResponse>("/app/api/book/me/pairs")
      .then((data) => { setPair(data.pair); setPartner(data.partner); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [enabled]);

  // Re-fetch when tab becomes visible (so User A sees partner after accept)
  useEffect(() => {
    if (!enabled) return;
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshPair();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [enabled, refreshPair]);

  const createInvite = useCallback(async () => {
    setInviteError(null);
    try {
      const data = await fetchBookJson<{ inviteUrl: string }>(
        "/app/api/book/me/pairs/invite",
        { method: "POST" },
      );
      setInviteUrl(data.inviteUrl);
      await navigator.clipboard.writeText(data.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      if (err instanceof BookClientError && err.status === 409) {
        refreshPair();
      } else {
        setInviteError("Something went wrong. Try again.");
        setTimeout(() => setInviteError(null), 3000);
      }
    }
  }, [refreshPair]);

  const copyInviteUrl = useCallback(async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setInviteError("Couldn't copy link.");
      setTimeout(() => setInviteError(null), 3000);
    }
  }, [inviteUrl]);

  const sendNudge = useCallback(async () => {
    if (!pair || nudging) return;
    setNudging(true);
    setNudgeError(null);
    try {
      await fetchBookJson(`/app/api/book/me/pairs/${pair.partnerId}/nudge`, {
        method: "POST",
      });
      setNudgeSent(true);
      setTimeout(() => setNudgeSent(false), 2000);
    } catch (err) {
      if (err instanceof BookClientError && err.status === 429) {
        setNudgeError("Already nudged today");
      } else {
        setNudgeError("Failed to send");
      }
      setTimeout(() => setNudgeError(null), 3000);
    }
    setNudging(false);
  }, [pair, nudging]);

  const endPartnership = useCallback(async () => {
    if (!pair || ending) return;
    setEnding(true);
    try {
      await fetchBookJson(`/app/api/book/me/pairs/${pair.partnerId}`, {
        method: "DELETE",
      });
      setPair(null);
      setPartner(null);
      setConfirmEnd(false);
    } catch {
      setEndError(true);
      setTimeout(() => setEndError(false), 3000);
    }
    setEnding(false);
  }, [pair, ending]);

  if (loading) return null;

  // Pending invite — link generated, waiting for partner
  if (!pair && inviteUrl) {
    return (
      <div className="cf-panel rounded-[22px] border border-(--cf-accent-border) p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--cf-accent-soft)">
            <Users className="h-5 w-5 text-(--cf-accent)" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-(--cf-text-1)">
              Invite Sent
            </p>
            <p className={`mt-0.5 text-xs ${inviteError ? "text-red-400" : "text-(--cf-text-3)"}`}>
              {inviteError || "Share the link — expires in 7 days"}
            </p>
          </div>
          <button
            type="button"
            onClick={copyInviteUrl}
            className="inline-flex items-center gap-1.5 rounded-xl border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-2 text-xs font-semibold text-(--cf-info-text) transition hover:bg-(--cf-accent-muted)"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>
    );
  }

  // No partner, no invite yet — show invite CTA
  if (!pair) {
    return (
      <div className="cf-panel rounded-[22px] border border-(--cf-border) p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--cf-surface-muted)">
            <Users className="h-5 w-5 text-(--cf-text-3)" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-(--cf-text-1)">
              Find a Reading Partner
            </p>
            <p className={`mt-0.5 text-xs ${inviteError ? "text-red-400" : "text-(--cf-text-3)"}`}>
              {inviteError || "Pair up with a friend to stay accountable"}
            </p>
          </div>
          <button
            type="button"
            onClick={createInvite}
            className="inline-flex items-center gap-1.5 rounded-xl border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-2 text-xs font-semibold text-(--cf-info-text) transition hover:bg-(--cf-accent-muted)"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Invite
          </button>
        </div>
      </div>
    );
  }

  // Confirm end partnership
  if (confirmEnd) {
    return (
      <div className="cf-panel rounded-[22px] border border-(--cf-border) p-4">
        <p className="text-sm font-semibold text-(--cf-text-1) mb-2">
          End partnership?
        </p>
        <p className={`text-xs mb-3 ${endError ? "text-red-400" : "text-(--cf-text-3)"}`}>
          {endError ? "Something went wrong. Try again." : "You can always pair with someone new later."}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={endPartnership}
            disabled={ending}
            className="flex-1 rounded-xl bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/25 disabled:opacity-50"
          >
            {ending ? "Ending..." : "Yes, end it"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmEnd(false)}
            className="flex-1 rounded-xl border border-(--cf-border) px-3 py-2 text-xs font-semibold text-(--cf-text-2) transition hover:bg-(--cf-surface-muted)"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Has partner
  return (
    <div className="cf-panel rounded-[22px] border border-(--cf-accent-border) bg-(--cf-surface) p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--cf-accent-soft)">
          <Users className="h-5 w-5 text-(--cf-accent)" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold text-(--cf-text-1)">
            {partner?.displayName || "Reading Partner"}
          </p>
          <p className={`mt-0.5 truncate text-xs ${nudgeError ? "text-red-400" : "text-(--cf-text-3)"}`}>
            {nudgeError || partnerActivityLabel(partner, pair.pairedAt)}
          </p>
        </div>
        <button
          type="button"
          onClick={sendNudge}
          disabled={nudging || nudgeSent}
          className="inline-flex items-center gap-1.5 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2 text-xs font-semibold text-(--cf-text-2) transition hover:bg-(--cf-accent-soft) disabled:opacity-50"
        >
          <Bell className="h-3.5 w-3.5" />
          {nudgeSent ? "Sent!" : nudging ? "Sending..." : "Nudge"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmEnd(true)}
          title="End partnership"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-(--cf-text-3) transition hover:bg-(--cf-surface-muted) hover:text-(--cf-text-2)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
