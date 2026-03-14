export type FieldLabelInput = {
  fieldName: string;
  tooltip?: string | null;
  annotationLabel?: string | null;
};

const TOKEN_LABEL_MAP: Record<string, string> = {
  fname: "First",
  firstname: "First",
  lname: "Last",
  lastname: "Last",
  mname: "Middle",
  mi: "Middle",
  dob: "Date Of Birth",
  addr: "Address",
  tel: "Phone",
  zip: "ZIP",
  zipcode: "ZIP",
  ssn: "SSN",
  ein: "EIN",
  id: "ID",
  no: "Number",
  num: "Number",
  qty: "Quantity",
};

const XFA_NOISE_SEGMENT = /^#?(?:subform|pageset|pagearea|page|section|field|area)$/i;

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeCandidate(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = normalizeSpaces(
    value
      .replace(/[\r\n\t]+/g, " ")
      .replace(/^[^A-Za-z0-9]+/, "")
      .replace(/[^A-Za-z0-9)\]]+$/g, "")
  );
  return cleaned || null;
}

function splitCamelSnake(value: string): string[] {
  const expanded = value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/[./]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return expanded ? expanded.split(" ") : [];
}

function cleanFieldName(rawFieldName: string): string {
  const trimmed = rawFieldName.trim();
  if (!trimmed) return "Field";

  const rawSegments = trimmed
    .split(".")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const keptSegments = rawSegments
    .map((segment) => segment.replace(/\[\d+\]/g, "").replace(/^#/, ""))
    .filter((segment) => {
      if (!segment) return false;
      if (/^form\d*$/i.test(segment)) return false;
      if (XFA_NOISE_SEGMENT.test(segment)) return false;
      return true;
    });

  const source = keptSegments.length > 0 ? keptSegments.slice(-2).join(" ") : trimmed;
  const rawTokens = splitCamelSnake(
    source
      .replace(/\[\d+\]/g, " ")
      .replace(/#(?:subform|pageSet|pageArea|page|section|field|area)/gi, " ")
  );

  if (rawTokens.length === 0) return "Field";

  const normalizedTokens = rawTokens
    .map((token) => token.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);

  if (normalizedTokens.length === 0) return "Field";

  const mappedTokens = normalizedTokens.map((token) => {
    const lower = token.toLowerCase();
    const mapped = TOKEN_LABEL_MAP[lower];
    if (mapped) return mapped;
    if (lower === "name") return "Name";
    if (lower === "of") return "Of";
    return token[0].toUpperCase() + token.slice(1).toLowerCase();
  });

  // Common pair folding: First + Name, Last + Name, Middle + Name.
  const folded: string[] = [];
  for (let i = 0; i < mappedTokens.length; i += 1) {
    const token = mappedTokens[i];
    const next = mappedTokens[i + 1];
    if (
      next === "Name" &&
      (token === "First" || token === "Last" || token === "Middle")
    ) {
      folded.push(`${token} Name`);
      i += 1;
      continue;
    }
    folded.push(token);
  }

  return normalizeSpaces(folded.join(" ")) || "Field";
}

export function fieldLabelResolver(input: FieldLabelInput): string {
  const tooltip = normalizeCandidate(input.tooltip);
  if (tooltip) return tooltip;

  const annotationLabel = normalizeCandidate(input.annotationLabel);
  if (annotationLabel) return annotationLabel;

  return cleanFieldName(input.fieldName);
}

export function cleanedFieldNameFallback(fieldName: string): string {
  return cleanFieldName(fieldName);
}
