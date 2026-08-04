import type { ExampleOutput } from "../agents/writer-example.js";
import type { BookBrief, ChapterDesignDoc } from "../types.js";
import { legacyRouteDisabled } from "../runtime/legacyRouteInventory.js";

export type CurateResult = {
  winnerIndex: number;
  reason: string;
  scoreSheet: Array<{
    index: number;
    namedProtagonist: boolean;
    specificScene: boolean;
    hitsRequiredBeat: boolean;
    voiceMatch: boolean;
    standoutDetail: boolean;
    score: number;
    note?: string;
  }>;
  needsRegeneration?: boolean;
};

export type CurateInput = {
  brief: BookBrief;
  plan: ChapterDesignDoc;
  spec: ChapterDesignDoc["exampleSpecs"][number];
  candidates: ExampleOutput[];
};

/** Legacy direct curator. Compiler application port owns authoring. */
export async function runExampleCurator(_input: CurateInput): Promise<CurateResult> {
  throw legacyRouteDisabled("curator.runExampleCurator");
}
