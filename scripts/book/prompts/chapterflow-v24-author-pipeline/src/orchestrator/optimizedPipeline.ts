import { LEGACY_ROUTE_DISABLED_CODE } from "../runtime/legacyRouteInventory.js";

type Flags = Record<string, string | boolean>;

/** Legacy ambient pipeline. V4 command/application services own execution. */
export async function runOptimizedPipeline(_args: string[], _flags: Flags): Promise<number> {
  console.error(`${LEGACY_ROUTE_DISABLED_CODE}:optimizedPipeline.runOptimizedPipeline`);
  return 2;
}
