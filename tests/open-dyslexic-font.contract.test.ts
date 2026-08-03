import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

const root = process.cwd();
const readText = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

test("OpenDyslexic is self-hosted with valid WOFF2 assets and its license", () => {
  const css = readText("app/globals.css");
  const preferences = readText("app/book/hooks/useBookPreferences.ts");
  const license = readText("public/fonts/OpenDyslexic-LICENSE.txt");

  assert.match(
    css,
    /url\("\/fonts\/OpenDyslexic-Regular\.woff2"\) format\("woff2"\)/,
  );
  assert.match(
    css,
    /url\("\/fonts\/OpenDyslexic-Bold\.woff2"\) format\("woff2"\)/,
  );
  assert.doesNotMatch(css, /cdn\.jsdelivr\.net\/npm\/open-dyslexic/i);
  assert.match(preferences, /"opendyslexic": '"OpenDyslexic", sans-serif'/);

  for (const file of [
    "OpenDyslexic-Regular.woff2",
    "OpenDyslexic-Bold.woff2",
  ]) {
    const relativePath = path.join("public/fonts", file);
    const bytes = readFileSync(path.join(root, relativePath));
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "wOF2");
    assert.ok(statSync(path.join(root, relativePath)).size > 30_000);
  }

  assert.match(license, /open-dyslexic@1\.0\.3/);
  assert.match(license, /Permission is hereby granted, free of charge/);
});
