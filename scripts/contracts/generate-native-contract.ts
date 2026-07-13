import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  buildNativeContractBundle,
  parseNativeContractProvenanceEnvironment,
  serializeNativeContractBundle,
} from "../../app/app/api/book/_contracts/native-contract-generator-core";
import { nativeContractOperationDefinitions } from "../../app/app/api/book/_contracts/native-contract-registry";

const repoRoot = process.cwd();
const outputPath = resolve(repoRoot, "contracts/native-ios/v1/contract-bundle.json");
const check = process.argv.includes("--check");
const provenanceOptions = parseNativeContractProvenanceEnvironment(process.env);

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
