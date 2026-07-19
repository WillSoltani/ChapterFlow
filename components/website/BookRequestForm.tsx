"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/components/ui/usePrefersReducedMotion";

interface BookRequestFormProps {
  initialTitle?: string;
  onSuccess: (data: { title: string; author: string; email: string }) => void;
}

interface ValidationErrors {
  title?: string;
  email?: string;
}

type RequiredField = keyof ValidationErrors;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getFieldError(field: RequiredField, value: string): string | undefined {
  const trimmed = value.trim();
  if (field === "title") {
    if (!trimmed) return "Enter a book title";
    if (trimmed.length < 2) return "Title must be at least 2 characters";
  }
  if (field === "email") {
    if (!trimmed) return "Enter your email address";
    if (!isValidEmail(trimmed)) return "Please enter a valid email address";
  }
  return undefined;
}

export function validateBookRequest(title: string, email: string): {
  errors: ValidationErrors;
  firstInvalid: RequiredField | null;
} {
  const errors: ValidationErrors = {};
  const titleError = getFieldError("title", title);
  const emailError = getFieldError("email", email);
  if (titleError) errors.title = titleError;
  if (emailError) errors.email = emailError;
  return {
    errors,
    firstInvalid: errors.title ? "title" : errors.email ? "email" : null,
  };
}

