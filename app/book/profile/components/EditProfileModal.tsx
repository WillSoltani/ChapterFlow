"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Camera, ChevronDown, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { DUR } from "@/lib/motion";
import { Dialog } from "@/components/ui/Dialog";
import type { BookProfileState } from "@/app/book/hooks/useBookProfile";

type EditProfileModalProps = {
  open: boolean;
  profile: BookProfileState;
  email: string | null;
  onClose: () => void;
  onSave: (values: Partial<BookProfileState>) => Promise<void> | void;
};

function FieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-[10px] uppercase tracking-widest text-(--cf-text-3) mb-1"
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-(--cf-surface-muted) border border-(--cf-border) rounded-lg px-3 py-2
          text-sm text-(--cf-text-2)
          focus:outline-none focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20
          transition-colors"
      />
    </div>
  );
}

export function EditProfileModal({ open, profile, email, onClose, onSave }: EditProfileModalProps) {
  const [draft, setDraft] = useState<BookProfileState>(profile);
  const [saving, setSaving] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(profile);
    setAvatarError(null);
    setDetailsOpen(false);
    setConfirmDiscard(false);
  }, [open, profile]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(profile),
    [draft, profile]
  );

  const tryClose = useCallback(() => {
    if (dirty) {
      setConfirmDiscard(true);
    } else {
      onClose();
    }
  }, [dirty, onClose]);

  const handleAvatarChange = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Please select an image file.");
      return;
    }
    if (file.size > 220_000) {
      setAvatarError("Keep the avatar under 220 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((prev) => ({
        ...prev,
        avatarDataUrl:
          typeof reader.result === "string" ? reader.result : prev.avatarDataUrl,
      }));
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

  const initials =
    draft.displayName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "R";

  return (
    <>
      <Dialog
        open={open}
        onClose={tryClose}
        labelledBy="edit-profile-title"
        initialFocusRef={nameInputRef}
        size="lg"
        closeOnEscape={!confirmDiscard}
        closeOnBackdrop={!confirmDiscard}
      >
        <h2 id="edit-profile-title" className="sr-only">
          Edit profile
        </h2>

        {/* Close button */}
        <button
          type="button"
          onClick={tryClose}
          className="cf-pressable absolute top-4 right-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full bg-(--cf-surface-muted) text-(--cf-text-3) transition hover:bg-(--cf-surface-strong) hover:text-(--cf-text-1)"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* ──── ZONE 1: Avatar & Identity ──── */}
        <div className="px-6 pt-6 pb-4 text-center">
          {/* Avatar */}
          <div className="relative mx-auto w-24 h-24 mb-3">
            <div className="w-24 h-24 rounded-full bg-(--cf-surface-strong) border-2 border-(--cf-border-strong) flex items-center justify-center text-2xl font-semibold text-(--cf-text-2) overflow-hidden">
              {draft.avatarDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={draft.avatarDataUrl}
                  alt={draft.displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            {/* Upload — a real focusable button that opens the hidden file input */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload profile photo"
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100 cf-focus cursor-pointer"
            >
              <Camera className="w-5 h-5" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)}
            />
          </div>
          <p className="text-xs text-(--cf-text-3) mb-1">
            Click the avatar to upload a photo
          </p>
          {avatarError ? (
            <p className="text-xs text-accent-rose mb-1">{avatarError}</p>
          ) : null}

          {/* Display Name */}
          <div className="mb-3 text-left mt-4">
            <label
              htmlFor="profile-displayName"
              className="block text-[10px] uppercase tracking-widest text-(--cf-text-3) mb-1"
            >
              Display Name
            </label>
            <input
              id="profile-displayName"
              ref={nameInputRef}
              type="text"
              value={draft.displayName}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  displayName: e.target.value,
                }))
              }
              className="w-full bg-(--cf-surface-muted) border border-(--cf-border) rounded-lg px-3 py-2.5
                text-base text-(--cf-text-1) font-medium
                focus:outline-none focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20
                transition-colors"
            />
          </div>

          {/* Username */}
          <div className="mb-3 text-left">
            <label
              htmlFor="profile-username"
              className="block text-[10px] uppercase tracking-widest text-(--cf-text-3) mb-1"
            >
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-(--cf-text-3) text-sm">
                @
              </span>
              <input
                id="profile-username"
                type="text"
                value={draft.username}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    username: e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, ""),
                  }))
                }
                className="w-full bg-(--cf-surface-muted) border border-(--cf-border) rounded-lg pl-7 pr-3 py-2.5
                  text-sm text-(--cf-text-1)
                  focus:outline-none focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20
                  transition-colors"
              />
            </div>
          </div>

          {/* Tagline */}
          <div className="text-left">
            <label
              htmlFor="profile-tagline"
              className="block text-[10px] uppercase tracking-widest text-(--cf-text-3) mb-1"
            >
              Tagline
            </label>
            <input
              id="profile-tagline"
              type="text"
              value={draft.tagline}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, tagline: e.target.value }))
              }
              placeholder="A short line about your reading practice"
              className="w-full bg-(--cf-surface-muted) border border-(--cf-border) rounded-lg px-3 py-2.5
                text-sm text-(--cf-text-2) placeholder:text-(--cf-text-soft)
                focus:outline-none focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20
                transition-colors"
              maxLength={160}
            />
            <p className="text-right text-[10px] text-(--cf-text-3) mt-1">
              {draft.tagline.length}/160
            </p>
          </div>
        </div>

        {/* ──── ZONE 2: Bio ──── */}
        <div className="px-6 py-4 border-t border-(--cf-border)">
          <label
            htmlFor="profile-bio"
            className="block text-[10px] uppercase tracking-widest text-(--cf-text-3) mb-1"
          >
            Bio
          </label>
          <textarea
            id="profile-bio"
            value={draft.bio}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, bio: e.target.value }))
            }
            rows={3}
            className="w-full bg-(--cf-surface-muted) border border-(--cf-border) rounded-lg px-3 py-2.5
              text-sm text-(--cf-text-2) placeholder:text-(--cf-text-soft) resize-none
              focus:outline-none focus:border-accent-cyan/40 focus:ring-1 focus:ring-accent-cyan/20
              transition-colors"
            placeholder="Tell us about your reading journey..."
            maxLength={1200}
          />
          <p className="text-right text-[10px] text-(--cf-text-3) mt-1">
            {draft.bio.length}/1200
          </p>
        </div>

        {/* ──── ZONE 3: Details (collapsible) ──── */}
        <div className="px-6 py-4 border-t border-(--cf-border)">
          <button
            type="button"
            onClick={() => setDetailsOpen(!detailsOpen)}
            className="flex items-center gap-2 text-xs text-(--cf-text-3) hover:text-(--cf-text-2) transition-colors w-full"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
            />
            {detailsOpen ? "Hide details" : "More details"}
          </button>

          <AnimatePresence>
            {detailsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: DUR.fast }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <FieldInput
                    label="Timezone"
                    value={draft.timezone}
                    onChange={(v) =>
                      setDraft((prev) => ({ ...prev, timezone: v }))
                    }
                  />
                  <FieldInput
                    label="Country or Region"
                    value={draft.country}
                    onChange={(v) =>
                      setDraft((prev) => ({ ...prev, country: v }))
                    }
                  />
                  <FieldInput
                    label="Pronouns"
                    value={draft.pronouns}
                    onChange={(v) =>
                      setDraft((prev) => ({ ...prev, pronouns: v }))
                    }
                  />
                  {/* Email — read-only */}
                  <div>
                    <span className="block text-[10px] uppercase tracking-widest text-(--cf-text-3) mb-1">
                      Email
                    </span>
                    <div className="bg-(--cf-surface-muted) border border-(--cf-border) rounded-lg px-3 py-2 text-sm text-(--cf-text-3) cursor-not-allowed">
                      {email ?? "Signed in"}
                    </div>
                    <p className="text-[10px] text-(--cf-text-3) mt-0.5">
                      Managed by your account
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ──── FOOTER ──── */}
        <div className="px-6 py-4 border-t border-(--cf-border) flex items-center justify-between">
          {/* Change indicator */}
          <div className="flex items-center gap-2">
            {dirty ? (
              <span className="flex items-center gap-1.5 text-xs text-accent-amber">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-amber" />
                Unsaved changes
              </span>
            ) : (
              <span className="text-xs text-(--cf-text-3)">No changes</span>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={tryClose}
              className="cf-pressable px-4 py-2 rounded-lg text-sm text-(--cf-text-3) hover:text-(--cf-text-1)
                hover:bg-(--cf-surface-strong) transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!dirty || saving}
              className="cf-pressable px-5 py-2 rounded-lg text-sm font-medium
                bg-accent-cyan hover:bg-accent-cyan/90 text-bg-base
                disabled:bg-(--cf-surface-muted) disabled:text-(--cf-text-soft) disabled:cursor-not-allowed
                transition-colors"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </Dialog>

      {/* ──── Discard confirmation ──── */}
      <Dialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        ariaLabel="Discard unsaved changes"
        size="sm"
        initialFocusRef={keepEditingRef}
      >
        <div className="p-5 text-center">
          <p className="text-sm text-(--cf-text-1) font-medium">
            You have unsaved changes. Discard?
          </p>
          <div className="flex gap-3 mt-4 justify-center">
            <button
              ref={keepEditingRef}
              type="button"
              onClick={() => setConfirmDiscard(false)}
              className="cf-pressable px-4 py-2 rounded-lg text-sm text-(--cf-text-2) hover:bg-(--cf-surface-strong) transition-colors"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmDiscard(false);
                onClose();
              }}
              className="cf-pressable px-4 py-2 rounded-lg text-sm font-medium bg-accent-rose text-white hover:bg-accent-rose/90 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
