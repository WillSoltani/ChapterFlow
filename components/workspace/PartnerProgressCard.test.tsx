import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PartnerProgressCard } from "./PartnerProgressCard";

// ACCT-29: the invite is created on the server before the link is copied, so a
// clipboard failure (common on Safari after an await) must not report a failed
// invite.

const realFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
});

function mockServer() {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.endsWith("/me/pairs/invite")
      ? { inviteUrl: "https://chapterflow.test/pair/abc" }
      : { pair: null, partner: null };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

function mockClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(globalThis.navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

test("a clipboard failure after the invite is created still shows the invite", async () => {
  mockServer();
  mockClipboard(() => Promise.reject(new Error("NotAllowedError")));
  render(<PartnerProgressCard enabled />);
  fireEvent.click(await screen.findByText("Invite"));
  await screen.findByText("Invite Sent");
  assert.ok(screen.getByText("Share the link — expires in 7 days"));
  assert.equal(screen.queryByText(/Something went wrong/), null);
  assert.ok(screen.getByText("Copy Link"));
});

test("a working clipboard copies the new invite link", async () => {
  mockServer();
  const copied: string[] = [];
  mockClipboard(async (text) => {
    copied.push(text);
  });
  render(<PartnerProgressCard enabled />);
  fireEvent.click(await screen.findByText("Invite"));
  await screen.findByText("Invite Sent");
  await waitFor(() => assert.deepEqual(copied, ["https://chapterflow.test/pair/abc"]));
  assert.ok(screen.getByText("Copied!"));
});
