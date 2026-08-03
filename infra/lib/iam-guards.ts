import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { IConstruct } from "constructs";

// WS6-003 — every ChapterFlow env (dev/staging/prod) currently deploys into
// ONE shared AWS account. Cognito and SES are account-global services: there
// is no per-env boundary the way there is for a DynamoDB table with a
// resourceSuffix. A dev/staging role that falls back to Resource "*" for a
// sensitive action (e.g. because the env's pool id / verified domain wasn't
// known at synth) therefore reaches the PROD Cognito user pool or PROD SES
// identity, not just its own env. The three call sites this guard exists to
// protect (frontend SesSendAccess, frontend CognitoAdminUserErasure, backend
// reminder SES grant) were fixed to omit the grant entirely when the identity
// is unknown at synth (fail closed) instead of falling back to "*" — this
// Aspect is the belt-and-suspenders backstop: it fails ANY synth, in any
// stack, that reintroduces a "*" resource for one of these actions, so the
// protection doesn't depend solely on code review holding forever.
//
// Applied app-wide via `cdk.Aspects.of(app).add(new SensitiveWildcardGuard())`
// in bin/app.ts, so it runs against every stack and every env on every synth.

/** Actions that are account-global and must never be granted on Resource "*". */
export const SENSITIVE_ACTIONS = [
  "cognito-idp:AdminDeleteUser",
  "ses:SendEmail",
  "sesv2:SendEmail",
] as const;

interface RawStatement {
  readonly Effect?: unknown;
  readonly Action?: unknown;
  readonly Resource?: unknown;
}

interface RawPolicyDocument {
  readonly Statement?: unknown;
}

function toArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Does `actionPattern` (as it appears in a policy statement's Action) cover
 * `sensitiveAction`? Covers exactly the three forms FR-13 calls out: an exact
 * match, a service-level wildcard ("cognito-idp:*"), or the global wildcard
 * ("*"). Deliberately does NOT attempt partial/prefix wildcard matching
 * (e.g. "cognito-idp:AdminDelete*") — out of scope for this guard.
 */
function actionCoversSensitive(
  actionPattern: string,
  sensitiveAction: string,
): boolean {
  if (actionPattern === "*" || actionPattern === sensitiveAction) return true;
  const separatorIndex = actionPattern.indexOf(":");
  if (separatorIndex === -1) return false;
  const patternService = actionPattern.slice(0, separatorIndex);
  const patternAction = actionPattern.slice(separatorIndex + 1);
  const sensitiveService = sensitiveAction.slice(
    0,
    sensitiveAction.indexOf(":"),
  );
  return patternAction === "*" && patternService === sensitiveService;
}

/**
 * Returns the sensitive actions (a subset of SENSITIVE_ACTIONS) that `statement`
 * grants on a Resource of exactly "*". Empty array when the statement doesn't
 * Allow, doesn't touch Resource "*", or doesn't cover any sensitive action.
 */
function findSensitiveWildcardHits(statement: RawStatement): string[] {
  // Effect defaults to Allow when omitted; only Allow statements are a risk.
  if (statement.Effect !== undefined && statement.Effect !== "Allow") {
    return [];
  }

  const resources = toArray(statement.Resource);
  if (!resources.some((resource) => resource === "*")) return [];

  const actionPatterns = toArray(statement.Action).filter(
    (action): action is string => typeof action === "string",
  );

  const hits = new Set<string>();
  for (const actionPattern of actionPatterns) {
    for (const sensitiveAction of SENSITIVE_ACTIONS) {
      if (actionCoversSensitive(actionPattern, sensitiveAction)) {
        hits.add(sensitiveAction);
      }
    }
  }
  return [...hits];
}

/**
 * cdk.IAspect that fails synth closed whenever an IAM policy statement grants
 * a SENSITIVE_ACTIONS entry on Resource "*". Walks the three CloudFormation
 * shapes that can carry a policy document in this app: `AWS::IAM::Policy`
 * (iam.Policy / role.addToPolicy), `AWS::IAM::ManagedPolicy`, and the inline
 * `Policies` list embedded directly on `AWS::IAM::Role` (iam.Role's
 * `inlinePolicies` prop). Resolves the document via `cdk.Stack.of(node).resolve()`
 * so CDK tokens (Aws.ACCOUNT_ID, Fn::Join-built ARNs, etc.) are rendered to
 * their synth-time CloudFormation JSON before inspection — a properly scoped
 * ARN resolves to an intrinsic object, never the literal string "*", so it
 * never trips this guard.
 *
 * Never throws from `visit()`: a token-unresolvable or malformed document is
 * skipped rather than breaking synth for an unrelated reason. The guard's
 * only failure mode should be `Annotations.addError`, never an exception.
 */
export class SensitiveWildcardGuard implements cdk.IAspect {
  visit(node: IConstruct): void {
    try {
      this.checkNode(node);
    } catch {
      // Defensive no-op — see class doc comment.
    }
  }

  private checkNode(node: IConstruct): void {
    if (node instanceof iam.CfnRole) {
      this.checkRolePolicies(node);
      return;
    }
    if (node instanceof iam.CfnPolicy || node instanceof iam.CfnManagedPolicy) {
      this.checkDocument(node, node.policyDocument, undefined);
    }
  }

  private checkRolePolicies(node: iam.CfnRole): void {
    const resolvedPolicies = cdk.Stack.of(node).resolve(node.policies);
    if (!Array.isArray(resolvedPolicies)) return;
    for (const policy of resolvedPolicies) {
      if (!policy || typeof policy !== "object") continue;
      // NOTE: `resolve()` only resolves CDK Tokens — it runs BEFORE the
      // CfnResource-specific CloudFormation property-name translation
      // (camelCase -> PascalCase) that happens at render time. So the L1
      // `CfnRole.PolicyProperty` shape here is still camelCase
      // (policyName/policyDocument), unlike the final synthesized template.
      const { policyName, policyDocument } = policy as {
        policyName?: unknown;
        policyDocument?: unknown;
      };
      this.checkDocument(
        node,
        policyDocument,
        typeof policyName === "string" ? policyName : undefined,
      );
    }
  }

  private checkDocument(
    node: IConstruct,
    rawDocument: unknown,
    inlinePolicyName: string | undefined,
  ): void {
    const doc = cdk.Stack.of(node).resolve(rawDocument) as
      | RawPolicyDocument
      | undefined;
    if (!doc || typeof doc !== "object") return;

    const statements = toArray(doc.Statement) as RawStatement[];
    for (const statement of statements) {
      if (!statement || typeof statement !== "object") continue;
      const hits = findSensitiveWildcardHits(statement);
      if (hits.length === 0) continue;

      const path = node.node.path;
      const location = inlinePolicyName
        ? `${path} (inline policy "${inlinePolicyName}")`
        : path;
      cdk.Annotations.of(node).addError(
        `SensitiveWildcardGuard: IAM statement at ${location} grants ` +
          `${hits.join(", ")} on Resource "*". Fix: scope the resource to ` +
          "the env's identity/pool ARN or omit the grant when the identity " +
          'is unknown — "*" on an account-global service reaches prod from ' +
          "any env (WS6-003).",
      );
    }
  }
}
