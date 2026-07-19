// Pure, `server-only`-free helpers for SSM config resolution (server-env.ts).
// Kept in a `-core` module so they are directly unit-testable under `tsx --test`
// (importing server-env.ts itself pulls `server-only` + the AWS SSM client).
// server-env.ts imports these and owns the actual SSM I/O + caching.

/**
 * One candidate parameter name plus whether it is the env-prefixed
 * (`SSM_PARAMETER_PREFIX`-scoped) name or an unscoped bare-name fallback.
 *
 * The distinction matters for error classification: the prefix-scoped name is
 * the one the Lambda's IAM role is *supposed* to be able to read, so an
 * `AccessDenied` there is a real misconfiguration — NOT the expected denial we
 * get on the unscoped fallbacks (see `classifySsmCandidateError`).
 */
export type SsmCandidate = {
  name: string;
  /** true when this name is derived from `SSM_PARAMETER_PREFIX`. */
  prefixScoped: boolean;
};

/**
 * Build the ordered list of candidate parameter names for `key`.
 *
 * Order (deduped, blanks dropped):
 *   1. an explicit override (`SSM_PARAM_<KEY>` / `<KEY>_SSM_PARAM` / `<KEY>_SSM_PARAMETER`)
 *      — treated as prefix-scoped (operator pinned it on purpose).
 *   2. `${prefix}/<KEY>` and `${prefix}/<key>` when `prefix` is set — prefix-scoped.
 *   3. the unscoped bare-name fallbacks `<KEY>`, `<key>`, `/<KEY>`, `/<key>`.
 *
 * `prefix` is the configured `SSM_PARAMETER_PREFIX` (already trimmed; may be
 * empty/undefined). A trailing slash is normalized away.
 */
export function candidateParameterNames(
  key: string,
  prefix: string | undefined,
  env: Record<string, string | undefined> = process.env,
): SsmCandidate[] {
  const lower = key.toLowerCase();
  const explicit =
    env[`SSM_PARAM_${key}`] ||
    env[`${key}_SSM_PARAM`] ||
    env[`${key}_SSM_PARAMETER`];

  const out: SsmCandidate[] = [];
  const seen = new Set<string>();
  const push = (name: string, prefixScoped: boolean) => {
    const value = (name || "").trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push({ name: value, prefixScoped });
  };

  // An operator-pinned explicit name is an intentional, in-scope target.
  push(explicit || "", true);

  const trimmedPrefix = (prefix || "").trim();
  if (trimmedPrefix) {
    const base = trimmedPrefix.endsWith("/")
      ? trimmedPrefix.slice(0, -1)
      : trimmedPrefix;
    // Prefer environment-scoped parameters when a prefix is configured.
    push(`${base}/${key}`, true);
    push(`${base}/${lower}`, true);
  }

  push(key, false);
  push(lower, false);
  push(`/${key}`, false);
  push(`/${lower}`, false);

  return out;
}

/**
 * Extract the error-name-ish fields from an unknown AWS SDK error so callers can
 * pattern-match on them (`name`, `Code`, `__type`).
 */
function errorFields(error: unknown): string[] {
  if (typeof error !== "object" || error === null) return [];
  const maybe = error as { name?: unknown; Code?: unknown; __type?: unknown };
  return [maybe.name, maybe.Code, maybe.__type].filter(
    (v): v is string => typeof v === "string",
  );
}

export type SsmErrorDisposition = "skip" | "record";

/**
 * Decide how a failed `GetParameter` call on a single candidate should be
 * handled while walking the candidate list.
 *
 *   - `"skip"`  → this candidate is unusable but it's an *expected* miss, so move
 *                 on to the next candidate WITHOUT recording an error.
 *   - `"record"`→ this is a real failure; record it as `lastError` so it can
 *                 propagate (loud-fail under a prefix) or be flagged transient.
 *
 * Rules:
 *   - `ParameterNotFound` on ANY candidate → `"skip"` (the name just doesn't exist).
 *   - `AccessDenied` (incl. KMS `AccessDeniedException`) on an UNSCOPED bare-name
 *     fallback → `"skip"`: the Lambda role is intentionally scoped to this env's
 *     SSM prefix, so being denied the unscoped names is expected.
 *   - `AccessDenied` on a PREFIX-SCOPED candidate → `"record"`: that name is the
 *     one the role is supposed to be able to read. A denial there means an IAM
 *     mis-scope (prefix typo, region/account mismatch, KMS-decrypt denial) — a
 *     real misconfiguration that must surface, NOT be silently cached as a
 *     permanent "missing" value (which would leave SSM-only config — VAPID_*,
 *     SES_SENDER_EMAIL — absent for the whole process lifetime).
 *   - anything else → `"record"`.
 */
export function classifySsmCandidateError(
  error: unknown,
  prefixScoped: boolean,
): SsmErrorDisposition {
  const fields = errorFields(error);
  if (fields.some((f) => f.includes("ParameterNotFound"))) return "skip";

  const isAccessDenied = fields.some((f) => f.includes("AccessDenied"));
  if (isAccessDenied) {
    // Expected only on the unscoped fallbacks; on the in-scope prefixed name it
    // is a real misconfiguration that must be recorded (and propagated).
    return prefixScoped ? "record" : "skip";
  }

  return "record";
}

export type SsmParameterReadRequest = {
  name: string;
  withDecryption: true;
};

export type SsmParameterReader = (
  request: SsmParameterReadRequest,
) => Promise<string | undefined>;

/**
 * Resolve one config key from the ordered SSM candidate set without importing
 * the AWS SDK. The production adapter lives in server-env.ts; this seam keeps
 * the candidate walk and its fail-closed error behavior directly testable.
 *
 * Values are returned byte-for-byte, but blank/whitespace-only responses are
 * treated as absent so malformed SecureStrings cannot become cached config.
 * Any non-skippable prefix-scoped/IAM/KMS failure is thrown immediately so it
 * cannot fall through to a bare name in another environment. Expected
 * ParameterNotFound and unscoped AccessDenied misses are skipped.
 */
export async function loadSsmParameterValue(
  key: string,
  prefix: string | undefined,
  env: Record<string, string | undefined>,
  read: SsmParameterReader,
): Promise<string | undefined> {
  const candidates = candidateParameterNames(key, prefix, env);

  for (const candidate of candidates) {
    try {
      const value = await read({
        name: candidate.name,
        withDecryption: true,
      });
      if (value !== undefined && value.trim() !== "") return value;
    } catch (error: unknown) {
      if (classifySsmCandidateError(error, candidate.prefixScoped) === "skip") {
        continue;
      }
      throw error;
    }
  }

  return undefined;
}
