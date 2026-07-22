export type RuntimeEnvRequirementProjection = {
  id: string;
  names: readonly string[];
  applicability: "always" | "production";
  presence: "all" | "one_of";
  allowedValues?: readonly string[];
  minimumLength?: number;
  source?: "ssm_runtime";
};

export const FRONTEND_SSM_RUNTIME_SECRET_NAMES = [
  "BOOK_STRIPE_SECRET_KEY",
  "BOOK_STRIPE_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
  "ELEVENLABS_API_KEY",
  "AUTH_STATE_SECRET",
] as const;

export type RuntimeEnvFailure = {
  requirementId: string;
  code: "missing" | "invalid_value" | "too_short";
  names: readonly string[];
};

// Infra is compiled with infra/ as its TypeScript root, so production code
// cannot import the app manifest. Keep this projection dependency-free and
// enforce exact semantic parity from frontend-runtime-config.test.ts, which
// runs under tsx and may import both roots.
export const FRONTEND_RUNTIME_ENV_REQUIREMENTS = [
  {
    id: "deployment-environment",
    names: ["CHAPTERFLOW_ENV"],
    applicability: "always",
    presence: "all",
    allowedValues: ["dev", "staging", "prod"],
  },
  {
    id: "book-table",
    names: ["BOOK_TABLE_NAME"],
    applicability: "always",
    presence: "all",
  },
  {
    id: "book-content-bucket",
    names: ["BOOK_CONTENT_BUCKET"],
    applicability: "always",
    presence: "all",
  },
  {
    id: "stripe-secret-key",
    names: ["BOOK_STRIPE_SECRET_KEY"],
    applicability: "production",
    presence: "all",
    source: "ssm_runtime",
  },
  {
    id: "stripe-webhook-secret",
    names: ["BOOK_STRIPE_WEBHOOK_SECRET"],
    applicability: "production",
    presence: "all",
    source: "ssm_runtime",
  },
  {
    id: "stripe-monthly-price",
    names: ["BOOK_STRIPE_PRICE_ID"],
    applicability: "production",
    presence: "all",
  },
  {
    id: "cognito-client",
    names: ["COGNITO_CLIENT_ID"],
    applicability: "production",
    presence: "all",
  },
  {
    id: "cognito-region",
    names: ["COGNITO_REGION"],
    applicability: "production",
    presence: "all",
  },
  {
    id: "cognito-user-pool",
    names: ["COGNITO_USER_POOL_ID"],
    applicability: "production",
    presence: "all",
  },
  {
    id: "cognito-redirect",
    names: ["COGNITO_REDIRECT_URI"],
    applicability: "production",
    presence: "all",
  },
  {
    id: "cognito-domain",
    names: ["COGNITO_DOMAIN", "COGNITO_CUSTOM_DOMAIN"],
    applicability: "production",
    presence: "one_of",
  },
  {
    id: "auth-state-secret",
    names: ["AUTH_STATE_SECRET"],
    applicability: "production",
    presence: "all",
    minimumLength: 32,
    source: "ssm_runtime",
  },
  {
    id: "app-base-url",
    names: ["CHAPTERFLOW_APP_BASE_URL"],
    applicability: "production",
    presence: "all",
  },
  {
    id: "anthropic-api-key",
    names: ["ANTHROPIC_API_KEY"],
    applicability: "production",
    presence: "all",
    source: "ssm_runtime",
  },
  {
    id: "origin-verification-secret",
    names: ["ORIGIN_VERIFY_SECRET"],
    applicability: "production",
    presence: "all",
    minimumLength: 32,
  },
  {
    id: "apple-bundle-id",
    names: ["APPLE_IAP_BUNDLE_ID"],
    applicability: "production",
    presence: "all",
  },
  {
    id: "apple-app-id",
    names: ["APPLE_IAP_APP_APPLE_ID"],
    applicability: "production",
    presence: "all",
  },
  {
    id: "apple-subscription-group",
    names: ["APPLE_IAP_SUBSCRIPTION_GROUP_ID"],
    applicability: "production",
    presence: "all",
  },
  {
    id: "storekit-products",
    names: ["IOS_STOREKIT_PRODUCT_IDS"],
    applicability: "production",
    presence: "all",
  },
  {
    id: "app-store-url",
    names: ["IOS_APP_STORE_URL"],
    applicability: "production",
    presence: "all",
  },
] as const satisfies readonly RuntimeEnvRequirementProjection[];

