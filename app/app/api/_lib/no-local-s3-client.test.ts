import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
test("no empty-config S3Client outside _lib/aws.ts", () => {
  // Pattern is built via concatenation (not a contiguous literal) so this
  // guard test's own source doesn't match its own grep pattern.
  const pattern = "new S3Client(" + "{}" + ")";
  let out = "";
  try { out = execFileSync("grep", ["-rn", pattern, "app/"], { encoding: "utf8" }); }
  catch { /* grep exits 1 on zero matches */ }
  assert.equal(out.trim(), "", `empty-config S3Client found:\n${out}`);
});
