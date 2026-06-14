/**
 * Single source of truth for the legal entity behind ChapterFlow, referenced by
 * the Terms, Privacy, Refund, Copyright, Contact, and Data-Rights pages and the
 * signup consent flow. Centralized so entity/jurisdiction changes happen once.
 *
 * Client-safe (no server-only imports).
 */

/** Registered legal entity that operates ChapterFlow. */
export const LEGAL_ENTITY_NAME = "SiliconX Software Solutions";

/** Province/jurisdiction of registration and governing law. */
export const LEGAL_JURISDICTION = "Province of Nova Scotia, Canada";

/** Short location line used where a full street address isn't published. */
export const LEGAL_ENTITY_LOCATION = "Nova Scotia, Canada";

/** Support / general contact inbox. */
export const SUPPORT_EMAIL = "support@chapterflow.ca";

/** Copyright / DMCA / IP-notice contact (currently the shared support inbox). */
export const LEGAL_CONTACT_EMAIL = "support@chapterflow.ca";

/**
 * Version of the Terms + Privacy Policy a user accepts at signup. Bump this when
 * the agreements change materially so re-acceptance can be required and recorded
 * consent stays auditable.
 */
export const LEGAL_TERMS_VERSION = "2026-06-10";
