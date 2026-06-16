"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles, Plus, Database } from "lucide-react";
import { BookClientError, fetchBookJson } from "@/app/book/_lib/book-api";
import type { EventDefinitionItem } from "@/app/app/api/book/_lib/types";
import { PageHeader } from "@/app/book/admin/_components/AdminCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorAlert } from "@/app/book/admin/_components/ErrorAlert";

type EventsResponse = { events: EventDefinitionItem[] };
type EventResponse = { event: EventDefinitionItem };

const EMPTY_FORM: Omit<EventDefinitionItem, "createdAt" | "updatedAt" | "createdBy"> = {
  eventId: "",
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  books: [],
  dailyChapterTarget: 1,
  targetChapters: 10,
  badge: { badgeId: "", name: "", icon: "" },
  bonusIP: 400,
  active: true,
};

function statusLabel(event: EventDefinitionItem): {
  label: string;
  style: string;
} {
  if (!event.active)
    return {
      label: "Inactive",
      style:
        "border-(--cf-border) bg-(--cf-surface-muted) text-(--cf-text-soft)",
    };
  const now = new Date();
  if (new Date(event.endDate) < now)
    return {
      label: "Expired",
      style:
        "border-(--cf-danger-border) bg-(--cf-danger-soft) text-(--cf-danger-text)",
    };
  if (new Date(event.startDate) > now)
    return {
      label: "Upcoming",
      style:
        "border-(--cf-accent-border) bg-(--cf-accent-soft) text-(--cf-accent)",
    };
  return {
    label: "Active",
    style:
      "border-(--cf-success-border) bg-(--cf-success-soft) text-(--cf-success-text)",
  };
}

