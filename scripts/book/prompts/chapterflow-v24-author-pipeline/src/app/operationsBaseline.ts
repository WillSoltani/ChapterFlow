export const BASELINE_UNAVAILABLE = "UNAVAILABLE" as const;
export type BaselineValue<T> = T | typeof BASELINE_UNAVAILABLE;

export type OperationsBaselineInput = Readonly<{
  versions: Readonly<Record<string, BaselineValue<string>>>;
  environment: Readonly<Record<string, BaselineValue<string>>>;
  fileCounts: Readonly<Record<string, BaselineValue<number>>>;
  caseCounts: Readonly<Record<string, BaselineValue<number>>>;
  durationsMs: Readonly<Record<string, BaselineValue<number>>>;
  routeCounts: Readonly<Record<string, BaselineValue<number>>>;
}>;

export type OperationsBaseline = Readonly<{
  schemaVersion: "1";
  versions: Readonly<Record<string, BaselineValue<string>>>;
  environment: Readonly<Record<string, BaselineValue<string>>>;
  fileCounts: Readonly<Record<string, BaselineValue<number>>>;
  caseCounts: Readonly<Record<string, BaselineValue<number>>>;
  durationsMs: Readonly<Record<string, BaselineValue<number>>>;
  routeCounts: Readonly<Record<string, BaselineValue<number>>>;
}>;

/** Descriptive copy only. Missing measurements never bless or block qualification. */
export function operationsBaseline(input: OperationsBaselineInput): OperationsBaseline {
  return {
    schemaVersion: "1",
    versions: { ...input.versions },
    environment: { ...input.environment },
    fileCounts: { ...input.fileCounts },
    caseCounts: { ...input.caseCounts },
    durationsMs: { ...input.durationsMs },
    routeCounts: { ...input.routeCounts },
  };
}
