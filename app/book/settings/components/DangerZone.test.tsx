import "../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { DangerZone } from "./DangerZone";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
});

test("ACCT-07: the delete dialog says what happens to billing, including App Store subscriptions", async () => {
  const view = render(<DangerZone onDeactivate={async () => {}} onDelete={async () => {}} />);
  fireEvent.click(view.getByRole("button", { name: /Delete account/ }));

  const dialog = await waitFor(() => view.getByRole("dialog"));
  const text = dialog.textContent ?? "";
  assert.match(text, /subscription/i);
  assert.match(text, /App Store/);
});
