import "server-only";

const REGION =
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  "us-east-1";

const SSM_PREFIX = (process.env.SSM_PARAMETER_PREFIX || "").trim();
let ssmClientPromise: Promise<{
  getParameter(
    params: { Name: string; WithDecryption: boolean }
  ): { promise(): Promise<{ Parameter?: { Value?: string } }> };
}> | null = null;

const resolvedValueCache = new Map<string, string>();
const missingCache = new Set<string>();

async function getSsmClient() {
  if (ssmClientPromise) return ssmClientPromise;

  ssmClientPromise = (async () => {
    const mod = await import("aws-sdk");
    return new mod.default.SSM({ region: REGION });
  })();

  return ssmClientPromise;
}

function isMissingParameterError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const maybe = error as {
    name?: unknown;
    Code?: unknown;
    __type?: unknown;
  };
  const name = typeof maybe.name === "string" ? maybe.name : "";
  const code = typeof maybe.Code === "string" ? maybe.Code : "";
  const type = typeof maybe.__type === "string" ? maybe.__type : "";
  return (
    name.includes("ParameterNotFound") ||
    code.includes("ParameterNotFound") ||
    type.includes("ParameterNotFound")
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
      const res = await ssm
        .getParameter({
          Name: paramName,
          WithDecryption: true,
        })
        .promise();
      const value = res.Parameter?.Value;
      if (value != null && value !== "") {
        return value;
      }
    } catch (error: unknown) {
      if (isMissingParameterError(error)) continue;
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError;
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

  const fromSsm = await loadFromSsm(name);
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
