import { focusArrived } from "./scrub";

/**
 * Remembers the element whose keyboard focus last moved the film (any
 * chapter, FilmSegment), so focus coming BACK to it when the window or tab
 * regains focus (the browser fires focus on it again, with no relatedTarget)
 * does not scroll the page back to it: the reader may have scrolled on.
 *
 * The guard is cleared only when focus really leaves that element inside the
 * page (focusout, and afterwards the document's active element is another
 * one: Tab, a click elsewhere, a script). The window losing focus also fires
 * focusout, but the element stays the active element, so the guard holds. A
 * pointer press alone never clears it: a touch scroll fires pointerdown
 * without moving focus, and on a device with both a keyboard and touch that
 * cleared guard made the page jump back to the focused film control when the
 * tab regained focus.
 *
 * `defer` runs the check after the focus change has settled (setTimeout 0 in
 * the page; tests flush it by hand).
 */
export function createFocusGuard(doc: Document, defer: (fn: () => void) => void) {
  let last: Element | null = null;
  const onFocusOut = (e: Event) => {
    const left = e.target;
    if (left !== last) return;
    defer(() => {
      if (last === left && doc.activeElement !== left) last = null;
    });
  };
  doc.addEventListener("focusout", onFocusOut, true);
  return {
    /** Keyboard focus that arrived at `target` (scrub.ts focusArrived). */
    arrived: (target: Element, related: EventTarget | null) => focusArrived(target, related, last),
    remember: (el: Element) => {
      last = el;
    },
    dispose: () => doc.removeEventListener("focusout", onFocusOut, true),
  };
}

let shared: ReturnType<typeof createFocusGuard> | null = null;

/** The page's one guard, shared by every chapter (created on first use). */
export function focusGuard(): ReturnType<typeof createFocusGuard> {
  shared ??= createFocusGuard(document, (fn) => window.setTimeout(fn, 0));
  return shared;
}
