// repo.ts — stable re-export shim (WS3-004).
//
// The data-access code that used to live here was split into focused per-entity
// *-repo.ts modules (see below). This file re-exports every original public name
// so both `@/app/app/api/book/_lib/repo` and `./repo` importers keep working
// unchanged. Internal helpers now live in repo-shared.ts and are intentionally
// NOT re-exported here.

export * from "./book-catalog-repo";
export * from "./ingestion-repo";
export * from "./entitlement-repo";
export * from "./billing-repo";
export * from "./progress-repo";
export * from "./quiz-state-repo";
export * from "./loop-repo";
export * from "./book-metrics-repo";
export * from "./scenario-repo";
export * from "./email-suppression-repo";
export * from "./user-profile-repo";
export * from "./account-repo";
export * from "./user-settings-repo";
export * from "./book-state-repo";
export * from "./saved-books-repo";
export * from "./license-repo";
