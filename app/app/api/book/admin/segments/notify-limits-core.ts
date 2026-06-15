/**
 * Max recipients a segment notification fans out to synchronously. Larger blasts
 * need a background bulk-send worker. Shared by the notify route (which ENFORCES
 * it) and the admin Segment Builder UI (which WARNS before sending) so the two
 * never drift — they did: the UI previously said "5,000" while the route capped
 * at 500. Pure constant (no server-only) so the client component can import it.
 */
export const MAX_SYNC_RECIPIENTS = 500;