const SERVER_ENV_PASSTHROUGH = [
  "CHAPTERFLOW_COMMIT_SHA",
  "CHAPTERFLOW_APP_BASE_URL",
  "COGNITO_DOMAIN",
  "COGNITO_CUSTOM_DOMAIN",
  "COGNITO_CLIENT_ID",
  "COGNITO_REGION",
  "COGNITO_USER_POOL_ID",
  "COGNITO_REDIRECT_URI",
  "COGNITO_LOGOUT_REDIRECT_URI",
  "AUTH_COOKIE_DOMAIN",
  "BOOK_STRIPE_PRICE_ID",
  "BOOK_STRIPE_PRICE_ID_ANNUAL",
  "BOOK_STRIPE_PRICE_ID_ANNUAL_UPFRONT",
  "IOS_APP_TEAM_ID",
  "IOS_APP_BUNDLE_ID",
  "APPLE_IAP_BUNDLE_ID",
  "APPLE_IAP_APP_APPLE_ID",
  "APPLE_IAP_SUBSCRIPTION_GROUP_ID",
  "IOS_STOREKIT_PRODUCT_IDS",
  "IOS_APP_STORE_URL",
  "APPLE_IAP_TESTFLIGHT_SANDBOX_ENABLED",
  "APPLE_IAP_TESTFLIGHT_QA_USER_HASHES",
] as const;

function nonBlank(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== "";
}

export function resolveFrontendHostedZoneId(
  domainName: string | undefined,
  rawHostedZoneId: string | undefined,
): string | undefined {
  const hasDomainName = nonBlank(domainName);
  const hostedZoneId = rawHostedZoneId?.trim();

  if (hasDomainName !== nonBlank(hostedZoneId)) {
    throw new Error(
      "CHAPTERFLOW_DOMAIN_NAME and CHAPTERFLOW_HOSTED_ZONE_ID must be configured together",
    );
  }
  if (hostedZoneId && !/^Z[A-Z0-9]{5,31}$/.test(hostedZoneId)) {
    throw new Error("CHAPTERFLOW_HOSTED_ZONE_ID has an invalid format");
  }

  return hostedZoneId || undefined;
}

export function validateFrontendRuntimeEnvironment(
  env: Record<string, string | undefined>,
): RuntimeEnvFailure[] {
  const isProduction = env.CHAPTERFLOW_ENV?.trim() === "prod";
  const failures: RuntimeEnvFailure[] = [];

  for (const requirement of FRONTEND_RUNTIME_ENV_REQUIREMENTS as readonly RuntimeEnvRequirementProjection[]) {
    if (requirement.applicability === "production" && !isProduction) continue;
    const presentNames = requirement.names.filter((name) => nonBlank(env[name]));
    const missingNames = requirement.names.filter((name) => !nonBlank(env[name]));
    const missing =
      requirement.presence === "one_of"
        ? presentNames.length === 0
        : missingNames.length > 0;
    if (missing) {
      failures.push({
        requirementId: requirement.id,
        code: "missing",
        names:
          requirement.presence === "one_of" ? [...requirement.names] : missingNames,
      });
      continue;
    }

    const namesToValidate =
      requirement.presence === "one_of" ? presentNames : requirement.names;
    const allowedValues = requirement.allowedValues;
    if (
      allowedValues &&
      namesToValidate.some(
        (name) => !allowedValues.includes(env[name]!.trim()),
      )
    ) {
      failures.push({
        requirementId: requirement.id,
        code: "invalid_value",
        names: [...namesToValidate],
      });
      continue;
    }
    const minimumLength = requirement.minimumLength;
    if (
      minimumLength !== undefined &&
      namesToValidate.some(
        (name) => env[name]!.trim().length < minimumLength,
      )
    ) {
      failures.push({
        requirementId: requirement.id,
        code: "too_short",
        names: [...namesToValidate],
      });
    }
  }

  return failures;
}

