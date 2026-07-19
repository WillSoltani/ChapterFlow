import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { after, afterEach, test } from "node:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { BookRequestForm, validateBookRequest } from "./BookRequestForm";
import { BookRequestSuccess } from "./BookRequestSuccess";

const originalFetch = globalThis.fetch;
const originalSelf = Object.getOwnPropertyDescriptor(globalThis, "self");

Object.defineProperty(globalThis, "self", {
  configurable: true,
  writable: true,
  value: window,
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  globalThis.fetch = originalFetch;
});

after(() => {
  if (originalSelf) Object.defineProperty(globalThis, "self", originalSelf);
  else Reflect.deleteProperty(globalThis, "self");
});

test("book request validation identifies the first invalid required field", () => {
  assert.deepEqual(validateBookRequest("", ""), {
    errors: {
      title: "Enter a book title",
      email: "Enter your email address",
    },
    firstInvalid: "title",
  });
  assert.deepEqual(validateBookRequest("Deep Work", "reader@example.com"), {
    errors: {},
    firstInvalid: null,
  });
});

test("invalid submit reveals required errors, announces them, and focuses the first field", async () => {
  const view = render(<BookRequestForm onSuccess={() => {}} />);
  const title = view.getByRole("textbox", { name: /Book title/ });
  const email = view.getByRole("textbox", { name: /Your email/ });
  const submit = view.getByRole("button", { name: /^Request this book/ });

  assert.equal((title as HTMLInputElement).required, true);
  assert.equal((email as HTMLInputElement).required, true);
  assert.equal((submit as HTMLButtonElement).disabled, false);
  assert.match(view.getByText(/Required fields are marked/).textContent ?? "", /asterisk/);

  fireEvent.click(submit);

  await waitFor(() => {
    assert.equal(document.activeElement, title);
    assert.equal(title.getAttribute("aria-invalid"), "true");
    assert.equal(email.getAttribute("aria-invalid"), "true");
    assert.match(view.getByRole("status").textContent ?? "", /book title and email/i);
  });
  assert.match(title.getAttribute("aria-describedby") ?? "", /book-request-title-error/);
  assert.match(email.getAttribute("aria-describedby") ?? "", /book-request-email-error/);
});

test("valid submit remains available, trims the payload, and invokes success", async () => {
  const payloads: unknown[] = [];
  let successes = 0;
  globalThis.fetch = (async (_input, init) => {
    payloads.push(JSON.parse(String(init?.body)));
    return new Response(null, { status: 201 });
  }) as typeof fetch;

  const view = render(
    <BookRequestForm onSuccess={() => { successes += 1; }} />,
  );
  fireEvent.change(view.getByRole("textbox", { name: /Book title/ }), {
    target: { value: "  Deep Work  " },
  });
  fireEvent.change(view.getByRole("textbox", { name: /Your email/ }), {
    target: { value: "  reader@example.com  " },
  });
  fireEvent.click(view.getByRole("button", { name: /^Request this book/ }));

  await waitFor(() => assert.equal(successes, 1));
  assert.deepEqual(payloads, [{
    title: "Deep Work",
    author: "",
    email: "reader@example.com",
  }]);
});

test("request success is inserted as an atomic polite status", () => {
  const view = render(
    <BookRequestSuccess
      title="Deep Work"
      author="Cal Newport"
      email="reader@example.com"
    />,
  );
  const status = view.getByRole("status");
  assert.equal(status.getAttribute("aria-live"), "polite");
  assert.equal(status.getAttribute("aria-atomic"), "true");
  assert.match(status.textContent ?? "", /Request received/);
  assert.match(status.textContent ?? "", /reader@example.com/);
});
