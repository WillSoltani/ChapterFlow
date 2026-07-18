// Shared, dependency-free entitlement types (server + client safe).
//
// SINGLE SOURCE OF TRUTH for the `proSource` union (WS3-014). The server
// entitlement record (app/app/api/book/_lib/types.ts) and the client billing
// hook (app/book/hooks/useBookEntitlements.ts) both derive their proSource
// union from here, so an admin-granted PRO user's value can never be a member
// the client union fails to admit (the drift the finding flagged).
//
// This module must stay import-free so it is safe to pull into a "use client"
// module and so the forthcoming lib/ boundary rule holds.

/**
 * How a user obtained PRO:
 *   - "stripe"      — a paid Stripe subscription.
 *   - "apple"       — an App Store / StoreKit in-app subscription.
 *   - "license"     — a free-pass license key.
 *   - "flow_points" — a timed reward pass.
 *   - "gift_code"   — a gifted Pro window.
 *   - "admin"       — an admin-granted PRO entitlement.
 *
 * Apple and promotional sources expire at read time; signed notifications also
 * reconcile stored state (see getUserEntitlement).
 */
export type ProSource =
  | "stripe"
  | "apple"
  | "license"
  | "flow_points"
  | "gift_code"
  | "admin";
