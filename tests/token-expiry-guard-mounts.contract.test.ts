import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

// SHELL-14: TokenExpiryGuard is the only client that renews a session while a
// page stays open. Every signed-in surface must mount it, including /rewards
// and /onboarding, which sit outside the /book and /dashboard layouts.

const SIGNED_IN_SURFACES = [
  "app/book/layout.tsx",
  "app/dashboard/layout.tsx",
  "app/rewards/page.tsx",
  "app/onboarding/page.tsx",
];

for (const file of SIGNED_IN_SURFACES) {
  test(`${file} mounts TokenExpiryGuard`, () => {
    const source = readFileSync(path.join(process.cwd(), file), "utf8");
    assert.match(source, /import \{ TokenExpiryGuard \} from "@\/components\/auth\/TokenExpiryGuard"/);
    assert.match(source, /<TokenExpiryGuard \/>/);
  });
}
