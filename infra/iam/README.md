# Generated IAM deployment artifacts

The former tracked `trust.json` and `github-actions-dev-policy.json` files were
operational references: an owner could apply them to IAM, but nothing in the
repository consumed them automatically. Because those outputs are tied to one
AWS account and deployment environment, the repository now tracks the
values-free generator and tests instead of account-bound JSON.
AWS account ids in these documents are low-sensitivity portability
configuration, not authentication secrets.

From `infra/`, generate directly applicable JSON with environment-scoped
configuration:

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
- `iam/generated/github-actions-<env>-policy.json`

The generated directory is ignored. Review each output before the owner
applies it; generation does not call AWS or GitHub. The trust keeps the exact
`dev`, `staging`, and `prod` GitHub Environment subjects. The permission policy
targets only the matching environment's seed table and the account/region's CDK
bootstrap roles and version parameter.

Applying the generated files, configuring role ARNs, and proving positive and
negative role assumptions remain manual operations. To roll back after an
applied change, regenerate the prior environment policy from the prior known
configuration and restore the prior IAM role policy/trust through the normal
owner-reviewed process; reverting repository files alone does not mutate IAM.
