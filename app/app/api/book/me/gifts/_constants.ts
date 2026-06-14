import "server-only";

/**
 * Length of the Pro window a redeemed gift code grants. Shared by the claim
 * route (which grants it) and the preview route (which advertises it) so the
 * value the recipient sees before claiming always matches what they get.
 */
export const GIFT_PRO_DAYS = 7;
export const GIFT_TYPE = "pro_week" as const;
