// Re-export shim (WS3-007): the catalog definition and its backing JSON now
// live in lib/books-catalog.ts, since lib/ is the shared base layer and
// lib/catalog-stats.ts needs the catalog without reaching upward into app/.
// This path is kept alive because many app/ and components/ call sites still
// import from it directly — do not delete without repointing every importer.
export * from "@/lib/books-catalog";