export function AdminEventsClient() {
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EventDefinitionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventDefinitionItem | null>(
    null,
  );
  const [form, setForm] = useState(EMPTY_FORM);
  const [booksInput, setBooksInput] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    fetchBookJson<EventsResponse>("/app/api/book/admin/events")
      .then((data) => setEvents(data.events ?? []))
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Unable to load events.",
        );
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const ordered = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime(),
      ),
    [events],
  );

  const openCreate = () => {
    setEditingEvent(null);
    setForm(EMPTY_FORM);
    setBooksInput("");
    setShowForm(true);
    setError(null);
  };

  const openEdit = (event: EventDefinitionItem) => {
    setEditingEvent(event);
    setForm({
      eventId: event.eventId,
      title: event.title,
      description: event.description,
      startDate: event.startDate.slice(0, 16),
      endDate: event.endDate.slice(0, 16),
      books: event.books,
      dailyChapterTarget: event.dailyChapterTarget,
      targetChapters: event.targetChapters,
      badge: { ...event.badge },
      bonusIP: event.bonusIP,
      active: event.active,
    });
    setBooksInput(event.books.join(", "));
    setShowForm(true);
    setError(null);
  };

  const handleSave = async () => {
    setError(null);

    if (!form.title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!form.startDate || !form.endDate) {
      setError("Start and end dates are required.");
      return;
    }
    if (!editingEvent && !form.eventId.trim()) {
      setError("Event ID is required.");
      return;
    }

    const books = booksInput
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean);
    if (books.length === 0) {
      setError("At least one book ID is required.");
      return;
    }

    if (!form.badge.badgeId.trim() || !form.badge.name.trim() || !form.badge.icon.trim()) {
      setError("Badge ID, name, and icon are all required.");
      return;
    }

    const payload = {
      ...form,
      books,
      startDate: new Date(form.startDate).toISOString(),
      endDate: new Date(form.endDate).toISOString(),
    };

    setSavingId("form");
    try {
      if (editingEvent) {
        await fetchBookJson<EventResponse>(
          `/app/api/book/admin/events/${encodeURIComponent(editingEvent.eventId)}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setToast("Event updated.");
      } else {
        await fetchBookJson<EventResponse>("/app/api/book/admin/events", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setToast("Event created.");
      }
      setShowForm(false);
      reload();
    } catch (err: unknown) {
      setError(
        err instanceof BookClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to save event.",
      );
    } finally {
      setSavingId(null);
    }
  };

  const toggleActive = async (event: EventDefinitionItem) => {
    setSavingId(event.eventId);
    try {
      await fetchBookJson(
        `/app/api/book/admin/events/${encodeURIComponent(event.eventId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ active: !event.active }),
        },
      );
      setToast(event.active ? "Event deactivated." : "Event activated.");
      reload();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Unable to toggle event.",
      );
    } finally {
      setSavingId(null);
    }
  };

  const handleSeed = async () => {
    setSavingId("seed");
    setError(null);
    try {
      const res = await fetchBookJson<{ seeded: number; skipped: number }>(
        "/app/api/book/admin/events/seed",
        { method: "POST" },
      );
      setToast(`Seeded ${res.seeded} event${res.seeded === 1 ? "" : "s"} (${res.skipped} skipped).`);
      reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to seed events.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (eventId: string) => {
    setSavingId(eventId);
    try {
      await fetchBookJson(
        `/app/api/book/admin/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE" },
      );
      setToast("Event deleted.");
      setConfirmDeleteId(null);
      reload();
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Unable to delete event.",
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Seasonal Events"
        description="Create and manage time-limited reading challenges."
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSeed}
              disabled={savingId === "seed"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-(--cf-border) bg-(--cf-surface) px-3 py-1.5 text-[12px] font-medium text-(--cf-text-2) shadow-(--cf-input-inset-shadow) transition hover:bg-(--cf-surface-muted) hover:text-(--cf-text-1) disabled:cursor-not-allowed disabled:opacity-60"
              title="Import starter events from content/events/events.json"
            >
              <Database className="h-3.5 w-3.5" />
              {savingId === "seed" ? "Seeding..." : "Seed"}
            </button>
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-(--cf-accent) px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:brightness-110"
            >
              <Plus className="h-3.5 w-3.5" />
              New event
            </button>
          </div>
        }
      />

      {error && <ErrorAlert error={error} onRetry={reload} />}

      {loading && events.length === 0 && (
        <div className="cf-panel-muted rounded-2xl p-5 text-[13px] text-(--cf-text-2)">
          Loading events…
        </div>
      )}

      <section className="space-y-4">
        {/* (Form + list rendered below) */}

        {/* Create / Edit form */}
        {showForm && (
          <div className="rounded-2xl border border-(--cf-accent-border) bg-(--cf-surface) p-5 shadow-shadow-card">
            <h2 className="text-lg font-semibold text-(--cf-text-1)">
              {editingEvent ? "Edit Event" : "Create Event"}
            </h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {!editingEvent && (
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-3)">
                    Event ID (slug)
                  </label>
                  <input
                    type="text"
                    value={form.eventId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, eventId: e.target.value }))
                    }
                    placeholder="e.g. summer-sprint-2026"
                    className="cf-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                  />
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-3)">
                  Title
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="cf-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-3)">
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={2}
                  className="cf-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-3)">
                  Start Date
                </label>
                <input
                  type="datetime-local"
                  value={form.startDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startDate: e.target.value }))
                  }
                  className="cf-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-3)">
                  End Date
                </label>
                <input
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endDate: e.target.value }))
                  }
                  className="cf-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-3)">
                  Book IDs (comma-separated)
                </label>
                <textarea
                  value={booksInput}
                  onChange={(e) => setBooksInput(e.target.value)}
                  placeholder="atomic-habits, deep-work, the-one-thing"
                  rows={2}
                  className="cf-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-3)">
                  Daily Chapter Target
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={form.dailyChapterTarget}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      dailyChapterTarget: parseInt(e.target.value) || 1,
                    }))
                  }
                  className="cf-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-3)">
                  Target Chapters (to complete)
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={form.targetChapters}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      targetChapters: parseInt(e.target.value) || 1,
                    }))
                  }
                  className="cf-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-3)">
                  Bonus IP
                </label>
                <input
                  type="number"
                  min={0}
                  max={5000}
                  value={form.bonusIP}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      bonusIP: parseInt(e.target.value) || 0,
                    }))
                  }
                  className="cf-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-3)">
                  Badge Icon
                </label>
                <input
                  type="text"
                  value={form.badge.icon}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      badge: { ...f.badge, icon: e.target.value },
                    }))
                  }
                  placeholder="sun, zap, flag, etc."
                  className="cf-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-3)">
                  Badge ID
                </label>
                <input
                  type="text"
                  value={form.badge.badgeId}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      badge: { ...f.badge, badgeId: e.target.value },
                    }))
                  }
                  placeholder="event-my-event-2026"
                  className="cf-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.12em] text-(--cf-text-3)">
                  Badge Name
                </label>
                <input
                  type="text"
                  value={form.badge.name}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      badge: { ...f.badge, name: e.target.value },
                    }))
                  }
                  placeholder="Spring Sprinter"
                  className="cf-input mt-1 w-full rounded-xl px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={savingId === "form"}
                onClick={handleSave}
                className="rounded-xl bg-(--cf-accent) px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {savingId === "form"
                  ? "Saving..."
                  : editingEvent
                    ? "Update Event"
                    : "Create Event"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-4 py-2.5 text-sm font-semibold text-(--cf-text-2) transition hover:opacity-90"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Events list */}
        {!loading && ordered.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No events defined yet"
            description="Seed the starter events from content/events/events.json or click 'New event' to create your own."
            action={
              <button
                type="button"
                onClick={handleSeed}
                disabled={savingId === "seed"}
                className="inline-flex items-center gap-1.5 rounded-xl bg-(--cf-accent) px-3.5 py-1.5 text-[13px] font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                <Database className="h-3.5 w-3.5" />
                {savingId === "seed" ? "Seeding..." : "Seed starter events"}
              </button>
            }
          />
        ) : ordered.length > 0 ? (
          <div className="space-y-3">
            {ordered.map((event) => {
              const status = statusLabel(event);
              const saving = savingId === event.eventId;
              return (
                <article
                  key={event.eventId}
                  className="rounded-2xl border border-(--cf-border) bg-(--cf-surface) p-4 shadow-shadow-card"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-(--cf-text-1)">
                          {event.title}
                        </h2>
                        <span
                          className={`rounded-lg border px-2 py-0.5 text-xs font-semibold ${status.style}`}
                        >
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-(--cf-text-2)">
                        {event.description}
                      </p>
                      <p className="mt-1 text-xs text-(--cf-text-3)">
                        ID: {event.eventId} &middot;{" "}
                        {new Date(event.startDate).toLocaleDateString()} &ndash;{" "}
                        {new Date(event.endDate).toLocaleDateString()} &middot;{" "}
                        {event.books.length} books &middot;{" "}
                        {event.targetChapters} chapters &middot;{" "}
                        {event.bonusIP} IP
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => openEdit(event)}
                      className="rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2 text-sm font-semibold text-(--cf-text-2) transition hover:opacity-90 disabled:opacity-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => toggleActive(event)}
                      className={[
                        "rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50",
                        event.active
                          ? "border border-(--cf-danger-border) bg-(--cf-danger-soft) text-(--cf-danger-text) hover:opacity-90"
                          : "border border-(--cf-success-border) bg-(--cf-success-soft) text-(--cf-success-text) hover:opacity-90",
                      ].join(" ")}
                    >
                      {event.active ? "Deactivate" : "Activate"}
                    </button>
                    {confirmDeleteId === event.eventId ? (
                      <>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleDelete(event.eventId)}
                          className="rounded-xl border border-(--cf-danger-border) bg-(--cf-danger-soft) px-3 py-2 text-sm font-semibold text-(--cf-danger-text) transition hover:opacity-90 disabled:opacity-50"
                        >
                          {saving ? "Deleting..." : "Confirm Delete"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2 text-sm font-semibold text-(--cf-text-2) transition hover:opacity-90"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setConfirmDeleteId(event.eventId)}
                        className="rounded-xl border border-(--cf-border) bg-(--cf-surface-muted) px-3 py-2 text-sm font-semibold text-(--cf-text-3) transition hover:opacity-90 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </section>

      {toast && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-(--cf-border) bg-(--cf-surface-strong) px-3 py-2 text-sm text-(--cf-text-1) shadow-[0_14px_28px_rgba(0,0,0,0.22)]">
          {toast}
        </div>
      )}
    </div>
  );
}
