# Generated IAM trust and additive permissions

The former tracked `trust.json` and `github-actions-dev-policy.json` files were
operational references: an owner could apply them to IAM, but nothing in the
repository consumed them automatically. Because those outputs are tied to one
AWS account and deployment environment, the repository now tracks the
values-free generator and tests instead of account-bound JSON.
AWS account ids in these documents are low-sensitivity portability
configuration, not authentication secrets.

From `infra/`, generate validated, environment-bound JSON:

```bash
CDK_DEFAULT_ACCOUNT="$AWS_ACCOUNT_ID" \
CHAPTERFLOW_ENV=dev \
AWS_REGION=us-east-1 \
GITHUB_REPOSITORY=WillSoltani/ChapterFlow \
npx tsx bin/generate-iam-config.ts
```

`CHAPTERFLOW_ENV` must be `dev`, `staging`, or `prod`. The optional
`CDK_BOOTSTRAP_QUALIFIER` defaults to the standard `hnb659fds`. The generator
validates every input and round-trips both documents through `JSON.parse`
before atomically writing:

- `iam/generated/trust.json`
- `iam/generated/github-actions-<env>-additive-policy.json`

The generated directory is ignored. Review each output before the owner
applies it; generation does not call AWS or GitHub. The trust keeps the exact
`dev`, `staging`, and `prod` GitHub Environment subjects.

The additive policy is intentionally **not** a complete replacement for the
deploy role's existing permissions. It covers the account/region's CDK
bootstrap roles and version parameter plus the matching environment's seed
table. Preserve separately reviewed companion permissions for direct workflow
calls that do not run through a CDK bootstrap role:

- `ssm:GetParameter` for the `/chapterflow/<env>/` resource-name parameters;
- `cloudformation:DescribeStacks` for the environment's frontend stack;
- `cloudfront:CreateInvalidation` and `cloudfront:GetInvalidation` for its
  distribution; and
- the DynamoDB and S3 data-plane actions used by the selected seed/publish
  helpers (the generated fragment includes only its stated DynamoDB subset and
  grants no S3 access).

Review the current `_deploy-app.yml`, `_deploy-infra.yml`, and invoked publish
helpers before changing those companion policies. Applying only the generated
additive policy to an otherwise unprivileged role cannot run the deployment
workflows.

Applying the generated files, configuring role ARNs, and proving positive and
negative role assumptions remain manual operations. To roll back after an
applied change, regenerate the prior environment policy from the prior known
configuration and restore the prior IAM role policy/trust through the normal
owner-reviewed process; reverting repository files alone does not mutate IAM.
