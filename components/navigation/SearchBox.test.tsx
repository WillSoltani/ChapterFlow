import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, render } from "@testing-library/react";
import { SearchBox } from "./SearchBox";

afterEach(cleanup);

test("the placeholder is device-neutral and the / hint only appears from md up", () => {
  const view = render(<SearchBox value="" onChange={() => {}} />);
  const input = view.getByRole("combobox");
  assert.equal(input.getAttribute("placeholder"), "Search books");

  const hint = view.container.querySelector("kbd");
  assert.ok(hint);
  assert.equal(hint.textContent, "/");
  // Hidden by default (phones), shown at md and wider.
  assert.match(hint.className, /(^|\s)hidden(\s|$)/);
  assert.match(hint.className, /md:inline-flex/);
});

test("the hint goes away once there is a query", () => {
  const view = render(<SearchBox value="habits" onChange={() => {}} />);
  assert.equal(view.container.querySelector("kbd"), null);
});
