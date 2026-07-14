import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildNativeContractBundle,
  parseNativeContractProvenanceEnvironment,
  serializeNativeContractBundle,
} from "../../app/app/api/book/_contracts/native-contract-generator-core";
import { nativeContractOperationDefinitions } from "../../app/app/api/book/_contracts/native-contract-registry";

const repoRoot = process.cwd();
const canonicalOutputPath = resolve(repoRoot, "contracts/native-ios/v1/contract-bundle.json");
const check = process.argv.includes("--check");
const provenanceOptions = parseNativeContractProvenanceEnvironment(process.env);
const outputArgumentIndex = process.argv.indexOf("--output");
const outputArgument =
  outputArgumentIndex === -1 ? undefined : process.argv[outputArgumentIndex + 1]?.trim();
if (outputArgumentIndex !== -1 && !outputArgument) {
  throw new Error("--output requires a path");
}
const outputEnvironment = process.env.CONTRACT_OUTPUT_PATH?.trim() || undefined;
if (outputArgument && outputEnvironment && outputArgument !== outputEnvironment) {
  throw new Error("--output and CONTRACT_OUTPUT_PATH disagree");
}
const explicitOutput = outputArgument ?? outputEnvironment;
const outputPath = explicitOutput ? resolve(repoRoot, explicitOutput) : canonicalOutputPath;
if (check && explicitOutput) {
  throw new Error("--check validates only the canonical checked-in bundle");
}
if (provenanceOptions && !explicitOutput) {
  throw new Error("committed provenance generation requires an explicit temporary --output path");
}
if (provenanceOptions && outputPath === canonicalOutputPath) {
  throw new Error("committed provenance overlay must not overwrite the canonical backend bundle");
}

const bundle = buildNativeContractBundle(
  repoRoot,
  nativeContractOperationDefinitions,
  provenanceOptions
);
const serialized = serializeNativeContractBundle(bundle);

if (check) {
  if (!existsSync(outputPath)) {
    throw new Error(`native contract bundle is missing: ${outputPath}`);
  }
  const existing = readFileSync(outputPath, "utf8");
  if (existing !== serialized) {
    throw new Error(
      "native contract bundle drifted; run npm run contract:native:generate and review the diff"
    );
  }
  console.log(`native contract bundle is current (${bundle.operations.length} operations)`);
} else {
  writeFileSync(outputPath, serialized, "utf8");
  console.log(`wrote ${outputPath} (${bundle.operations.length} operations)`);
}
