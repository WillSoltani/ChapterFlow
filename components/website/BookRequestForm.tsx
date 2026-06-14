"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";

interface BookRequestFormProps {
  initialTitle?: string;
  onSuccess: (data: { title: string; author: string; email: string }) => void;
}

interface ValidationErrors {
  title?: string;
  email?: string;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function BookRequestForm({ initialTitle = "", onSuccess }: BookRequestFormProps) {
  const [formState, setFormState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [bookTitle, setBookTitle] = useState(initialTitle);
  const [authorName, setAuthorName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Prefill the title when a parent supplies one (e.g. the "Request this book"
  // shortcut from a zero-results search). Only runs when initialTitle changes.
  useEffect(() => {
    if (initialTitle) setBookTitle(initialTitle);
  }, [initialTitle]);

  const isFormValid = bookTitle.trim().length >= 2 && isValidEmail(email.trim());

  const validateField = useCallback((field: string, value: string) => {
    setErrors((prev) => {
      const next = { ...prev };
      if (field === "title") {
        if (value.trim().length > 0 && value.trim().length < 2) {
          next.title = "Title must be at least 2 characters";
        } else {
          delete next.title;
        }
      }
      if (field === "email") {
        if (value.trim().length > 0 && !isValidEmail(value.trim())) {
          next.email = "Please enter a valid email address";
        } else {
          delete next.email;
        }
      }
      return next;
    });
  }, []);

  const handleBlur = (field: string, value: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field, value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isFormValid) return;

    const payload = {
      title: bookTitle.trim(),
      author: authorName.trim(),
      email: email.trim(),
    };

    setFormState("submitting");

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
    "focus:outline-none focus:ring-0 transition-all duration-200";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
      {/* Book title */}
      <div>
        <input
          type="text"
          value={bookTitle}
          onChange={(e) => {
            setBookTitle(e.target.value);
            if (touched.title) validateField("title", e.target.value);
          }}
          onBlur={() => handleBlur("title", bookTitle)}
          placeholder="Enter book title..."
          className={`w-full h-12 rounded-lg px-4 text-[14px] placeholder:text-[var(--text-muted)] ${inputFocusClass}`}
          style={{
            ...inputStyle(!!errors.title && !!touched.title),
            ...(errors.title && touched.title
              ? {}
              : {}),
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = errors.title && touched.title ? "var(--accent-rose)" : "var(--accent-blue)";
            e.currentTarget.style.boxShadow = errors.title && touched.title
              ? "0 0 0 3px var(--accent-rose-glow)"
              : "0 0 0 3px var(--accent-cyan-glow)";
          }}
          onMouseLeave={() => {}}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = errors.title && touched.title ? "var(--accent-rose)" : "var(--border-subtle)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        {errors.title && touched.title && (
          <p className="text-[11px] mt-1 ml-1" style={{ color: "var(--accent-rose)" }}>
            {errors.title}
          </p>
        )}
      </div>

      {/* Author name */}
      <div>
        <input
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Author name (optional)"
          className={`w-full h-12 rounded-lg px-4 text-[14px] placeholder:text-[var(--text-muted)] ${inputFocusClass}`}
          style={inputStyle(false)}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--accent-blue)";
            e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-cyan-glow)";
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = "var(--border-subtle)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>

      {/* Email */}
      <div>
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (touched.email) validateField("email", e.target.value);
          }}
          onBlur={() => handleBlur("email", email)}
          placeholder="Your email (so we can reach you)"
          className={`w-full h-12 rounded-lg px-4 text-[14px] placeholder:text-[var(--text-muted)] ${inputFocusClass}`}
          style={inputStyle(!!errors.email && !!touched.email)}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = errors.email && touched.email ? "var(--accent-rose)" : "var(--accent-blue)";
            e.currentTarget.style.boxShadow = errors.email && touched.email
              ? "0 0 0 3px var(--accent-rose-glow)"
              : "0 0 0 3px var(--accent-cyan-glow)";
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = errors.email && touched.email ? "var(--accent-rose)" : "var(--border-subtle)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        {errors.email && touched.email && (
          <p className="text-[11px] mt-1 ml-1" style={{ color: "var(--accent-rose)" }}>
            {errors.email}
          </p>
        )}
      </div>

      {/* Submit button */}
      <motion.button
        type="submit"
        disabled={!isFormValid || formState === "submitting"}
        className="w-full h-12 rounded-lg text-[15px] font-semibold cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2"
        style={{
          background: "var(--accent-teal)",
          color: "var(--primary-foreground)",
          opacity: !isFormValid || formState === "submitting" ? 0.5 : 1,
          cursor: !isFormValid || formState === "submitting" ? "not-allowed" : "pointer",
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
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
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
          className="text-[12px] text-center mt-1"
          style={{ color: "var(--accent-rose)" }}
          role="alert"
        >
          Something went wrong sending your request. Please try again.
        </p>
      )}

      {/* Honest microcopy — a statement of intent, not a fabricated metric */}
      <p
        className="text-[12px] text-center mt-2"
        style={{ color: "var(--text-muted)" }}
      >
        We read every request and build the most-asked-for titles first.
      </p>
    </form>
  );
}
