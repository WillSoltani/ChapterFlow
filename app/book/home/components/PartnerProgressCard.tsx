"use client";

import { useCallback, useEffect, useState } from "react";
import { Users, Bell, UserPlus } from "lucide-react";
import { fetchBookJson } from "@/app/book/_lib/book-api";
import type { BookUserPairItem } from "@/app/app/api/book/_lib/types";

type PairResponse = { pair: BookUserPairItem | null };

export function PartnerProgressCard({ enabled }: { enabled: boolean }) {
  const [pair, setPair] = useState<BookUserPairItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [nudging, setNudging] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    fetchBookJson<PairResponse>("/app/api/book/me/pairs")
      .then((data) => setPair(data.pair))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [enabled]);

  const createInvite = useCallback(async () => {
    try {
      const data = await fetchBookJson<{ inviteUrl: string }>(
        "/app/api/book/me/pairs/invite",
        { method: "POST" },
      );
      setInviteUrl(data.inviteUrl);
      await navigator.clipboard.writeText(data.inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, []);

  const sendNudge = useCallback(async () => {
    if (!pair || nudging) return;
    setNudging(true);
    try {
      await fetchBookJson(`/app/api/book/me/pairs/${pair.partnerId}/nudge`, {
        method: "POST",
      });
    } catch {}
    setNudging(false);
  }, [pair, nudging]);

  if (loading) return null;

  // No partner — show invite CTA
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
            <p className="mt-0.5 text-xs text-(--cf-text-3)">
              Pair up with a friend to stay accountable
            </p>
          </div>
          <button
            type="button"
            onClick={createInvite}
            className="inline-flex items-center gap-1.5 rounded-xl border border-(--cf-accent-border) bg-(--cf-accent-soft) px-3 py-2 text-xs font-semibold text-(--cf-info-text) transition hover:bg-(--cf-accent-muted)"
          >
            <UserPlus className="h-3.5 w-3.5" />
            {copied ? "Link Copied!" : inviteUrl ? "Copy Link" : "Invite"}
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
        <div className="flex-1">
          <p className="text-sm font-semibold text-(--cf-text-1)">
            Reading Partner
          </p>
          <p className="mt-0.5 text-xs text-(--cf-text-3)">
            Paired since {new Date(pair.pairedAt).toLocaleDateString()}
          </p>
        </div>
        <button
          type="button"
          onClick={sendNudge}
          disabled={nudging}
          className="inline-flex items-center gap-1.5 rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2 text-xs font-semibold text-(--cf-text-2) transition hover:bg-(--cf-accent-soft) disabled:opacity-50"
        >
          <Bell className="h-3.5 w-3.5" />
          Nudge
        </button>
      </div>
    </div>
  );
}