export function BookRequestForm({ initialTitle = "", onSuccess }: BookRequestFormProps) {
  const reducedMotion = usePrefersReducedMotion();
  const [formState, setFormState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  // Seed the title once from the parent prop via a lazy initializer (avoids a
  // setState-in-effect). The component is keyed by initialTitle upstream
  // (BookRequestSection), so a new prefill remounts this with the fresh seed.
  const [bookTitle, setBookTitle] = useState(() => initialTitle);
  const [authorName, setAuthorName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [focusField, setFocusField] = useState<RequiredField | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [validationAnnouncement, setValidationAnnouncement] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const isFormValid = bookTitle.trim().length >= 2 && isValidEmail(email.trim());

  const validateField = useCallback((field: RequiredField, value: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      const error = getFieldError(field, value);
      if (error) next[field] = error;
      else delete next[field];
      return next;
    });
  }, []);

  useEffect(() => {
    if (!focusField) return;
    (focusField === "title" ? titleRef : emailRef).current?.focus();
  }, [focusField, focusRequest]);

  const handleBlur = (field: RequiredField, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field, value);
    setValidationAnnouncement(getFieldError(field, value) ?? "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validateBookRequest(bookTitle, email);
    if (validation.firstInvalid) {
      setTouched({ title: true, email: true });
      setErrors(validation.errors);
      setValidationAnnouncement(
        validation.errors.title && validation.errors.email
          ? "Correct the book title and email fields."
          : "Correct the highlighted required field.",
      );
      setFocusField(validation.firstInvalid);
      setFocusRequest((current) => current + 1);
      return;
    }

    const payload = {
      title: bookTitle.trim(),
      author: authorName.trim(),
      email: email.trim(),
    };

    setFormState("submitting");
    setValidationAnnouncement("");

    try {
      const res = await fetch("/api/book-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`request failed: ${res.status}`);
      setFormState("success");
      onSuccess(payload);
    } catch {
      setFormState("error");
    }
  };

  const inputStyle = (hasError: boolean) => ({
    background: "var(--bg-elevated)",
    border: `1px solid ${hasError ? "var(--accent-rose)" : "var(--border-subtle)"}`,
    color: "var(--text-primary)",
    fontFamily: "var(--font-body)",
  });

  const inputFocusClass =
    "transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2";

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-2.5">
      <p
        id="book-request-required-instructions"
        className="mb-1 text-left text-cf-label-sm"
        style={{ color: "var(--text-muted)" }}
      >
        Required fields are marked with an asterisk (*).
      </p>
      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {validationAnnouncement}
      </p>

      {/* Book title */}
      <div>
        <label htmlFor="book-request-title" className="mb-1 block text-left text-cf-label-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          Book title <span aria-hidden="true">*</span><span className="sr-only"> (required)</span>
        </label>
        <input
          ref={titleRef}
          id="book-request-title"
          type="text"
          required
          value={bookTitle}
          onChange={(e) => {
            setBookTitle(e.target.value);
            if (touched.title) validateField("title", e.target.value);
          }}
          onBlur={() => handleBlur("title", bookTitle)}
          placeholder="Enter book title..."
          aria-invalid={!!errors.title && !!touched.title}
          aria-describedby={[
            "book-request-required-instructions",
            errors.title && touched.title ? "book-request-title-error" : null,
          ].filter(Boolean).join(" ")}
          className={`w-full h-12 rounded-lg px-4 text-cf-body-sm placeholder:text-[var(--text-muted)] ${inputFocusClass}`}
          style={inputStyle(!!errors.title && !!touched.title)}
        />
        {errors.title && touched.title && (
          <p id="book-request-title-error" className="text-cf-caption mt-1 ml-1" style={{ color: "var(--accent-rose)" }}>
            {errors.title}
          </p>
        )}
      </div>

      {/* Author name */}
      <div>
        <label htmlFor="book-request-author" className="sr-only">
          Author name (optional)
        </label>
        <input
          id="book-request-author"
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Author name (optional)"
          className={`w-full h-12 rounded-lg px-4 text-cf-body-sm placeholder:text-[var(--text-muted)] ${inputFocusClass}`}
          style={inputStyle(false)}
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="book-request-email" className="mb-1 block text-left text-cf-label-sm font-medium" style={{ color: "var(--text-secondary)" }}>
          Your email <span aria-hidden="true">*</span><span className="sr-only"> (required)</span>
        </label>
        <input
          ref={emailRef}
          id="book-request-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (touched.email) validateField("email", e.target.value);
          }}
          onBlur={() => handleBlur("email", email)}
          placeholder="Your email (so we can reach you)"
          aria-invalid={!!errors.email && !!touched.email}
          aria-describedby={[
            "book-request-required-instructions",
            errors.email && touched.email ? "book-request-email-error" : null,
          ].filter(Boolean).join(" ")}
          className={`w-full h-12 rounded-lg px-4 text-cf-body-sm placeholder:text-[var(--text-muted)] ${inputFocusClass}`}
          style={inputStyle(!!errors.email && !!touched.email)}
        />
        {errors.email && touched.email && (
          <p id="book-request-email-error" className="text-cf-caption mt-1 ml-1" style={{ color: "var(--accent-rose)" }}>
            {errors.email}
          </p>
        )}
      </div>

      {/* Submit button */}
      <motion.button
        type="submit"
        disabled={formState === "submitting"}
        aria-busy={formState === "submitting"}
        className="w-full h-12 rounded-lg text-cf-body font-semibold cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2"
        style={{
          background: "var(--accent-cyan)",
          color: "var(--primary-foreground)",
          opacity: formState === "submitting" ? 0.5 : 1,
          cursor: formState === "submitting" ? "not-allowed" : "pointer",
          fontFamily: "var(--font-body)",
        }}
        whileHover={
          isFormValid && formState !== "submitting"
            ? {
                scale: 1.02,
                boxShadow: "var(--shadow-glow-cyan)",
              }
            : {}
        }
        whileTap={isFormValid && formState !== "submitting" ? { scale: 0.98 } : {}}
      >
        {formState === "submitting" ? (
          <>
            <motion.svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              animate={reducedMotion ? undefined : { rotate: 360 }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { duration: 1, repeat: Infinity, ease: "linear" }
              }
            >
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="28"
                strokeDashoffset="8"
              />
            </motion.svg>
            Submitting...
          </>
        ) : (
          <motion.span className="flex items-center gap-1">
            Request this book{" "}
            <motion.span
              className="inline-block"
              whileHover={{ x: 3 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              →
            </motion.span>
          </motion.span>
        )}
      </motion.button>

      {/* Error state — shown only when the submission actually failed */}
      {formState === "error" && (
        <p
          className="text-cf-label-sm text-center mt-1"
          style={{ color: "var(--accent-rose)" }}
          role="alert"
        >
          Something went wrong sending your request. Please try again.
        </p>
      )}

      {/* Honest microcopy — a statement of intent, not a fabricated metric */}
      <p
        className="text-cf-label-sm text-center mt-2"
        style={{ color: "var(--text-muted)" }}
      >
        We read every request and build the most-asked-for titles first.
      </p>
    </form>
  );
}
