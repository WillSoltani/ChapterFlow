/**
 * Regenerate `contract-manifest.json` from the live contract descriptors.
 *
 *   npx tsx src/contracts/generateManifest.ts
 *
 * Run ONLY as part of a deliberate, version-bumped contract change (plan §12):
 * regenerating to make the freeze test pass without a version bump defeats the
 * freeze — the test also fails when a hash changed but its version did not.
 */

import { writeFileSync } from "fs";

import { computeContractManifest, CONTRACT_MANIFEST_PATH, loadFrozenManifest } from "./index.js";

let frozenAtIso = new Date().toISOString();
let previousVersions = new Map<string, number>();
try {
  const prev = loadFrozenManifest();
  frozenAtIso = prev.frozenAtIso; // freeze timestamp is the ORIGINAL Phase-0 freeze, not the last edit
  previousVersions = new Map(prev.contracts.map((c) => [c.name, c.version]));
} catch { /* first generation */ }

const manifest = computeContractManifest(frozenAtIso);
for (const c of manifest.contracts) {
  const prevV = previousVersions.get(c.name);
  if (prevV !== undefined && prevV === c.version) continue;
  console.log(`contract ${c.name}: ${prevV === undefined ? "NEW" : `v${prevV} → v${c.version}`}`);
}
writeFileSync(CONTRACT_MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
console.log(`wrote ${CONTRACT_MANIFEST_PATH} (${manifest.contracts.length} contracts)`);
