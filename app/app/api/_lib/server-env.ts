import "server-only";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import {
  loadSsmParameterValue,
} from "./server-env-core";
import { logger } from "@/lib/logging/logger";
import { awsClientConfig } from "./aws-client-config-core";

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
    return new SSMClient({ region: REGION, ...awsClientConfig });
  })();

  return ssmClientPromise;
}

// SSM lookups walk a list of candidate parameter names (the env-prefixed name
// first, then bare-name fallbacks). `classifySsmCandidateError` (server-env-core)
// decides per-candidate whether a failed GetParameter is an expected miss to skip
// past (ParameterNotFound anywhere; AccessDenied on the UNSCOPED fallbacks the
// prefix-scoped IAM role legitimately can't read) or a real error to record. An
// AccessDenied on the PREFIX-SCOPED candidate is the latter — that name is the
// one the role is supposed to read, so a denial there is an IAM mis-scope/KMS
// denial that must surface instead of being cached as a permanent miss.

async function loadFromSsm(key: string): Promise<string | undefined> {
  const ssm = await getSsmClient();
  try {
    return await loadSsmParameterValue(
      key,
      SSM_PREFIX,
      process.env,
      async ({ name, withDecryption }) => {
        const response = await ssm.send(
          new GetParameterCommand({
            Name: name,
            WithDecryption: withDecryption,
          }),
        );
        return response.Parameter?.Value;
      },
    );
  } catch (error: unknown) {
    // When SSM is explicitly configured via SSM_PREFIX, propagate the error so the
    // request fails loudly (and a later call retries fresh — nothing is cached).
    if (SSM_PREFIX) throw error;
    // Without a prefix, SSM is an optional fallback — credential/network failures
    // should not crash the request. But signal the failure as transient so the
    // caller does NOT cache this name as permanently missing on a transient blip.
    logger.warn("book_ssm_fallback_skipped", {
      message: error instanceof Error ? error.message : String(error),
    });
    throw new SsmTransientError(error);
  }
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
