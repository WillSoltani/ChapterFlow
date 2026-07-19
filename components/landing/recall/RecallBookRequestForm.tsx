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
 * a11y: every field has a <label>, required-field errors are revealed on blur or
 * submit and wired via aria-describedby + aria-invalid, invalid submit focuses
 * the first field, and one live region announces validation changes. Honeypot
 * fields (website/company) are off-screen and silently dropped by the endpoint.
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { Check, Loader2, AlertCircle, ArrowRight } from "lucide-react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TITLE_ERROR = "Please enter at least 2 characters for the book title.";
const EMAIL_ERROR = "Please enter a valid email address.";

type Status = "idle" | "submitting" | "success" | "error";
type RequiredField = "title" | "email";
type RequiredFieldErrors = Partial<Record<RequiredField, string>>;

export function validateRecallBookRequest({
  title,
  email,
}: {
  title: string;
  email: string;
}): {
  errors: RequiredFieldErrors;
  firstInvalid: RequiredField | null;
} {
  const errors: RequiredFieldErrors = {};
  if (title.trim().length < 2) errors.title = TITLE_ERROR;
  if (!EMAIL_RE.test(email.trim())) errors.email = EMAIL_ERROR;

  return {
    errors,
    firstInvalid: errors.title ? "title" : errors.email ? "email" : null,
  };
}

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
  const [touched, setTouched] = useState<Record<RequiredField, boolean>>({
    title: false,
    email: false,
  });
  const [focusField, setFocusField] = useState<RequiredField | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [validationAnnouncement, setValidationAnnouncement] = useState("");

  const titleRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const submitFocusInProgressRef = useRef(false);

  const ids = useId();
  const id = (field: string) => `${ids}-${field}`;

  const validation = validateRecallBookRequest({ title, email });
  const titleError = touched.title ? validation.errors.title : undefined;
  const emailError = touched.email ? validation.errors.email : undefined;

  // Focus only after React has committed aria-invalid/aria-describedby and the
  // error text, so assistive technology receives the field and its explanation
  // together instead of focusing the pre-validation DOM.
  useEffect(() => {
    if (!focusField) return;
    const input = focusField === "title" ? titleRef : emailRef;
    submitFocusInProgressRef.current = true;
    try {
      input.current?.focus();
    } finally {
      submitFocusInProgressRef.current = false;
    }
  }, [focusField, focusRequest]);

  function handleRequiredBlur(field: RequiredField) {
    setTouched((current) => ({ ...current, [field]: true }));
    // Keyboard submit focuses the first invalid field from the effect above.
    // Do not let that programmatic focus blur replace the submit summary; all
    // ordinary pointer/keyboard blurs still announce their field error here.
    if (!submitFocusInProgressRef.current) {
      setValidationAnnouncement(validation.errors[field] ?? "");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ title: true, email: true });
    if (validation.firstInvalid) {
      // A prior network error is no longer the active problem. Keep one alert
      // authority at a time, then announce a concise validation summary while
      // the focused field supplies the specific error via aria-describedby.
      if (status === "error") setStatus("idle");
      setErrorMsg("");
      setValidationAnnouncement(
        validation.errors.title && validation.errors.email
          ? "Please correct the book title and email fields."
          : "Please correct the highlighted required field.",
      );
      setFocusField(validation.firstInvalid);
      // Increment even when the same field remains invalid so every submit
      // attempt moves focus after the fresh validation render.
      setFocusRequest((current) => current + 1);
      return;
    }

    setStatus("submitting");
    setErrorMsg("");
    setValidationAnnouncement("");
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
      <p
        id={id("validation-status")}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {validationAnnouncement}
      </p>
      <Field
        id={id("title")}
        inputRef={titleRef}
        label="Book title"
        required
        value={title}
        onChange={setTitle}
        onBlur={() => handleRequiredBlur("title")}
        placeholder="e.g. The Beginning of Infinity"
        autoComplete="off"
        invalid={Boolean(titleError)}
        errorId={id("title-err")}
        errorText={validation.errors.title}
      />
      <Field
        id={id("email")}
        inputRef={emailRef}
        label="Your email"
        required
        type="email"
        value={email}
        onChange={setEmail}
        onBlur={() => handleRequiredBlur("email")}
        placeholder="you@example.com"
        autoComplete="email"
        invalid={Boolean(emailError)}
        errorId={id("email-err")}
        errorText={validation.errors.email}
      />
      {/* Reassure before the field that needs the email: scope + no spam, with
          the canonical privacy page linked. */}
      <p
        className="-mt-2.5 text-[0.8125rem] leading-relaxed"
        style={{ color: "var(--cf-recall-ink-faint)" }}
      >
        We&apos;ll only email you about this title. No spam, no sharing — see our{" "}
        <a
          href="/legal/privacy"
          className="rounded underline underline-offset-4 transition-colors duration-150 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            color: "var(--cf-recall-ink-soft)",
            // @ts-expect-error -- CSS custom property for the focus ring color
            "--tw-ring-color": "var(--cf-recall-accent-line)",
          }}
        >
          privacy
        </a>{" "}
        policy.
      </p>
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

      {/* Honeypot — off-screen, hidden from assistive tech and tab order. The
          data-*-ignore hints tell password managers / browser autofill to leave
          these alone: "Company" especially is a common address-autofill target,
          and an autofilled honeypot would make the server silently drop a real
          reader's request. */}
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
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
        <label htmlFor={id("company")}>Company</label>
        <input
          id={id("company")}
          type="text"
          tabIndex={-1}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          data-form-type="other"
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
        disabled={status === "submitting"}
        aria-busy={status === "submitting"}
        className="rl-cta-accent mt-1 inline-flex w-full items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[0.9375rem] font-semibold transition-[transform,filter,opacity] duration-150 ease-out hover:brightness-105 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55"
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
  inputRef,
  label,
  value,
  onChange,
  onBlur,
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
  inputRef?: RefObject<HTMLInputElement | null>;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
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
        ref={inputRef}
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
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
      {errorId && errorText ? (
        <div className="grid">
          <span
            aria-hidden
            className="invisible col-start-1 row-start-1 text-[0.8125rem] leading-relaxed"
          >
            {errorText}
          </span>
          {invalid ? (
            <p
              id={errorId}
              className="col-start-1 row-start-1 text-[0.8125rem] leading-relaxed"
              style={{ color: "var(--cf-recall-ink-soft)" }}
            >
              {errorText}
            </p>
          ) : null}
        </div>
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
