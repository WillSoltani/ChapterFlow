import "../../tests/_lib/dom";

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { useState } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { Button } from "./button";

afterEach(cleanup);

test("Button forwards interaction and native disabled behavior", () => {
  function Counter() {
    const [count, setCount] = useState(0);
    return (
      <Button onClick={() => setCount((value) => value + 1)}>
        Count {count}
      </Button>
    );
  }

  const view = render(<Counter />);
  fireEvent.click(view.getByRole("button", { name: "Count 0" }));
  assert.ok(view.getByRole("button", { name: "Count 1" }));

  view.rerender(<Button disabled onClick={() => assert.fail("disabled click fired")}>Disabled</Button>);
  const disabled = view.getByRole("button", { name: "Disabled" });
  fireEvent.click(disabled);
  assert.equal((disabled as HTMLButtonElement).disabled, true);
});
