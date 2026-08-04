import { finishV25Tests } from "./harness.js";
import { registerWalkingSkeletonCases } from "./walkingSkeletonCases.js";

registerWalkingSkeletonCases();

finishV25Tests().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
