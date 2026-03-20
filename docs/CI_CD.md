# Author: Will Soltani

# CI/CD Setup Guide

This guide explains the CI/CD pipeline added to this repository and how to run it safely as a beginner.

## 1) What was added

Two GitHub Actions workflows were added:

- `.github/workflows/ci.yml`
  - Runs on pull requests and pushes to `main` and `codex/**`.
  - Job 1: app checks (`npm ci`, `npm run build`, `npm run test:pdf-fill`).
  - Job 2: infra checks (`npm ci` in `infra`, `npm run build`, `cdk synth`).

- `.github/workflows/deploy-infra-dev.yml`
  - Deploys infra to AWS on pushes to `main` when `infra/**` changes.
  - Can also run manually from GitHub Actions (`workflow_dispatch`).
  - Uses GitHub OIDC + an IAM role (`AWS_ROLE_TO_ASSUME_DEV`).
  - Deploy command: `cdk deploy ChapterFlowBackend --require-approval never`.

## 2) CI/CD flow in plain language

1. You push code or open a PR.
2. GitHub starts the CI workflow.
3. If build/tests/synth fail, merge is blocked (recommended branch protection).
4. After merge to `main` with infra changes, deploy workflow runs and updates AWS.

This reduces manual deploy risk and catches regressions earlier.

## 3) One-time AWS setup (required for deploy workflow)

You need to set up GitHub OIDC trust in AWS once.

### Step A: Create GitHub OIDC provider in IAM (if not already created)

- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

### Step B: Create IAM role for GitHub Actions deploys

Create a role (example name: `GitHubActionsChapterFlowDevDeployRole`) that trusts GitHub OIDC.

Example trust policy (replace placeholders):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": [
            "repo:<GITHUB_OWNER>/<GITHUB_REPO>:ref:refs/heads/main",
            "repo:<GITHUB_OWNER>/<GITHUB_REPO>:pull_request",
            "repo:<GITHUB_OWNER>/<GITHUB_REPO>:ref:refs/heads/codex/*"
          ]
        }
      }
    }
  ]
}
```

Attach permissions required for CDK deploy of this stack.

For least privilege, start with a scoped policy for resources this stack manages. If you are just getting started, use an admin-level deploy role temporarily in dev, then tighten it.

### Step C: Bootstrap CDK environment (one time per account/region)

Run locally:

```bash
npm --prefix infra ci
npm --prefix infra run cdk -- bootstrap aws://<AWS_ACCOUNT_ID>/us-east-1
```

## 4) GitHub repository settings you must add

In GitHub:

- Go to `Settings -> Secrets and variables -> Actions -> New repository secret`
  - Add secret:
  - `AWS_ROLE_TO_ASSUME_DEV` = full role ARN
  - Example: `arn:aws:iam::<AWS_ACCOUNT_ID>:role/GitHubActionsChapterFlowDevDeployRole`

Optional variables (if you later make workflows env-driven):
- `AWS_REGION`
- `CDK_STACK_NAME`

## 5) Recommended branch protection

In GitHub branch protection for `main`:

- Require pull request before merging.
- Require status checks to pass before merging.
- Select checks from `CI` workflow:
  - `App Build + Tests`
  - `Infra Build + CDK Synth`

## 6) How to use it day-to-day

- Feature branch flow:
  1. Create branch.
  2. Push commits.
  3. Open PR.
  4. Wait for `CI` checks to pass.
  5. Merge PR.

- Infra deploy flow:
  1. Merge infra changes to `main`.
  2. `Deploy Infra (Dev)` runs automatically.
  3. Verify resources in AWS console / CloudWatch.

- Manual deploy:
  - Open `Actions -> Deploy Infra (Dev) -> Run workflow`.

## 7) Troubleshooting

### Deploy fails with "Could not assume role"

- Check `AWS_ROLE_TO_ASSUME_DEV` secret value.
- Check trust policy `sub` matches your repo and branch.
- Confirm OIDC provider exists in IAM.

### CDK deploy fails with bootstrap error

- Run CDK bootstrap command from section 3C.

### CI fails on build/tests

- Reproduce locally:

```bash
npm ci
npm run build
npm run test:pdf-fill
npm --prefix infra ci
npm --prefix infra run build
npm --prefix infra run cdk -- synth
```

## 8) Safe next steps

Once this is stable, expand gradually:

1. Add a separate production deploy workflow with manual approval.
2. Add integration tests for book ingestion and ChapterFlow backend migrations.
3. Add notifications (Slack/email) for deploy failures.
4. Tighten IAM policies for the deploy role.
