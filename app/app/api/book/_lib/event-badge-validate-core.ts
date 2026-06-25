import { BookApiError } from "./errors";
import type { EventDefinitionItem } from "./types";

/**
 * Pure validator for a seasonal-event `badge` payload, shared by the admin
 * event POST creator and the PATCH updater.
 *
 * ## Why this module exists (the bug it fixes — H12)
 *
 * `POST /admin/events` rejects a badge that is missing `badgeId`, `name`, or
 * `icon` (throws 400 `invalid_badge`). The `PATCH /admin/events/[eventId]`
 * updater only checked `body.badge && typeof body.badge === "object"` before
 * persisting it, so a PATCH with `badge: {}` (or `badge: { name: "x" }`)
 * slipped a malformed badge past the creator's guard and overwrote the event's
 * badge with an object missing required fields. A badge with no `badgeId`/
 * `name`/`icon` then feeds the participation/award path (the badge is what the
 * event grants), so a half-formed badge is a real data-integrity defect.
 *
 * This extracts the creator's exact check into one pure, dependency-free
 * function so BOTH routes enforce identical rules and it can be unit-tested
 * without the AWS SDK (the routes are `server-only` and cannot be imported by
 * the node:test runner — the repo's documented `*-core` seam pattern). It also
 * tightens the rule slightly: each field must be a NON-EMPTY string after trim,
 * so `badge: { badgeId: "  ", name: "x", icon: "y" }` is rejected too (the old
 * truthiness check `!badge.badgeId` already rejected `""`, but not whitespace).
 */
export type EventBadge = EventDefinitionItem["badge"];

/**
 * Validate and normalize a badge payload. Throws `BookApiError(400,
 * "invalid_badge")` when it is not an object or is missing any of
 * `badgeId`/`name`/`icon` as a non-empty string. Returns the trimmed badge.
 */
export function validateEventBadge(raw: unknown): EventBadge {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new BookApiError(400, "invalid_badge", "badge must include badgeId, name, and icon.");
  }
  const candidate = raw as Record<string, unknown>;
  const badgeId = candidate.badgeId;
  const name = candidate.name;
  const icon = candidate.icon;
  if (
    typeof badgeId !== "string" || badgeId.trim().length === 0 ||
    typeof name !== "string" || name.trim().length === 0 ||
    typeof icon !== "string" || icon.trim().length === 0
  ) {
    throw new BookApiError(400, "invalid_badge", "badge must include badgeId, name, and icon.");
  }
  return { badgeId: badgeId.trim(), name: name.trim(), icon: icon.trim() };
}