export type FrontendRuntimeConfigInput = {
  deploymentEnvironment: "dev" | "staging" | "prod";
  appTableName: string;
  contentBucketName: string;
  ssmParameterPrefix: string;
  deployEnv: Record<string, string | undefined>;
};

export type FrontendRuntimeConfig = {
  serverEnv: Record<string, string>;
  originVerifySecret?: string;
  originVerifyMode?: "enforce" | "log";
};

export function projectFrontendServerEnv(
  deployEnv: Record<string, string | undefined>,
): Record<string, string> {
  const serverEnv: Record<string, string> = {
    CSRF_ORIGIN_ENFORCE: deployEnv.CSRF_ORIGIN_ENFORCE ?? "1",
  };
  for (const name of SERVER_ENV_PASSTHROUGH) {
    const value = deployEnv[name];
    if (nonBlank(value)) serverEnv[name] = value;
  }

  const originVerifySecret = deployEnv.CHAPTERFLOW_ORIGIN_VERIFY_SECRET?.trim();
  if (originVerifySecret) serverEnv.ORIGIN_VERIFY_SECRET = originVerifySecret;
  return serverEnv;
}

export function formatRuntimeFailures(failures: readonly RuntimeEnvFailure[]): string {
  return failures
    .map(
      ({ requirementId, code, names }) =>
        `${requirementId}:${code}:${names.join("|")}`,
    )
    .join(", ");
}

export function buildFrontendRuntimeConfig(
  input: FrontendRuntimeConfigInput,
): FrontendRuntimeConfig {
  const serverEnv = projectFrontendServerEnv(input.deployEnv);
  const runtimeEnv: Record<string, string | undefined> = {
    ...serverEnv,
    CHAPTERFLOW_ENV: input.deploymentEnvironment,
    BOOK_TABLE_NAME: input.appTableName,
    BOOK_CONTENT_BUCKET: input.contentBucketName,
  };
  const failures = validateFrontendDeploymentEnvironment(
    runtimeEnv,
    input.ssmParameterPrefix,
  );
  if (failures.length > 0) {
    throw new Error(
      `Refusing to synth the ${input.deploymentEnvironment} ChapterFlowFrontend stack — ` +
        `runtime environment contract violation(s): ${formatRuntimeFailures(failures)}.`,
    );
  }

  const originVerifySecret = serverEnv.ORIGIN_VERIFY_SECRET;
  return {
    serverEnv,
    ...(originVerifySecret ? { originVerifySecret } : {}),
    originVerifyMode:
      input.deployEnv.CHAPTERFLOW_ORIGIN_VERIFY_MODE?.trim() === "log"
        ? "log"
        : "enforce",
  };
}

function validateFrontendDeploymentEnvironment(
  env: Record<string, string | undefined>,
  ssmParameterPrefix: string,
): RuntimeEnvFailure[] {
  const isProduction = env.CHAPTERFLOW_ENV?.trim() === "prod";
  const failures: RuntimeEnvFailure[] = [];

  if (isProduction && !nonBlank(ssmParameterPrefix)) {
    failures.push({
      requirementId: "runtime-secret-prefix",
      code: "missing",
      names: ["SSM_PARAMETER_PREFIX"],
    });
  }

  const deferred = new Set(
    (FRONTEND_RUNTIME_ENV_REQUIREMENTS as readonly RuntimeEnvRequirementProjection[])
      .filter(({ source }) => source === "ssm_runtime")
      .flatMap(({ names }) => names),
  );
  const validationEnv = { ...env };
  for (const name of deferred) {
    // Synth validates that runtime resolution is bound to a scoped prefix. It
    // must not read or require the secret value; boot validates the resolved
    // value against this same manifest before traffic is accepted.
    validationEnv[name] = "x".repeat(64);
  }
  failures.push(...validateFrontendRuntimeEnvironment(validationEnv));
  return failures;
}
