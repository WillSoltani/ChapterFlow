"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/app/book/components/ui/Button";
import type { BookProfileState } from "@/app/book/hooks/useBookProfile";

type EditProfileModalProps = {
  open: boolean;
  profile: BookProfileState;
  email: string | null;
  onClose: () => void;
  onSave: (values: Partial<BookProfileState>) => Promise<void> | void;
};

export function EditProfileModal({ open, profile, email, onClose, onSave }: EditProfileModalProps) {
  const [draft, setDraft] = useState<BookProfileState>(profile);
  const [saving, setSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(profile);
    setAvatarError(null);
  }, [open, profile]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(profile), [draft, profile]);

  if (!open) return null;

  const handleAvatarChange = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please select an image file.");
      return;
    }
    if (file.size > 220_000) {
      setAvatarError("Please keep the avatar under 220 KB for this local preview.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((prev) => ({ ...prev, avatarDataUrl: typeof reader.result === "string" ? reader.result : prev.avatarDataUrl }));
      setAvatarError(null);
    };
    reader.readAsDataURL(file);
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-(--cf-overlay) px-4" role="dialog" aria-modal="true" aria-label="Edit profile">
      <div className="w-full max-w-3xl rounded-[32px] border border-(--cf-border) bg-(--cf-surface-strong) p-5 shadow-[0_24px_60px_rgba(0,0,0,0.12)] sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.26em] text-(--cf-text-3)">Profile edit</p>
            <h3 className="mt-2 text-2xl font-semibold text-(--cf-text-1)">Edit profile</h3>
            <p className="mt-2 text-sm text-(--cf-text-2)">Update how your identity appears across the app. Save applies instantly to this local profile experience.</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-2) transition hover:bg-(--cf-surface) hover:text-(--cf-text-1)" aria-label="Close edit profile">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
          <div className="rounded-[28px] border border-(--cf-border) bg-(--cf-surface-muted) p-4">
            <p className="text-sm font-medium text-(--cf-text-1)">Avatar</p>
            <div className="mt-4 flex h-28 w-28 items-center justify-center overflow-hidden rounded-[26px] border border-(--cf-border) bg-(--cf-surface-strong) text-3xl font-semibold text-(--cf-text-1)">
              {draft.avatarDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.avatarDataUrl} alt={draft.displayName} className="h-full w-full object-cover" />
              ) : (
                <span>{draft.displayName.trim().slice(0, 2).toUpperCase() || "R"}</span>
              )}
            </div>
            <label className="mt-4 block">
              <span className="mb-2 block text-xs uppercase tracking-[0.18em] text-(--cf-text-3)">Upload image</span>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleAvatarChange(event.target.files?.[0] ?? null)}
                className="block w-full text-sm text-(--cf-text-2) file:mr-3 file:rounded-xl file:border file:border-(--cf-border) file:bg-(--cf-surface-muted) file:px-3 file:py-2 file:text-sm file:text-(--cf-text-2)"
              />
            </label>
            {avatarError ? <p className="mt-2 text-sm text-(--cf-danger-text)">{avatarError}</p> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
              <span className="text-xs uppercase tracking-[0.18em] text-(--cf-text-3)">Display name</span>
              <input
                value={draft.displayName}
                onChange={(event) => setDraft((prev) => ({ ...prev, displayName: event.target.value }))}
                className="mt-2 w-full bg-transparent text-sm text-(--cf-text-1) outline-none"
              />
            </label>
            <label className="block rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
              <span className="text-xs uppercase tracking-[0.18em] text-(--cf-text-3)">Username</span>
              <input
                value={draft.username}
                onChange={(event) => setDraft((prev) => ({ ...prev, username: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "") }))}
                className="mt-2 w-full bg-transparent text-sm text-(--cf-text-1) outline-none"
              />
            </label>
            <label className="block rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3 sm:col-span-2">
              <span className="text-xs uppercase tracking-[0.18em] text-(--cf-text-3)">Tagline</span>
              <input
                value={draft.tagline}
                onChange={(event) => setDraft((prev) => ({ ...prev, tagline: event.target.value }))}
                className="mt-2 w-full bg-transparent text-sm text-(--cf-text-1) outline-none"
              />
            </label>
            <label className="block rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3 sm:col-span-2">
              <span className="text-xs uppercase tracking-[0.18em] text-(--cf-text-3)">Bio</span>
              <textarea
                rows={4}
                value={draft.bio}
                onChange={(event) => setDraft((prev) => ({ ...prev, bio: event.target.value }))}
                className="mt-2 w-full resize-none bg-transparent text-sm leading-6 text-(--cf-text-1) outline-none"
              />
            </label>
            <label className="block rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
              <span className="text-xs uppercase tracking-[0.18em] text-(--cf-text-3)">Timezone</span>
              <input
                value={draft.timezone}
                onChange={(event) => setDraft((prev) => ({ ...prev, timezone: event.target.value }))}
                className="mt-2 w-full bg-transparent text-sm text-(--cf-text-1) outline-none"
              />
            </label>
            <label className="block rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
              <span className="text-xs uppercase tracking-[0.18em] text-(--cf-text-3)">Country or region</span>
              <input
                value={draft.country}
                onChange={(event) => setDraft((prev) => ({ ...prev, country: event.target.value }))}
                className="mt-2 w-full bg-transparent text-sm text-(--cf-text-1) outline-none"
              />
            </label>
            <label className="block rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
              <span className="text-xs uppercase tracking-[0.18em] text-(--cf-text-3)">Pronouns</span>
              <input
                value={draft.pronouns}
                onChange={(event) => setDraft((prev) => ({ ...prev, pronouns: event.target.value }))}
                className="mt-2 w-full bg-transparent text-sm text-(--cf-text-1) outline-none"
              />
            </label>
            <div className="rounded-2xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-3">
              <span className="text-xs uppercase tracking-[0.18em] text-(--cf-text-3)">Email</span>
              <p className="mt-2 text-sm text-(--cf-text-2)">{email ?? "Signed in"}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-(--cf-divider) pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-(--cf-text-2)">{dirty ? "Unsaved changes ready to apply" : "No pending changes"}</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={submit} disabled={!dirty || saving}>{saving ? "Saving" : "Save changes"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
