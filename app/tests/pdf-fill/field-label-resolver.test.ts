import test from "node:test";
import assert from "node:assert/strict";
import {
  cleanedFieldNameFallback,
  fieldLabelResolver,
} from "../../app/projects/[projectId]/fill/[fileId]/field-label-resolver";

test("fieldLabelResolver prefers tooltip first", () => {
  const label = fieldLabelResolver({
    fieldName: "form1[0].#subform[0].fname[0]",
    tooltip: "First name",
    annotationLabel: "Given name",
  });
  assert.equal(label, "First name");
});

test("fieldLabelResolver uses annotation label when tooltip missing", () => {
  const label = fieldLabelResolver({
    fieldName: "form1[0].#subform[0].lname[0]",
    annotationLabel: "Last name",
  });
  assert.equal(label, "Last name");
});

test("fieldLabelResolver cleans noisy XFA field names", () => {
  const label = cleanedFieldNameFallback("form1[0].#pageSet[0].#subform[2].fname[0]");
  assert.equal(label, "First");
});

test("fieldLabelResolver splits camelCase and maps tokens", () => {
  const label = cleanedFieldNameFallback("applicant_primaryPostalCode");
  assert.equal(label, "Applicant Primary Postal Code");
});

test("fieldLabelResolver returns stable fallback for empty names", () => {
  const label = cleanedFieldNameFallback("   ");
  assert.equal(label, "Field");
});
