#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import {
  parseIamArtifactConfig,
  renderIamArtifacts,
} from "../lib/iam-config-generator";

function resolveOutputDirectory(args: string[]): string {
  if (args.length === 0) return path.resolve(process.cwd(), "iam/generated");
  if (args.length === 2 && args[0] === "--output-dir" && args[1].trim()) {
    return path.resolve(args[1]);
  }
  throw new Error("usage: generate-iam-config [--output-dir <directory>]");
}

function writeValidatedJson(filePath: string, contents: string): void {
  JSON.parse(contents);
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, contents, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(temporary, filePath);
}

export function main(
  env: Record<string, string | undefined> = process.env,
  args: string[] = process.argv.slice(2),
): void {
  const outputDirectory = resolveOutputDirectory(args);
  const rendered = renderIamArtifacts(parseIamArtifactConfig(env));
  fs.mkdirSync(outputDirectory, { recursive: true });
  writeValidatedJson(
    path.join(outputDirectory, "trust.json"),
    rendered.trustJson,
  );
  writeValidatedJson(
    path.join(outputDirectory, rendered.additivePolicyFile),
    rendered.additivePolicyJson,
  );
  console.log("Generated and validated IAM trust and additive-policy JSON.");
}

if (require.main === module) {
  main();
}
