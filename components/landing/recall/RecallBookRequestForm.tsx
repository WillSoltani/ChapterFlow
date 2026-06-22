"use client";

/**
 * RecallBookRequestForm — the RECALL-native "request a book we don't have" form.
 *
 * The ONLY place with submit logic; reused inline (RecallRequestSection) and
 * inside a dialog (RecallBookRequestDialog, from the library button + the browse
 * empty-state). Posts to the existing public endpoint POST /api/book-requests,
 * which persists the request and emails the team — so a request "comes straight
 * to" the owner with no new backend.
 *
 * RECALL design: token-only color, ONE periwinkle accent (the submit CTA + the
 * success ring); every other state is expressed in neutral ink/opacity (no second
 * hue, so the error banner is a muted neutral with an icon, not red). Client
 * validation MIRRORS the server (title ≥ 2 chars, same email regex) so the user
 * never round-trips for an obvious mistake; the server stays the source of truth.
 *
 * a11y: every field has a <label>, errors are wired via aria-describedby +
 * aria-invalid, the submit button is disabled while invalid/submitting, and the
 * success/error regions are announced. Honeypot fields (website/company) are
 * off-screen and the endpoint silently drops anything that fills them.
 */

import { useId, useState, type FormEvent } from "react";
import { Check, Loader2, AlertCircle, ArrowRight } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = "idle" | "submitting" | "success" | "error";

type RecallBookRequestFormProps = {
  /** Pre-fill the title (e.g. the unmatched search term from the browser). */
  initialTitle?: string;
  /** Called once the request is accepted (201), e.g. to keep a dialog open on
   *  the success state. */
  onSuccess?: () => void;
};

