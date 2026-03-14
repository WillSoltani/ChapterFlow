export type PdfFieldKind = "text" | "checkbox" | "radio" | "dropdown" | "signature";

export type SmartFieldType =
  | "text"
  | "multiline"
  | "email"
  | "phone"
  | "postal"
  | "number"
  | "currency"
  | "date"
  | "checkbox"
  | "radio"
  | "dropdown"
  | "signature";

export type DateFormatPattern = "MM/DD/YYYY" | "YYYY-MM-DD" | "DD/MM/YYYY";

export type FieldClassificationInput = {
  pdfKind: PdfFieldKind;
  fieldName: string;
  label: string;
  tooltip?: string | null;
  defaultValue?: string | boolean;
  options?: string[];
  multiLine?: boolean;
  dateTimeType?: string | null;
  dateTimeFormat?: string | null;
};

export type FieldClassification = {
  type: SmartFieldType;
  dateFormat: DateFormatPattern | null;
  signatureLike: boolean;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_KEYWORD_RE = /\b(email|e-mail)\b/i;
const PHONE_KEYWORD_RE = /\b(phone|mobile|tel|telephone|fax|contact number)\b/i;
const POSTAL_KEYWORD_RE = /\b(zip|postal|postcode|zip code)\b/i;
const CURRENCY_KEYWORD_RE = /\b(amount|total|price|balance|fee|cost|payment|usd|eur|cad|\$)\b/i;
const NUMBER_KEYWORD_RE = /\b(number|qty|quantity|count|age|years?)\b/i;
const MULTILINE_KEYWORD_RE = /\b(address|notes?|comments?|description|details|message)\b/i;

function toText(input: unknown): string {
  return typeof input === "string" ? input.trim() : "";
}

function isStrictDateLabel(label: string, tooltip?: string | null): boolean {
  const candidates = [label, toText(tooltip)]
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.toLowerCase());
  return candidates.some((value) => /\bdate\b/.test(value));
}

export function detectDateFormatFromHint(raw: string | null | undefined): DateFormatPattern | null {
  if (!raw) return null;
  const hint = raw.toUpperCase();
  if (hint.includes("YYYY-MM-DD")) return "YYYY-MM-DD";
  if (hint.includes("DD/MM/YYYY")) return "DD/MM/YYYY";
  if (hint.includes("MM/DD/YYYY")) return "MM/DD/YYYY";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "YYYY-MM-DD";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) return "MM/DD/YYYY";
  return null;
}

export function parseDateInputToIso(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const slash = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!slash) return null;
  const first = Number(slash[1]);
  const second = Number(slash[2]);
  const year = Number(slash[3].length === 2 ? `20${slash[3]}` : slash[3]);
  if (!Number.isFinite(first) || !Number.isFinite(second) || !Number.isFinite(year)) return null;
  if (year < 1900 || year > 2200) return null;
  const month = first;
  const day = second;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatIsoDate(iso: string, format: DateFormatPattern): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const year = m[1];
  const month = m[2];
  const day = m[3];
  if (format === "YYYY-MM-DD") return `${year}-${month}-${day}`;
  if (format === "DD/MM/YYYY") return `${day}/${month}/${year}`;
  return `${month}/${day}/${year}`;
}

export function classifyField(input: FieldClassificationInput): FieldClassification {
  const defaultDateFormat = detectDateFormatFromHint(toText(input.dateTimeFormat));

  if (input.pdfKind === "checkbox") {
    return { type: "checkbox", dateFormat: null, signatureLike: false };
  }
  if (input.pdfKind === "radio") {
    return { type: "radio", dateFormat: null, signatureLike: false };
  }
  if (input.pdfKind === "dropdown") {
    return { type: "dropdown", dateFormat: null, signatureLike: false };
  }
  if (input.pdfKind === "signature") {
    return { type: "signature", dateFormat: null, signatureLike: true };
  }

  const dateFormat = defaultDateFormat || "MM/DD/YYYY";
  if (isStrictDateLabel(input.label, input.tooltip)) {
    return { type: "date", dateFormat, signatureLike: false };
  }

  const textSignals = `${input.label} ${toText(input.tooltip)}`;
  const defaultValueText = toText(input.defaultValue);

  if (EMAIL_KEYWORD_RE.test(textSignals) || EMAIL_RE.test(defaultValueText)) {
    return { type: "email", dateFormat: null, signatureLike: false };
  }
  if (PHONE_KEYWORD_RE.test(textSignals)) {
    return { type: "phone", dateFormat: null, signatureLike: false };
  }
  if (POSTAL_KEYWORD_RE.test(textSignals)) {
    return { type: "postal", dateFormat: null, signatureLike: false };
  }
  if (CURRENCY_KEYWORD_RE.test(textSignals) || /^\$?\s*-?\d+(?:\.\d{1,2})?$/.test(defaultValueText)) {
    return { type: "currency", dateFormat: null, signatureLike: false };
  }
  if (NUMBER_KEYWORD_RE.test(textSignals) || /^-?\d+(?:\.\d+)?$/.test(defaultValueText)) {
    return { type: "number", dateFormat: null, signatureLike: false };
  }
  if (input.multiLine || MULTILINE_KEYWORD_RE.test(textSignals)) {
    return { type: "multiline", dateFormat: null, signatureLike: false };
  }

  return { type: "text", dateFormat: null, signatureLike: false };
}
