import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { test } from "node:test";
import { createFocusGuard } from "./focus-guard";

/** A guard on the jsdom document whose deferred checks run when `flush` is called. */
function setup() {
  document.body.innerHTML = '<a id="a" href="#a">a</a><a id="b" href="#b">b</a><p id="p">text</p>';
  const a = document.getElementById("a")!;
  const b = document.getElementById("b")!;
  const queue: Array<() => void> = [];
  const guard = createFocusGuard(document, (fn) => queue.push(fn));
  const flush = () => {
    while (queue.length) queue.shift()!();
  };
  return { a, b, guard, flush };
}

test("the window regaining focus on the element that moved the film is not focus that arrived", () => {
  const { a, guard, flush } = setup();
  a.focus();
  assert.equal(guard.arrived(a, null), true, "first keyboard focus");
  guard.remember(a);
  // The tab loses focus: blur / focusout on a, but a stays the document's active element.
  a.dispatchEvent(new window.FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
  flush();
  assert.equal(guard.arrived(a, null), false, "focus restored on a with the window");
  guard.dispose();
});

test("a pointer press that does not move focus (a touch scroll) keeps the guard", () => {
  const { a, guard, flush } = setup();
  a.focus();
  guard.remember(a);
  // A touch scroll on a hybrid device: pointerdown on the page, focus stays on a.
  document.getElementById("p")!.dispatchEvent(new window.Event("pointerdown", { bubbles: true }));
  window.dispatchEvent(new window.Event("pointerdown"));
  flush();
  assert.equal(document.activeElement, a);
  assert.equal(guard.arrived(a, null), false, "the window regaining focus after a touch scroll does not move the page");
  guard.dispose();
});

test("focus that really left the element clears the guard: the next keyboard focus on it is new", () => {
  const { a, guard, flush } = setup();
  a.focus();
  guard.remember(a);
  // A click on plain text: focus goes to the body.
  a.blur();
  flush();
  assert.notEqual(document.activeElement, a);
  assert.equal(guard.arrived(a, null), true, "back on a after focus left it");
  guard.dispose();
});

test("focus moving to another element: the new one is remembered, the old one is new again", () => {
  const { a, b, guard, flush } = setup();
  a.focus();
  guard.remember(a);
  b.focus();
  assert.equal(guard.arrived(b, a), true, "Tab from a");
  guard.remember(b);
  flush();
  assert.equal(guard.arrived(b, null), false, "window focus restored on b");
  assert.equal(guard.arrived(a, null), true, "a is not the remembered element");
  assert.equal(guard.arrived(a, b), true, "Shift+Tab back to a");
  guard.dispose();
});
