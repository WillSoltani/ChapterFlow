"use client";

// Re-export shim — all logic moved to useInsightPoints.ts
// This file exists to prevent breaking existing imports during migration.

export { useInsightPoints as useFlowPoints } from "./useInsightPoints";
export type { InsightPointsPayload as FlowPointsPayload } from "./useInsightPoints";
export { useInsightPoints, type InsightPointsPayload } from "./useInsightPoints";
