import type { SmartFieldType } from "./field-type-rules";
import { parseDateInputToIso } from "./field-type-rules";

export type ValidationSeverity = "error" | "warning";

export type ValidationIssue = {
  code: string;
  severity: ValidationSeverity;
  message: string;
};

export type ValidateFieldArgs = {
  label: string;
  type: SmartFieldType;
  value: string | boolean;
  required: boolean;
  completed?: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asText(value: string | boolean): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeValueForType(type: SmartFieldType, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (type === "email") {
    return trimmed.toLowerCase();
  }

  if (type === "postal") {
    return trimmed.toUpperCase().replace(/\s+/g, " ");
  }

  if (type === "phone") {
    const compact = trimmed.replace(/[^\d+]/g, "");
    const digitsOnly = compact.replace(/\D/g, "");
    if (digitsOnly.length === 10) {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }
    return compact;
  }

  if (type === "currency") {
    const stripped = trimmed.replace(/[^0-9.-]/g, "");
    const parsed = Number(stripped);
    if (Number.isFinite(parsed)) return parsed.toFixed(2);
    return stripped;
  }

  if (type === "number") {
    return trimmed.replace(/[^0-9.-]/g, "");
  }

  return value;
}

export function validateFieldValue(args: ValidateFieldArgs): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const text = asText(args.value);

  if (args.required) {
    if (args.type === "checkbox") {
      if (args.value !== true) {
        issues.push({
          code: "required",
          severity: "error",
          message: `${args.label} is required.`,
        });
        return issues;
      }
    } else {
      const complete = args.completed ?? text.length > 0;
      if (!complete) {
        issues.push({
          code: "required",
          severity: "error",
          message: `${args.label} is required.`,
        });
        return issues;
      }
    }
  }

  if (!text) return issues;

  if (args.type === "email" && !EMAIL_RE.test(text)) {
    issues.push({
      code: "email_format",
      severity: "warning",
      message: `${args.label} does not look like a valid email.`,
    });
  }

  if (args.type === "phone") {
    const digits = text.replace(/\D/g, "");
    if (digits.length > 0 && digits.length < 7) {
      issues.push({
        code: "phone_format",
        severity: "warning",
        message: `${args.label} looks too short for a phone number.`,
      });
    }
  }

  if (args.type === "postal") {
    if (!/^[A-Z0-9 -]{3,12}$/.test(text.toUpperCase())) {
      issues.push({
        code: "postal_format",
        severity: "warning",
        message: `${args.label} format looks unusual.`,
      });
    }
  }

  if (args.type === "number" || args.type === "currency") {
    const numeric = Number(text.replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(numeric)) {
      issues.push({
        code: "number_format",
        severity: "warning",
        message: `${args.label} must be numeric.`,
      });
    }
  }

  if (args.type === "date" && !parseDateInputToIso(text)) {
    issues.push({
      code: "date_format",
      severity: "warning",
      message: `${args.label} has an invalid date format.`,
    });
  }

  return issues;
}
