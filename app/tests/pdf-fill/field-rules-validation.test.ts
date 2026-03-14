import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyField,
  formatIsoDate,
} from "../../app/projects/[projectId]/fill/[fileId]/field-type-rules";
import {
  normalizeValueForType,
  validateFieldValue,
} from "../../app/projects/[projectId]/fill/[fileId]/field-validation";

test("classifyField detects date fields by label", () => {
  const result = classifyField({
    pdfKind: "text",
    fieldName: "startDate",
    label: "Start date",
  });
  assert.equal(result.type, "date");
  assert.equal(result.dateFormat, "MM/DD/YYYY");
});

test("classifyField does not infer date from fieldName alone", () => {
  const result = classifyField({
    pdfKind: "text",
    fieldName: "startDate",
    label: "Start",
  });
  assert.equal(result.type, "text");
});

test("classifyField does not auto-detect signature-like text fields", () => {
  const result = classifyField({
    pdfKind: "text",
    fieldName: "sign_here",
    label: "Signature",
  });
  assert.equal(result.type, "text");
  assert.equal(result.signatureLike, false);
});

test("classifyField keeps checkbox/radio/dropdown types", () => {
  assert.equal(
    classifyField({ pdfKind: "checkbox", fieldName: "accept", label: "Accept" }).type,
    "checkbox"
  );
  assert.equal(
    classifyField({ pdfKind: "radio", fieldName: "gender", label: "Gender" }).type,
    "radio"
  );
  assert.equal(
    classifyField({ pdfKind: "dropdown", fieldName: "state", label: "State" }).type,
    "dropdown"
  );
});

test("validation returns required error and non-blocking warnings", () => {
  const required = validateFieldValue({
    label: "First name",
    type: "text",
    value: "",
    required: true,
  });
  assert.equal(required.length, 1);
  assert.equal(required[0].severity, "error");

  const warning = validateFieldValue({
    label: "Email",
    type: "email",
    value: "not-an-email",
    required: false,
  });
  assert.equal(warning.length, 1);
  assert.equal(warning[0].severity, "warning");
});

test("normalizers apply by field type", () => {
  assert.equal(normalizeValueForType("email", " USER@Example.COM "), "user@example.com");
  assert.equal(normalizeValueForType("postal", " h2x   1y4 "), "H2X 1Y4");
  assert.equal(normalizeValueForType("phone", "1234567890"), "(123) 456-7890");
});

test("formatIsoDate supports MM/DD/YYYY", () => {
  assert.equal(formatIsoDate("2026-03-08", "MM/DD/YYYY"), "03/08/2026");
});
