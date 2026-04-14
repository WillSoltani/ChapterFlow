import "server-only";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SegmentFilterField =
  | "plan"
  | "proSource"
  | "country"
  | "lastActiveWithinDays"
  | "booksCompleted"
  | "flowPoints"
  | "tier"
  | "signupWithinDays"
  | "hasBadge"
  | "hasCompletedOnboarding";

export type SegmentFilterOperator =
  | "is"
  | "isNot"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "between"
  | "contains"
  | "isEmpty"
  | "isNotEmpty";

export type SegmentFilter = {
  field: SegmentFilterField;
  operator: SegmentFilterOperator;
  value?: string | number;
  valueMax?: number; // for "between" operator
};

export type SegmentDefinition = {
  segmentId: string;
  name: string;
  description?: string;
  filters: SegmentFilter[]; // joined by AND
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastRunCount?: number;
  lastRunAt?: string;
};

/**
 * User shape for predicate evaluation — minimum fields from entitlement +
 * snapshot needed for all supported filters.
 */
export type SegmentUser = {
  userId: string;
  email: string | null;
  plan: "FREE" | "PRO";
  proSource: string | null;
  countryCode: string | null;
  lastActiveAt: string | null;
  firstSeenAt: string | null;
  booksCompleted: number;
  flowPoints: number;
  tier: string | null;
  badgeCount: number;
  onboardingCompletedAt: string | null;
};

// ─── Evaluation ─────────────────────────────────────────────────────────────

function evaluateFilter(user: SegmentUser, filter: SegmentFilter): boolean {
  const op = filter.operator;
  const now = Date.now();

  switch (filter.field) {
    case "plan":
      return compareString(user.plan, op, filter.value);
    case "proSource":
      return compareString(user.proSource, op, filter.value);
    case "country":
      return compareString(user.countryCode, op, filter.value);
    case "tier":
      return compareString(user.tier, op, filter.value);
    case "lastActiveWithinDays": {
      if (!user.lastActiveAt) return op === "isEmpty" || op === "gt";
      const days = Number(filter.value);
      if (!Number.isFinite(days)) return false;
      const cutoff = now - days * 86_400_000;
      const t = new Date(user.lastActiveAt).getTime();
      return op === "gt" ? t >= cutoff : t < cutoff;
    }
    case "signupWithinDays": {
      if (!user.firstSeenAt) return false;
      const days = Number(filter.value);
      if (!Number.isFinite(days)) return false;
      const cutoff = now - days * 86_400_000;
      const t = new Date(user.firstSeenAt).getTime();
      return op === "gt" ? t >= cutoff : t < cutoff;
    }
    case "booksCompleted":
      return compareNumber(user.booksCompleted, op, filter);
    case "flowPoints":
      return compareNumber(user.flowPoints, op, filter);
    case "hasBadge":
      return op === "is" ? user.badgeCount > 0 : user.badgeCount === 0;
    case "hasCompletedOnboarding":
      return op === "is"
        ? user.onboardingCompletedAt !== null
        : user.onboardingCompletedAt === null;
    default:
      return false;
  }
}

function compareString(
  value: string | null,
  op: SegmentFilterOperator,
  target?: string | number,
): boolean {
  const t = typeof target === "string" ? target : String(target ?? "");
  switch (op) {
    case "is":
      return value === t;
    case "isNot":
      return value !== t;
    case "contains":
      return (value ?? "").toLowerCase().includes(t.toLowerCase());
    case "isEmpty":
      return !value;
    case "isNotEmpty":
      return !!value;
    default:
      return false;
  }
}

function compareNumber(
  value: number,
  op: SegmentFilterOperator,
  filter: SegmentFilter,
): boolean {
  const v = Number(filter.value);
  switch (op) {
    case "is":
      return value === v;
    case "gt":
      return value > v;
    case "gte":
      return value >= v;
    case "lt":
      return value < v;
    case "lte":
      return value <= v;
    case "between":
      return value >= v && value <= Number(filter.valueMax ?? Infinity);
    default:
      return false;
  }
}

/**
 * Return true if user matches ALL filters (AND semantics).
 */
export function matchesSegment(user: SegmentUser, filters: SegmentFilter[]): boolean {
  for (const f of filters) {
    if (!evaluateFilter(user, f)) return false;
  }
  return true;
}

/**
 * Run filters against a user set, return matching users.
 */
export function runSegment(
  users: SegmentUser[],
  filters: SegmentFilter[],
): SegmentUser[] {
  return users.filter((u) => matchesSegment(u, filters));
}
