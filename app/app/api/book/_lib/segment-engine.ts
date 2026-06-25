import "server-only";

// The predicate evaluation lives in segment-engine-core.ts (no `server-only`
// import) so its filter semantics can be unit-tested. This module is the
// `server-only` entry point route handlers import from; behavior is unchanged.
export type {
  SegmentFilterField,
  SegmentFilterOperator,
  SegmentFilter,
  SegmentDefinition,
  SegmentUser,
} from "./segment-engine-core";

export { matchesSegment, runSegment } from "./segment-engine-core";
