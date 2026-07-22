import "../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { RecallBookRequestForm } from "./RecallBookRequestForm";

const realFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
});

test("RecallBookRequestForm validates, trims, submits, and confirms success", async () => {
  const requests: Array<{ input: string | URL | Request; init?: RequestInit | undefined }> = [];
  let successes = 0;
  globalThis.fetch = (async (input, init) => {
    requests.push({ input, init });
    return new Response(null, { status: 201 });
  }) as typeof fetch;

  const view = render(
    <RecallBookRequestForm onSuccess={() => {
      successes += 1;
    }} />,
  );
  const submit = view.getByRole("button", { name: "Request this book" });
  const title = view.getByRole("textbox", { name: /book title/i });
  const email = view.getByRole("textbox", { name: /your email/i });
  assert.equal((submit as HTMLButtonElement).disabled, false);

  fireEvent.click(submit);
  await waitFor(() => {
    assert.equal(document.activeElement, title);
    assert.equal(title.getAttribute("aria-invalid"), "true");
    assert.equal(email.getAttribute("aria-invalid"), "true");
    assert.match(
      view.getByRole("status").textContent ?? "",
      /correct the book title and email fields/i,
    );
  });
  assert.equal(requests.length, 0);

  fireEvent.change(title, {
    target: { value: "  Deep Work  " },
  });
  fireEvent.change(email, {
    target: { value: "  reader@example.com  " },
  });
  assert.equal((submit as HTMLButtonElement).disabled, false);

  fireEvent.click(submit);
  await waitFor(() => assert.ok(view.getByRole("status")));

  assert.equal(successes, 1);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.input, "/api/book-requests");
  assert.deepEqual(JSON.parse(String(requests[0]!.init?.body)), {
    title: "Deep Work",
    author: "",
    email: "reader@example.com",
    note: "",
    website: "",
    company: "",
  });
  assert.match(view.getByRole("status").textContent ?? "", /Request received/);
});

test("RecallBookRequestForm renders the rate-limit response", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  const view = render(
    <RecallBookRequestForm initialTitle="Deep Work" />,
  );
  fireEvent.change(view.getByRole("textbox", { name: /your email/i }), {
    target: { value: "reader@example.com" },
  });
  fireEvent.click(view.getByRole("button", { name: "Request this book" }));

  await waitFor(() => {
    assert.match(
      view.getByRole("alert").textContent ?? "",
      /sent a few requests recently/i,
    );
  });
});
