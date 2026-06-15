import "server-only";

import { requireAdminUser } from "@/app/app/api/book/_lib/admin-auth";
import { bookOk, withBookApiErrors } from "@/app/app/api/book/_lib/http";
import { getBookTableName } from "@/app/app/api/book/_lib/env";
import { BookApiError } from "@/app/app/api/book/_lib/errors";
import { listSegments, putSegment } from "@/app/app/api/book/_lib/admin-segments-repo";
import type {
  SegmentDefinition,
  SegmentFilter,
  SegmentFilterField,
  SegmentFilterOperator,
} from "@/app/app/api/book/_lib/segment-engine";

export const runtime = "nodejs";

// Keep in sync with the SegmentFilterField / SegmentFilterOperator unions in
// segment-engine.ts. The engine silently treats unknown fields/operators as a
// non-match, so a malformed filter would persist and quietly target zero users;
// we reject it on write instead.
const SEGMENT_FILTER_FIELDS: readonly SegmentFilterField[] = [
  "plan",
  "proSource",
  "country",
  "lastActiveWithinDays",
  "booksCompleted",
  "flowPoints",
  "tier",
  "signupWithinDays",
  "hasBadge",
  "hasCompletedOnboarding",
];

const SEGMENT_FILTER_OPERATORS: readonly SegmentFilterOperator[] = [
  "is",
  "isNot",
  "gt",
  "lt",
  "gte",
  "lte",
  "between",
  "contains",
  "isEmpty",
  "isNotEmpty",
];

// Which operators each field actually understands in evaluateFilter().
const FIELD_OPERATORS: Record<SegmentFilterField, readonly SegmentFilterOperator[]> = {
  plan: ["is", "isNot", "contains", "isEmpty", "isNotEmpty"],
  proSource: ["is", "isNot", "contains", "isEmpty", "isNotEmpty"],
  country: ["is", "isNot", "contains", "isEmpty", "isNotEmpty"],
  tier: ["is", "isNot", "contains", "isEmpty", "isNotEmpty"],
  lastActiveWithinDays: ["gt", "lt", "isEmpty"],
  signupWithinDays: ["gt", "lt"],
  booksCompleted: ["is", "gt", "gte", "lt", "lte", "between"],
  flowPoints: ["is", "gt", "gte", "lt", "lte", "between"],
  hasBadge: ["is", "isNot"],
  hasCompletedOnboarding: ["is", "isNot"],
};

// Numeric fields whose `value` (and `valueMax` for "between") must be coerced
// to a finite number on write.
const NUMERIC_FIELDS: ReadonlySet<SegmentFilterField> = new Set<SegmentFilterField>([
  "lastActiveWithinDays",
  "signupWithinDays",
  "booksCompleted",
  "flowPoints",
]);

// Operators that carry no value at all.
const VALUELESS_OPERATORS: ReadonlySet<SegmentFilterOperator> = new Set<SegmentFilterOperator>([
  "isEmpty",
  "isNotEmpty",
]);

const MAX_FILTERS = 25;

/**
 * Validate the `filters` payload on write. Rejects unknown fields/operators,
 * operator/field mismatches, missing values, and out-of-bounds arrays — and
 * coerces numeric values — so a saved segment cannot silently match nobody.
 * Returns a normalized, persistable SegmentFilter[]. Throws BookApiError(400)
 * naming the offending filter.
 */
export function validateSegmentFilters(input: unknown): SegmentFilter[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new BookApiError(400, "invalid_filters", "at least one filter required");
  }
  if (input.length > MAX_FILTERS) {
    throw new BookApiError(
      400,
      "invalid_filters",
      `too many filters (max ${MAX_FILTERS})`,
    );
  }

  return input.map((raw, i) => {
    const label = `filter[${i}]`;
    if (!raw || typeof raw !== "object") {
      throw new BookApiError(400, "invalid_filters", `${label} must be an object`);
    }
    const { field, operator, value, valueMax } = raw as Record<string, unknown>;

    if (!SEGMENT_FILTER_FIELDS.includes(field as SegmentFilterField)) {
      throw new BookApiError(
        400,
        "invalid_filters",
        `${label} has unknown field "${String(field)}"`,
      );
    }
    const f = field as SegmentFilterField;

    if (!SEGMENT_FILTER_OPERATORS.includes(operator as SegmentFilterOperator)) {
      throw new BookApiError(
        400,
        "invalid_filters",
        `${label} has unknown operator "${String(operator)}"`,
      );
    }
    const op = operator as SegmentFilterOperator;

    if (!FIELD_OPERATORS[f].includes(op)) {
      throw new BookApiError(
        400,
        "invalid_filters",
        `${label}: operator "${op}" is not valid for field "${f}"`,
      );
    }

    const next: SegmentFilter = { field: f, operator: op };

    if (VALUELESS_OPERATORS.has(op)) {
      // No value carried; ignore any supplied value/valueMax.
      return next;
    }

    if (value === undefined || value === null || value === "") {
      throw new BookApiError(
        400,
        "invalid_filters",
        `${label}: operator "${op}" requires a value`,
      );
    }

    if (NUMERIC_FIELDS.has(f)) {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        throw new BookApiError(
          400,
          "invalid_filters",
          `${label}: value for field "${f}" must be a number`,
        );
      }
      next.value = num;
      if (op === "between") {
        const max = Number(valueMax);
        if (!Number.isFinite(max)) {
          throw new BookApiError(
            400,
            "invalid_filters",
            `${label}: operator "between" requires a numeric valueMax`,
          );
        }
        if (max < num) {
          throw new BookApiError(
            400,
            "invalid_filters",
            `${label}: valueMax must be >= value`,
          );
        }
        next.valueMax = max;
      }
    } else {
      if (typeof value !== "string" && typeof value !== "number") {
        throw new BookApiError(
          400,
          "invalid_filters",
          `${label}: value for field "${f}" must be a string or number`,
        );
      }
      next.value = value;
    }

    return next;
  });
}

export async function GET(req: Request) {
  return withBookApiErrors(req, async () => {
    await requireAdminUser();
    const tableName = await getBookTableName();
    const segments = await listSegments(tableName);
    return bookOk({ segments });
  });
}

export async function POST(req: Request) {
  return withBookApiErrors(req, async () => {
    const admin = await requireAdminUser();
    const tableName = await getBookTableName();

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      description?: string;
      filters?: SegmentFilter[];
    };

    if (!body.name || typeof body.name !== "string" || body.name.trim().length < 2) {
      throw new BookApiError(400, "invalid_name", "name must be at least 2 characters");
    }
    const filters = validateSegmentFilters(body.filters);

    const now = new Date().toISOString();
    const segmentId = `seg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const segment: SegmentDefinition = {
      segmentId,
      name: body.name.trim(),
      description: body.description?.trim() || undefined,
      filters,
      createdAt: now,
      updatedAt: now,
      createdBy: admin.sub,
    };
    await putSegment(tableName, segment);
    return bookOk({ segment });
  });
}
