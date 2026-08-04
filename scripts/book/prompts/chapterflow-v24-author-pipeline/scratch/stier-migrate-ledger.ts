import { loadAuthorRegenLedger, migrateLegacyRegenCounts } from "../src/orchestrator/authorRegenLedger.js";
console.log("BEFORE:", JSON.stringify(loadAuthorRegenLedger("execution").legacyConsumed ?? {}, null, 0));
const after = migrateLegacyRegenCounts("execution", undefined, (m) => console.log(m));
console.log("AFTER consumed:", JSON.stringify(after.consumed));
console.log("migratedTo:", JSON.stringify(after.legacyMigratedTo));
console.log("legacy preserved:", JSON.stringify(after.legacyConsumed));
