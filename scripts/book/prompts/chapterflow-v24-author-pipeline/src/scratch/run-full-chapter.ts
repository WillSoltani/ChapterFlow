import { legacyRouteDisabled } from "../runtime/legacyRouteInventory.js";

/** Legacy scratch writer. Compiler application port owns authoring. */
export async function main(): Promise<never> {
  throw legacyRouteDisabled("scratch.runFullChapter");
}

const isDirectInvocation = process.argv[1]?.endsWith("run-full-chapter.ts")
  || process.argv[1]?.endsWith("run-full-chapter.js");

if (isDirectInvocation) {
  main().catch((error) => {
    console.error((error as Error).message);
    process.exitCode = 2;
  });
}