export function RecallBookRequestForm({
  initialTitle = "",
  onSuccess,
}: RecallBookRequestFormProps) {
  // The dialog unmounts its children on close (AnimatePresence), so a fresh open
  // re-seeds `title` from initialTitle via this initializer — no effect needed.
  const [title, setTitle] = useState(initialTitle);
  const [email, setEmail] = useState("");
  const [author, setAuthor] = useState("");
  const [note, setNote] = useState("");
  // Honeypots — humans never see or fill these; the endpoint drops anything that does.
  const [website, setWebsite] = useState("");
  const [company, setCompany] = useState("");

  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [touched, setTouched] = useState(false);

  const ids = useId();
  const id = (field: string) => `${ids}-${field}`;

  const titleValid = title.trim().length >= 2;
  const emailValid = EMAIL_RE.test(email.trim());
  const canSubmit = titleValid && emailValid && status !== "submitting";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!titleValid || !emailValid) return;

    setStatus("submitting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/book-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          author: author.trim(),
          email: email.trim(),
          note: note.trim(),
          website,
          company,
        }),
      });
      if (res.ok) {
        setStatus("success");
        onSuccess?.();
        return;
      }
      // Map the endpoint's error codes to calm, on-brand copy.
      const data = (await res.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;
      setStatus("error");
      setErrorMsg(
        data?.error === "rate_limited"
          ? "You’ve sent a few requests recently. Please try again in a little while."
          : data?.message ||
              "Something went wrong on our end. Please try again in a moment.",
      );
    } catch {
      setStatus("error");
      setErrorMsg(
        "We couldn’t reach the server. Check your connection and try again.",
      );
    }
  }

  if (status === "success") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="cf-fade-up flex flex-col items-center rounded-[1.25rem] px-7 py-10 text-center"
        style={{
          background: "var(--cf-recall-plate)",
          border: "1px solid var(--cf-recall-accent-line)",
        }}
      >
        <span
          className="grid h-12 w-12 place-items-center rounded-full"
          style={{
            background: "var(--cf-recall-accent-wash)",
            border: "1px solid var(--cf-recall-accent-line)",
          }}
        >
          <Check
            size={22}
            strokeWidth={2.5}
            aria-hidden
            style={{ color: "var(--cf-recall-accent)" }}
          />
        </span>
        <p
          className="mt-5 font-(family-name:--font-display) text-[1.375rem] font-bold tracking-[-0.02em]"
          style={{ color: "var(--cf-recall-ink)" }}
        >
          Request received
        </p>
        <p
          className="mt-2 max-w-[34ch] text-[0.9375rem] leading-relaxed"
          style={{ color: "var(--cf-recall-ink-soft)" }}
        >
          We’ve logged “{title.trim()}”. If we add it to the library, we’ll email
          you at {email.trim()}. No spam, ever.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <Field
        id={id("title")}
        label="Book title"
        required
        value={title}
        onChange={setTitle}
        placeholder="e.g. The Beginning of Infinity"
        autoComplete="off"
        invalid={touched && !titleValid}
        errorId={id("title-err")}
        errorText="Please enter the book title."
      />
      <Field
        id={id("email")}
        label="Your email"
        required
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        autoComplete="email"
        invalid={touched && !emailValid}
        errorId={id("email-err")}
        errorText="Please enter a valid email address."
      />
      <Field
        id={id("author")}
        label="Author"
        optional
        value={author}
        onChange={setAuthor}
        placeholder="Optional"
        autoComplete="off"
      />
      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={id("note")} label="Anything else" optional />
        <textarea
          id={id("note")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional — why you want it, an edition, etc."
          rows={3}
          maxLength={1000}
          className="rl-input resize-none"
        />
      </div>

      {/* Honeypot — off-screen, hidden from assistive tech and tab order. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
      >
        <label htmlFor={id("website")}>Website</label>
        <input
          id={id("website")}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
        <label htmlFor={id("company")}>Company</label>
        <input
          id={id("company")}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
      </div>

      {status === "error" ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-[0.875rem] leading-relaxed"
          style={{
            background: "var(--cf-recall-panel)",
            border: "1px solid var(--cf-recall-border-strong)",
            color: "var(--cf-recall-ink-soft)",
          }}
        >
          <AlertCircle
            size={16}
            strokeWidth={2}
            aria-hidden
            className="mt-0.5 shrink-0"
            style={{ color: "var(--cf-recall-ink)" }}
          />
          <span>{errorMsg}</span>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[0.9375rem] font-semibold transition-[transform,filter,opacity] duration-150 ease-out hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
        style={{
          background: "var(--cf-recall-accent)",
          color: "var(--cf-recall-bg)",
          boxShadow: "0 14px 40px -12px var(--cf-recall-glow)",
          // @ts-expect-error -- CSS custom property for the focus ring color
          "--tw-ring-color": "var(--cf-recall-accent)",
        }}
      >
        {status === "submitting" ? (
          <>
            <Loader2 size={17} strokeWidth={2.25} aria-hidden className="animate-spin" />
            Sending…
          </>
        ) : (
          <>
            Request this book
            <ArrowRight size={17} strokeWidth={2.25} aria-hidden />
          </>
        )}
      </button>
    </form>
  );
}

/* ── A labelled text field (RECALL input chrome via .rl-input). ─────────────── */
function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
  optional = false,
  autoComplete,
  invalid = false,
  errorId,
  errorText,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
  optional?: boolean;
  autoComplete?: string;
  invalid?: boolean;
  errorId?: string;
  errorText?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <FieldLabel htmlFor={id} label={label} required={required} optional={optional} />
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid && errorId ? errorId : undefined}
        className="rl-input"
        style={
          invalid
            ? { borderColor: "var(--cf-recall-ink-soft)" }
            : undefined
        }
      />
      {invalid && errorId ? (
        <p id={errorId} className="text-[0.8125rem]" style={{ color: "var(--cf-recall-ink-soft)" }}>
          {errorText}
        </p>
      ) : null}
    </div>
  );
}

function FieldLabel({
  htmlFor,
  label,
  required = false,
  optional = false,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="flex items-center gap-2 text-[0.8125rem] font-medium"
      style={{ color: "var(--cf-recall-ink-soft)" }}
    >
      {label}
      {required ? (
        <span style={{ color: "var(--cf-recall-accent)" }} aria-hidden>
          *
        </span>
      ) : null}
      {optional ? (
        <span
          className="font-(family-name:--font-mono) text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--cf-recall-ink-faint)" }}
        >
          Optional
        </span>
      ) : null}
    </label>
  );
}
