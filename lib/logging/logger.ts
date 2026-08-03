import { getRequestId } from "./request-context";

// WS6-031: a thin structured logger. `console` IS the transport — CloudWatch
// captures the server Lambda's stdout/stderr, so the point here is STRUCTURE +
// CORRELATION, not a new sink. Every call emits exactly ONE line of JSON:
//   {"level":"info|warn|error","event":"snake_case_event",
//    "requestId":"…(when known)","time":"ISO-8601", …fields}
// so a user's 500 can be joined to its cause logs in CloudWatch Logs Insights by
// requestId. This module MUST stay pure (no `server-only`, no Next, no AWS SDK)
// so it is unit-testable — the repo unit-tests only pure *-core/lib modules
// (modules importing `server-only` throw at test import). The `err`-normalization
// idiom (300-char message cap, stack only outside production) mirrors the
// unhandled-error logging in app/app/api/book/_lib/http.ts.

export type LogLevel = "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

/** The JSON line each call emits, before serialization. */
type LogRecord = {
  level: LogLevel;
  event: string;
  requestId?: string;
  time: string;
  [key: string]: unknown;
};

/** Where a serialized line is written. Injectable so tests assert output. */
export type LogSink = (level: LogLevel, line: string) => void;

const MESSAGE_MAX_CHARS = 300;

// Default sink: route each level to the matching console method so CloudWatch
// preserves the level and stderr/stdout split. Kept as a stable reference so the
// override below can restore it.
const consoleSink: LogSink = (level, line) => {
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
};

let sink: LogSink = consoleSink;

/**
 * Override the emit sink (tests). Call with no argument to restore the default
 * console sink. Exposed instead of patching `console` globally so tests assert
 * output without fragile global mutation.
 */
export function setLogSink(next?: LogSink): void {
  sink = next ?? consoleSink;
}

/**
 * Normalize an `err` field whose value is an Error into `{name, message}` with
 * the message capped at 300 chars; the stack is included ONLY outside production
 * (stacks can incidentally surface identifiers, and CloudWatch is for
 * correlation, not forensic dumps). Non-Error values pass through untouched.
 */
function normalizeErr(value: unknown): unknown {
  if (!(value instanceof Error)) return value;
  const message =
    value.message.length > MESSAGE_MAX_CHARS
      ? `${value.message.slice(0, MESSAGE_MAX_CHARS)}…`
      : value.message;
  const normalized: { name: string; message: string; stack?: string | undefined } = {
    name: value.name,
    message,
  };
  if (process.env.NODE_ENV !== "production") {
    normalized.stack = value.stack;
  }
  return normalized;
}

function emit(level: LogLevel, event: string, fields?: LogFields): void {
  // Logging must NEVER throw and break request handling — defend the whole emit
  // path (serialization of an unexpected field type, a sink that throws, etc.).
  try {
    const record: LogRecord = {
      level,
      event,
      time: new Date().toISOString(),
    };

    // requestId resolves automatically from the ALS request context; an explicit
    // fields.requestId wins.
    const ambientRequestId = getRequestId();
    if (ambientRequestId) record.requestId = ambientRequestId;

    if (fields) {
      for (const [key, value] of Object.entries(fields)) {
        record[key] = key === "err" ? normalizeErr(value) : value;
      }
    }

    sink(level, JSON.stringify(record));
  } catch {
    /* monitoring must never break the request */
  }
}

export const logger = {
  info(event: string, fields?: LogFields): void {
    emit("info", event, fields);
  },
  warn(event: string, fields?: LogFields): void {
    emit("warn", event, fields);
  },
  error(event: string, fields?: LogFields): void {
    emit("error", event, fields);
  },
};
