import "server-only";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";

const REGION =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "us-east-1";

const SSM_PREFIX = (process.env.SSM_PARAMETER_PREFIX || "").trim();
let ssmClientPromise: Promise<{
  send(command: GetParameterCommand): Promise<{ Parameter?: { Value?: string } }>;
}> | null = null;

const resolvedValueCache = new Map<string, string>();
const missingCache = new Set<string>();

// Distinguishes "loadFromSsm hit a transient/credential/network error" from
// "loadFromSsm genuinely found nothing". On the no-prefix fallback path the
// error is swallowed (SSM is optional there), but getServerEnv must NOT cache
// the name as permanently missing on a transient blip — otherwise one bad
// lookup poisons the value for the whole process lifetime.
class SsmTransientError extends Error {
  constructor(public readonly cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = "SsmTransientError";
  }
}

async function getSsmClient() {
  if (ssmClientPromise) return ssmClientPromise;

  ssmClientPromise = (async () => {
    return new SSMClient({ region: REGION });
  })();

  return ssmClientPromise;
}

// SSM lookups walk a list of candidate parameter names (the env-prefixed name
// first, then bare-name fallbacks). Two error classes mean "this candidate is
// unusable, try the next one" rather than "SSM is broken":
//   - ParameterNotFound — the name simply doesn't exist.
//   - AccessDenied — the Lambda role is scoped to this env's SSM prefix (see the
//     CDK SsmConfigAccess statement), so the unscoped bare-name fallbacks are
//     denied. That denial is expected; skip past it instead of failing the
//     request (the prefixed candidate is always tried first).
function isSkippableSsmError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const maybe = error as { name?: unknown; Code?: unknown; __type?: unknown };
  const fields = [maybe.name, maybe.Code, maybe.__type].filter(
    (v): v is string => typeof v === "string",
  );
  return fields.some(
    (f) => f.includes("ParameterNotFound") || f.includes("AccessDenied"),
  );
}

function uniqueNames(names: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    const value = n.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function candidateParameterNames(key: string): string[] {
  const lower = key.toLowerCase();
  const explicit =
    process.env[`SSM_PARAM_${key}`] ||
    process.env[`${key}_SSM_PARAM`] ||
    process.env[`${key}_SSM_PARAMETER`];

  const names = [explicit || ""];

  if (SSM_PREFIX) {
    const prefix = SSM_PREFIX.endsWith("/")
      ? SSM_PREFIX.slice(0, -1)
      : SSM_PREFIX;
    // Prefer environment-scoped parameters when a prefix is configured.
    names.push(`${prefix}/${key}`);
    names.push(`${prefix}/${lower}`);
  }

  names.push(key);
  names.push(lower);
  names.push(`/${key}`);
  names.push(`/${lower}`);

  return uniqueNames(names);
}

async function loadFromSsm(key: string): Promise<string | undefined> {
  const candidates = candidateParameterNames(key);
  if (candidates.length === 0) return undefined;
  const ssm = await getSsmClient();

  let lastError: unknown;
  for (const paramName of candidates) {
    try {
      const res = await ssm.send(
        new GetParameterCommand({
          Name: paramName,
          WithDecryption: true,
        })
      );
      const value = res.Parameter?.Value;
      if (value != null && value !== "") {
        return value;
      }
    } catch (error: unknown) {
      if (isSkippableSsmError(error)) continue;
      lastError = error;
    }
  }

  if (lastError) {
    // When SSM is explicitly configured via SSM_PREFIX, propagate the error so the
    // request fails loudly (and a later call retries fresh — nothing is cached).
    if (SSM_PREFIX) throw lastError;
    // Without a prefix, SSM is an optional fallback — credential/network failures
    // should not crash the request. But signal the failure as transient so the
    // caller does NOT cache this name as permanently missing on a transient blip.
    console.warn("book_ssm_fallback_skipped", {
      message: lastError instanceof Error ? lastError.message : String(lastError),
    });
    throw new SsmTransientError(lastError);
  }
  return undefined;
}

export async function getServerEnv(name: string): Promise<string | undefined> {
  const fromProcess = process.env[name];
  if (fromProcess) {
    resolvedValueCache.set(name, fromProcess);
    return fromProcess;
  }

  if (resolvedValueCache.has(name)) return resolvedValueCache.get(name);
  if (missingCache.has(name)) return undefined;

  let fromSsm: string | undefined;
  try {
    fromSsm = await loadFromSsm(name);
  } catch (error: unknown) {
    // A transient/credential/network blip on the no-prefix fallback path must not
    // poison missingCache for the process lifetime — return undefined for this
    // request only, so a later call retries fresh. (With SSM_PREFIX set, the error
    // is a real one and propagates instead of being swallowed here.)
    if (error instanceof SsmTransientError) return undefined;
    throw error;
  }
  if (!fromSsm) {
    missingCache.add(name);
    return undefined;
  }

  process.env[name] = fromSsm;
  resolvedValueCache.set(name, fromSsm);
  return fromSsm;
}

export async function mustServerEnv(name: string): Promise<string> {
  const v = await getServerEnv(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}
