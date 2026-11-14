import "../../../../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { useState } from "react";
import { cleanup, fireEvent, render, renderHook, waitFor } from "@testing-library/react";
import { invalidateBookCache } from "@/lib/client/book-api-cache";
import { ENTITLEMENTS_KEY } from "@/lib/client/book-read-keys";
import { UPGRADE_RETURN_PATH } from "@/lib/pricing";
import { useReaderPlan } from "../hooks/useReaderPlan";
import { AudioPlayer } from "./AudioPlayer";

// next/link's idle-callback fallback reads `self`, which jsdom globals omit.
Object.defineProperty(globalThis, "self", { configurable: true, writable: true, value: globalThis });

const realFetch = globalThis.fetch;
let requested: string[] = [];

function stubFetch(respond: (url: string) => Promise<Response> | Response) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requested.push(url);
    return respond(url);
  }) as typeof fetch;
}

function errorResponse(status: number, code: string, message = "server text") {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const media = window.HTMLMediaElement.prototype as unknown as Record<string, unknown>;
const realMedia = { play: media.play, pause: media.pause, load: media.load };

beforeEach(() => {
  media.play = () => Promise.resolve();
  media.pause = () => {};
  media.load = () => {};
});

afterEach(() => {
  cleanup();
  globalThis.fetch = realFetch;
  requested = [];
  Object.assign(media, realMedia);
  invalidateBookCache(ENTITLEMENTS_KEY);
});

function Host({ plan }: { plan?: "FREE" | "PRO" | null | undefined }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.currentTarget.focus();
          setOpen((value) => !value);
        }}
      >
        Listen
      </button>
      <AudioPlayer
        layout="inline"
        open={open}
        onOpenChange={setOpen}
        bookId="atomic-habits"
        chapterNumber={4}
        chapterTitle="Chapter 4"
        tone="gentle"
        variant="easy"
        plan={plan}
      />
    </>
  );
}

function openRow(plan?: "FREE" | "PRO" | null) {
  const view = render(<Host plan={plan} />);
  fireEvent.click(view.getByRole("button", { name: "Listen" }));
  return view;
}

test("a free reader sees the Pro offer, focused, and no audio is requested", async () => {
  stubFetch(() => new Response(new ArrayBuffer(8), { status: 200 }));
  const view = openRow("FREE");
  assert.ok(view.getByText("Listening is part of Pro"));
  const link = view.getByRole("link", { name: "Upgrade to Pro" });
  assert.equal(link.getAttribute("href"), UPGRADE_RETURN_PATH);
  await waitFor(() => assert.equal(document.activeElement, link));
  assert.deepEqual(requested, []);
});

test("opening focuses Play while audio loads; closing returns focus to Listen", async () => {
  stubFetch(() => new Promise<Response>(() => {}));
  const view = openRow("PRO");
  const play = await view.findByRole("button", { name: "Preparing audio" });
  await waitFor(() => assert.equal(document.activeElement, play));
  assert.ok(view.getByText("Preparing…"));
  assert.equal(requested.length, 1);
  fireEvent.click(view.getByRole("button", { name: "Stop and close audio" }));
  assert.equal(view.queryByRole("group", { name: "Chapter audio" }), null);
  assert.equal(document.activeElement, view.getByRole("button", { name: "Listen" }));
});

test("an unknown plan keeps today's behaviour: the audio is requested", async () => {
  stubFetch(() => new Promise<Response>(() => {}));
  const view = openRow(null);
  await view.findByRole("button", { name: "Preparing audio" });
  assert.equal(requested.length, 1);
});

test("a pro_required answer shows the Pro offer, not an error", async () => {
  stubFetch(() => errorResponse(403, "pro_required", "Audio mode requires a Pro subscription"));
  const view = openRow(undefined);
  await view.findByText("Listening is part of Pro");
  assert.equal(view.queryByText(/requires a Pro subscription/), null);
  assert.equal(view.queryByRole("button", { name: "Try again" }), null);
});

test("the daily limit for new chapter audio says so and offers no retry", async () => {
  // The audio GET's own 429 rate_limited is the per-day cap on new audio, so
  // "wait a minute" would be wrong: every retry fails until tomorrow.
  stubFetch(() => errorResponse(429, "rate_limited"));
  const view = openRow("PRO");
  await view.findByText("You've reached today's limit for new chapter audio. Try again tomorrow.");
  assert.equal(view.queryByRole("button", { name: "Try again" }), null);
});

test("a 429 with no code says so in plain words and offers a retry", async () => {
  stubFetch(() => new Response("slow down", { status: 429 }));
  const view = openRow("PRO");
  await view.findByText("Too many audio requests. Wait a minute, then try again.");
  fireEvent.click(view.getByRole("button", { name: "Try again" }));
  await waitFor(() => assert.equal(requested.length, 2));
});

test("audio codes map to plain copy; dead ends offer no retry", async () => {
  const cases: Array<[number, string, string, boolean]> = [
    [503, "tts_unavailable", "Audio for this chapter isn't ready yet.", true],
    [404, "no_audio", "This chapter has no audio yet.", false],
    [404, "book_not_found", "This chapter has no audio yet.", false],
    [403, "chapter_locked", "Audio opens once this chapter is unlocked.", false],
    [403, "book_not_started", "Audio opens once this chapter is unlocked.", false],
    [500, "internal_error", "Audio couldn't load. Try again.", true],
  ];
  for (const [status, code, copy, retry] of cases) {
    stubFetch(() => errorResponse(status, code));
    const view = openRow("PRO");
    await view.findByText(copy);
    assert.equal(view.queryByText("server text"), null, code);
    assert.equal(Boolean(view.queryByRole("button", { name: "Try again" })), retry, code);
    cleanup();
  }
});

test("a network failure says so and offers a retry", async () => {
  stubFetch(() => Promise.reject(new TypeError("offline")));
  const view = openRow("PRO");
  await view.findByText("Audio couldn't load. Check your connection and try again.");
  assert.ok(view.getByRole("button", { name: "Try again" }));
});

test("the row shows playing and paused", async () => {
  const realCreate = URL.createObjectURL;
  URL.createObjectURL = () => "blob:audio";
  try {
    stubFetch(() => new Response(new ArrayBuffer(8), { status: 200 }));
    const view = openRow("PRO");
    const audio = view.container.querySelector("audio");
    assert.ok(audio);
    await waitFor(() => assert.equal(audio.getAttribute("src"), "blob:audio"));
    fireEvent(audio, new window.Event("canplay"));
    fireEvent(audio, new window.Event("play"));
    assert.ok(await view.findByRole("button", { name: "Pause" }));
    fireEvent(audio, new window.Event("pause"));
    assert.ok(await view.findByRole("button", { name: "Play" }));
  } finally {
    URL.createObjectURL = realCreate;
  }
});

test("useReaderPlan reads the plan from the entitlements cache; a failed read stays unknown", async () => {
  stubFetch(() => errorResponse(500, "internal_error"));
  const failed = renderHook(() => useReaderPlan());
  await waitFor(() => assert.equal(requested.length, 1));
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(failed.result.current, null);
  failed.unmount();

  invalidateBookCache(ENTITLEMENTS_KEY);
  stubFetch(
    () =>
      new Response(JSON.stringify({ entitlement: { plan: "FREE" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  const free = renderHook(() => useReaderPlan());
  await waitFor(() => assert.equal(free.result.current, "FREE"));
});
