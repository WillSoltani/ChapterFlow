import "../../../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
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

test("ACCT-16: the deactivate dialog says a web subscription stops renewing and access lasts to the period end", async () => {
  const view = render(<DangerZone onDeactivate={async () => {}} onDelete={async () => {}} />);
  fireEvent.click(view.getByRole("button", { name: /Deactivate account/ }));
  const dialog = await waitFor(() => view.getByRole("dialog"));
  const text = dialog.textContent ?? "";
  assert.match(text, /subscription will stop renewing/);
  assert.match(text, /until the end of the period/);
});

test("ACCT-15: a failed deactivate keeps the dialog open with its error", async () => {
  const view = render(
    <DangerZone
      onDeactivate={async () => {
        throw new Error("failed");
      }}
      onDelete={async () => {}}
    />,
  );
  fireEvent.click(view.getByRole("button", { name: /Deactivate account/ }));
  const dialog = await waitFor(() => view.getByRole("dialog"));
  fireEvent.click(within(dialog).getByRole("button", { name: /^Deactivate$/ }));
  await waitFor(() => assert.match(within(dialog).getByRole("alert").textContent ?? "", /couldn't deactivate/));
  assert.ok(view.getByRole("dialog"), "the dialog is still open");
});
