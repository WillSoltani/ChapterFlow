import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import {
  RecallBookRequestForm,
  validateRecallBookRequest,
} from "./RecallBookRequestForm";

const source = (relativePath: string) =>
  readFileSync(path.join(process.cwd(), relativePath), "utf8");

test("empty required fields expose both errors and choose title for focus", () => {
  assert.deepEqual(validateRecallBookRequest({ title: "", email: "" }), {
    errors: {
      title: "Please enter at least 2 characters for the book title.",
      email: "Please enter a valid email address.",
    },
    firstInvalid: "title",
  });
});

test("email is the focus target when the title is valid", () => {
  assert.deepEqual(
    validateRecallBookRequest({ title: "The Beginning of Infinity", email: "invalid" }),
    {
      errors: { email: "Please enter a valid email address." },
      firstInvalid: "email",
    },
  );
});

test("valid required values have no errors or focus target", () => {
  assert.deepEqual(
    validateRecallBookRequest({ title: "  Deep Work  ", email: " reader@example.com " }),
    { errors: {}, firstInvalid: null },
  );
});

test("the resting form keeps submit reachable and preserves privacy plus honeypots", () => {
  const html = renderToStaticMarkup(createElement(RecallBookRequestForm));
  const submitTag = html.match(/<button[^>]*type="submit"[^>]*>/)?.[0] ?? "";

  assert.match(html, /type="submit"/);
  assert.doesNotMatch(submitTag, /\sdisabled(?:=|\s|>)/);
  assert.match(html, /href="\/legal\/privacy"/);
  assert.match(html, /data-1p-ignore="true"/);
  assert.match(html, /data-lpignore="true"/);
  assert.match(html, /id="[^"]+-website"/);
  assert.match(html, /id="[^"]+-company"/);
});

test("blur and invalid-submit contracts reveal errors before focusing the first field", () => {
  const form = source("components/landing/recall/RecallBookRequestForm.tsx");

  assert.match(form, /onBlur=\{\(\) => handleRequiredBlur\("title"\)\}/);
  assert.match(form, /onBlur=\{\(\) => handleRequiredBlur\("email"\)\}/);
  assert.match(form, /setTouched\(\{ title: true, email: true \}\)/);
  assert.match(form, /setFocusField\(validation\.firstInvalid\)/);
  assert.match(form, /setFocusRequest\(\(current\) => current \+ 1\)/);
  assert.match(form, /focusField === "title" \? titleRef : emailRef/);
  assert.match(form, /input\.current\?\.focus\(\)/);
  assert.match(form, /disabled=\{status === "submitting"\}/);
});

test("field errors have stable ARIA relationships and a single validation announcer", () => {
  const form = source("components/landing/recall/RecallBookRequestForm.tsx");

  assert.match(form, /errorId=\{id\("title-err"\)\}/);
  assert.match(form, /errorId=\{id\("email-err"\)\}/);
  assert.match(form, /aria-invalid=\{invalid \|\| undefined\}/);
  assert.match(form, /aria-describedby=\{invalid && errorId \? errorId : undefined\}/);
  assert.match(form, /id=\{id\("validation-status"\)\}/);
  assert.match(form, /role="status"[\s\S]*aria-live="polite"[\s\S]*validationAnnouncement/);
  assert.equal((form.match(/role="alert"/g) ?? []).length, 1);
});

test("inline and dialog consumers retain the shared form and dialog focus trap", () => {
  const inline = source("components/landing/recall/RecallRequestSection.tsx");
  const dialog = source("components/landing/recall/RecallBookRequestDialog.tsx");

  assert.match(inline, /<RecallBookRequestForm\s*\/>/);
  assert.match(dialog, /<Dialog[\s\S]*<RecallBookRequestForm initialTitle=\{initialTitle\} \/>[\s\S]*<\/Dialog>/);
  assert.match(dialog, /labelledBy=\{titleId\}/);
});
