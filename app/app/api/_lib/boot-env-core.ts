// Dependency-free runtime environment contract (WS3-012).
//
// This module is the application authority for values that must exist before a
// deployed server accepts traffic. It deliberately imports no `server-only`,
// Next.js, Node.js, AWS, or infra code so instrumentation, Playwright config,
// root tests, and the infra parity test can all consume the same manifest.

export type RuntimeEnvApplicability = "always" | "production";
export type RuntimeEnvPresence = "all" | "one_of";

export type RuntimeEnvRequirement = {
  id: string;
  names: readonly string[];
  applicability: RuntimeEnvApplicability;
  presence: RuntimeEnvPresence;
  allowedValues?: readonly string[];
  minimumLength?: number;
  /** Omitted means Lambda environment; ssm_runtime is hydrated before validation. */
  source?: "ssm_runtime";
  reason: string;
  /** Nonsecret value used only to derive local production E2E placeholders. */
  syntheticValue: string;
};

export const SSM_RUNTIME_SECRET_NAMES = [
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

export const RUNTIME_ENV_REQUIREMENTS = [
  {
    id: "deployment-environment",
    names: ["CHAPTERFLOW_ENV"],
    applicability: "always",
    presence: "all",
    allowedValues: ["dev", "staging", "prod"],
    reason: "Selects the deployed ChapterFlow resource and policy environment.",
    syntheticValue: "prod",
  },
  {
    id: "book-table",
    names: ["BOOK_TABLE_NAME"],
    applicability: "always",
    presence: "all",
    reason: "Names the DynamoDB table used by the application data plane.",
    syntheticValue: "e2e-book-table",
  },
  {
    id: "book-content-bucket",
    names: ["BOOK_CONTENT_BUCKET"],
    applicability: "always",
    presence: "all",
    reason: "Names the S3 bucket serving published book content.",
    syntheticValue: "e2e-book-content-bucket",
  },
  {
    id: "stripe-secret-key",
    names: ["BOOK_STRIPE_SECRET_KEY"],
    applicability: "production",
    presence: "all",
    source: "ssm_runtime",
    reason: "Authorizes production Stripe server operations.",
    syntheticValue: "e2e-stripe-secret-placeholder",
  },
  {
    id: "stripe-webhook-secret",
    names: ["BOOK_STRIPE_WEBHOOK_SECRET"],
    applicability: "production",
    presence: "all",
    source: "ssm_runtime",
    reason: "Authenticates production Stripe webhook deliveries.",
    syntheticValue: "e2e-stripe-webhook-placeholder",
  },
  {
    id: "stripe-monthly-price",
    names: ["BOOK_STRIPE_PRICE_ID"],
    applicability: "production",
    presence: "all",
    reason: "Selects the production monthly subscription price.",
    syntheticValue: "e2e-monthly-price",
  },
  {
    id: "cognito-client",
    names: ["COGNITO_CLIENT_ID"],
    applicability: "production",
    presence: "all",
    reason: "Pins the OAuth client and verified ID-token audience.",
    syntheticValue: "e2e-cognito-client",
  },
  {
    id: "cognito-region",
    names: ["COGNITO_REGION"],
    applicability: "production",
    presence: "all",
    reason: "Builds the Cognito issuer and endpoint locations.",
    syntheticValue: "us-east-1",
  },
  {
    id: "cognito-user-pool",
    names: ["COGNITO_USER_POOL_ID"],
    applicability: "production",
    presence: "all",
    reason: "Pins the Cognito issuer used to verify ID tokens.",
    syntheticValue: "us-east-1_e2e",
  },
  {
    id: "cognito-redirect",
    names: ["COGNITO_REDIRECT_URI"],
    applicability: "production",
    presence: "all",
    reason: "Defines the OAuth callback accepted by the production client.",
    syntheticValue: "http://127.0.0.1:3000/auth/callback",
  },
  {
    id: "cognito-domain",
    names: ["COGNITO_DOMAIN", "COGNITO_CUSTOM_DOMAIN"],
    applicability: "production",
    presence: "one_of",
    reason: "Provides either the standard or custom Cognito hosted UI domain.",
    syntheticValue: "e2e.auth.us-east-1.amazoncognito.com",
  },
  {
    id: "auth-state-secret",
    names: ["AUTH_STATE_SECRET"],
    applicability: "production",
    presence: "all",
    minimumLength: 32,
    source: "ssm_runtime",
    reason: "Protects the encrypted OAuth state and PKCE verifier.",
    syntheticValue: `e2e-auth-state-${"0".repeat(32)}`,
  },
  {
    id: "app-base-url",
    names: ["CHAPTERFLOW_APP_BASE_URL"],
    applicability: "production",
    presence: "all",
    reason: "Defines the trusted public application origin.",
    syntheticValue: "http://127.0.0.1:3000",
  },
  {
    id: "anthropic-api-key",
    names: ["ANTHROPIC_API_KEY"],
    applicability: "production",
    presence: "all",
    source: "ssm_runtime",
    reason: "Enables the production AI response path.",
    syntheticValue: "e2e-anthropic-placeholder",
  },
  {
    id: "origin-verification-secret",
    names: ["ORIGIN_VERIFY_SECRET"],
    applicability: "production",
    presence: "all",
    minimumLength: 32,
    reason: "Authenticates CloudFront requests reaching public Function URLs.",
    syntheticValue: `e2e-origin-verify-${"0".repeat(32)}`,
  },
  {
    id: "apple-bundle-id",
    names: ["APPLE_IAP_BUNDLE_ID"],
    applicability: "production",
    presence: "all",
    reason: "Pins StoreKit verification to the production application bundle.",
    syntheticValue: "com.chapterflow.e2e",
  },
  {
    id: "apple-app-id",
    names: ["APPLE_IAP_APP_APPLE_ID"],
    applicability: "production",
    presence: "all",
    reason: "Pins StoreKit verification and the App Store destination.",
    syntheticValue: "1234567890",
  },
  {
    id: "apple-subscription-group",
    names: ["APPLE_IAP_SUBSCRIPTION_GROUP_ID"],
    applicability: "production",
    presence: "all",
    reason: "Restricts accepted StoreKit products to the production group.",
    syntheticValue: "12345678",
  },
  {
    id: "storekit-products",
    names: ["IOS_STOREKIT_PRODUCT_IDS"],
    applicability: "production",
    presence: "all",
    reason: "Enumerates the StoreKit products accepted by the server.",
    syntheticValue: "com.chapterflow.pro.monthly,com.chapterflow.pro.annual",
  },
  {
    id: "app-store-url",
    names: ["IOS_APP_STORE_URL"],
    applicability: "production",
    presence: "all",
    reason: "Provides the canonical App Store destination for native clients.",
    syntheticValue: "https://apps.apple.com/ca/app/chapterflow/id1234567890",
  },
] as const satisfies readonly RuntimeEnvRequirement[];

function nonBlank(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== "";
}

export type RuntimeEnvResolver = (
  name: string,
) => Promise<string | undefined>;

/**
 * Hydrate only manifest-required SSM values for the active environment.
 * Optional SSM-backed capabilities (currently ElevenLabs) remain lazy and do
 * not become new boot requirements. Resolver errors propagate so IAM/KMS
 * failures stop production boot instead of degrading into a cached miss.
 */
export async function hydrateRuntimeSsmRequirements(
  env: Record<string, string | undefined>,
  resolve: RuntimeEnvResolver,
): Promise<Record<string, string | undefined>> {
  const hydrated = { ...env };
  const isProduction = hydrated.CHAPTERFLOW_ENV?.trim() === "prod";

  for (const requirement of RUNTIME_ENV_REQUIREMENTS as readonly RuntimeEnvRequirement[]) {
    if (requirement.source !== "ssm_runtime") continue;
    if (requirement.applicability === "production" && !isProduction) continue;
    for (const name of requirement.names) {
      if (nonBlank(hydrated[name])) continue;
      const value = await resolve(name);
      if (value !== undefined) hydrated[name] = value;
    }
  }

  return hydrated;
}

export function validateRuntimeEnvironment(
  env: Record<string, string | undefined>,
): { failures: RuntimeEnvFailure[] } {
  const isProduction = env.CHAPTERFLOW_ENV?.trim() === "prod";
  const failures: RuntimeEnvFailure[] = [];

  for (const requirement of RUNTIME_ENV_REQUIREMENTS as readonly RuntimeEnvRequirement[]) {
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
    if (
      requirement.allowedValues &&
      namesToValidate.some(
        (name) => !requirement.allowedValues?.includes(env[name]!.trim()),
      )
    ) {
      failures.push({
        requirementId: requirement.id,
        code: "invalid_value",
        names: [...namesToValidate],
      });
      continue;
    }
    if (
      requirement.minimumLength !== undefined &&
      namesToValidate.some(
        (name) => env[name]!.trim().length < requirement.minimumLength!,
      )
    ) {
      failures.push({
        requirementId: requirement.id,
        code: "too_short",
        names: [...namesToValidate],
      });
    }
  }

  return { failures };
}

export function buildSyntheticRuntimeEnvironment(
  deploymentEnvironment: "dev" | "staging" | "prod",
): Record<string, string> {
  const synthetic: Record<string, string> = {};
  for (const requirement of RUNTIME_ENV_REQUIREMENTS as readonly RuntimeEnvRequirement[]) {
    if (
      requirement.applicability === "production" &&
      deploymentEnvironment !== "prod"
    ) {
      continue;
    }
    const names =
      requirement.presence === "one_of"
        ? [requirement.names[0]]
        : requirement.names;
    for (const name of names) {
      if (name === undefined) continue;
      synthetic[name] =
        requirement.id === "deployment-environment"
          ? deploymentEnvironment
          : requirement.syntheticValue;
    }
  }
  return synthetic;
}
