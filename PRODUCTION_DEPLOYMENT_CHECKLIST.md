# Production Deployment Checklist

This checklist covers the manual actions required to launch the current Cloud Portfolio and Book Accelerator stack in production. It is based on the code that exists in this repository today.

## 1. Pre deploy verification

Run these commands from the repository root before any production deploy:

```bash
npm install
npm --prefix infra install
npm run verify
npm run test:pdf-fill
npm --prefix infra run build
npm --prefix infra run cdk -- synth
```

If any command fails, fix that first. Do not deploy around a failing verification step.

## 2. Required application environment variables

Set these in the web runtime environment for production:

### Auth and app routing
- `APP_BASE_URL`
- `NEXT_PUBLIC_SITE_URL`
- `COGNITO_DOMAIN`
- `COGNITO_CUSTOM_DOMAIN` if using a custom hosted UI domain
- `COGNITO_CLIENT_ID`
- `COGNITO_REDIRECT_URI`
- `COGNITO_LOGOUT_REDIRECT_URI`
- `COGNITO_REGION`
- `COGNITO_USER_POOL_ID`

### AWS runtime
- `AWS_REGION`
- `AWS_DEFAULT_REGION` if your host requires it
- `SECURE_DOC_TABLE`
- `RAW_BUCKET`
- `OUTPUT_BUCKET`
- `CONVERT_SFN_ARN`
- `WEB_ALLOWED_ORIGINS`

### Optional server side config lookup
- `SSM_PARAMETER_PREFIX` if you want the server to load secrets and config from AWS SSM Parameter Store

### Book Accelerator
- `BOOK_TABLE_NAME` if different from `SECURE_DOC_TABLE`
- `BOOK_INGEST_BUCKET` if different from `RAW_BUCKET`
- `BOOK_CONTENT_BUCKET` if different from `OUTPUT_BUCKET`
- `BOOK_ADMIN_GROUP`
- `BOOK_FREE_SLOTS_DEFAULT`
- `BOOK_PAYWALL_PRICE`

### Billing
- `BOOK_STRIPE_SECRET_KEY`
- `BOOK_STRIPE_PRICE_ID`
- `BOOK_STRIPE_WEBHOOK_SECRET`

### Admin allowlists for the main app surface
- `ADMIN_SUBS`
- `ADMIN_EMAILS`

### Safety
- `DEV_AUTH_BYPASS=0`
- `ALLOW_APP_BASE_URL_IN_DEV=0`

Use `.env.example` as the starting shape for local and hosted environment configuration.

## 3. Cognito setup

The application expects Cognito Hosted UI and signed `id_token` cookies.

Create or verify the following in Cognito:

1. A user pool in the same region as `COGNITO_REGION`
2. An app client whose id matches `COGNITO_CLIENT_ID`
3. Hosted UI domain configured through:
   - `COGNITO_DOMAIN`, or
   - `COGNITO_CUSTOM_DOMAIN` if you front it with your own domain
4. Callback URLs:
   - `https://your-domain/auth/callback`
   - local callback URL if you still use local dev login
5. Sign out URLs:
   - `https://your-domain/`
   - local sign out URL if needed
6. User group for Book admin access:
   - group name must match `BOOK_ADMIN_GROUP`

### Admin users

There are two admin paths in this repo:

- General app admin checks use `ADMIN_SUBS` and `ADMIN_EMAILS`
- Book ingestion admin checks use Cognito group membership via `BOOK_ADMIN_GROUP`

Make sure the intended production admin accounts are configured in both places where needed.

## 4. AWS infrastructure

This repo includes CDK based infrastructure under `infra/`.

### One time AWS setup

1. Bootstrap CDK in the target account and region if not already done:

```bash
npm --prefix infra run cdk -- bootstrap aws://<ACCOUNT_ID>/<REGION>
```

2. Confirm the target account has permission to manage:
   - DynamoDB
   - S3
   - Step Functions
   - Lambda
   - any IAM roles used by the stack

### Deploy the infra stack

```bash
npm --prefix infra run cdk -- deploy <STACK_NAME> --require-approval never
```

After deploy, capture the live resource names and update the application environment variables if they differ from your expected values.

## 5. Stripe billing setup

Book Accelerator billing is server enforced through Stripe checkout, portal, and webhook handlers.

Create or verify:

1. A recurring Stripe price whose id matches `BOOK_STRIPE_PRICE_ID`
2. A live secret key stored as `BOOK_STRIPE_SECRET_KEY`
3. A webhook endpoint pointed at:

```text
https://your-domain/app/api/book/billing/webhook
```

4. Subscribe the webhook to these events at minimum:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.paid`

5. Set the webhook signing secret in `BOOK_STRIPE_WEBHOOK_SECRET`

Before launch, test:
- upgrade flow
- billing portal flow
- webhook delivery
- entitlement downgrade handling

## 6. Book content ingestion

Book Accelerator runtime content is published from strict package JSON files.

### Buckets

Make sure:
- `BOOK_INGEST_BUCKET` accepts the raw uploaded package
- `BOOK_CONTENT_BUCKET` stores the published manifest, chapter payloads, and quiz payloads

### Admin ingest flow

Use the existing upload script once an admin user can sign in and obtain a Cognito id token:

```bash
node scripts/book/upload-book-package.mjs \
  --origin https://your-domain \
  --token <admin_id_token> \
  --file book-packages/<package>.json \
  --publish
```

If you use the convenience env, set:
- `BOOK_ADMIN_TOKEN`

After ingestion, verify that:
- the admin ingest job succeeds
- the book appears in the catalog
- chapter payloads load from published content

## 7. Web deployment steps

This repo does not hardcode a single web host. For any host you choose:

1. Build with Node 20 or newer
2. Provide all production environment variables listed above
3. Ensure the runtime can reach:
   - Cognito
   - DynamoDB
   - S3
   - Step Functions
   - Stripe
4. Deploy the Next.js app with server route support
5. Confirm the deployed domain matches:
   - `APP_BASE_URL`
   - `NEXT_PUBLIC_SITE_URL`
   - Cognito callback and logout URLs
   - Stripe success, cancel, and return flows

## 8. Post deploy smoke test

Run these checks against the deployed app:

### Auth
- sign in
- sign out
- session persists across refresh
- protected routes under `/app`, `/book`, and `/dashboard` redirect correctly when unauthenticated

### Book Accelerator
- onboarding loads
- library search, category filters, pagination, and saved state work
- saved books appear on `/book/saved`
- book detail page loads and can save or unsave a book
- chapter reader loads content
- actual reading time increments only during active reading
- quiz submission persists
- progress page shows only engaged books
- profile stats and settings persist after refresh
- badge surfaces load and update
- checkout and billing portal buttons behave correctly based on Stripe configuration

### Cloud Portfolio
- project list loads
- file upload works
- conversion job starts
- converted outputs appear
- PDF fill flow still works

## 9. Operational notes

- Keep `DEV_AUTH_BYPASS` disabled in every shared or production environment
- Do not expose secret keys to the browser
- Prefer SSM backed secrets in deployed environments
- Book access and entitlements must remain server enforced
- Re run `npm run verify` before each release candidate if you are not using automated CI gates yet

## 10. Recommended first production release policy

For the first live release:

1. Deploy infra first
2. Deploy web second
3. Validate auth
4. Validate Book billing webhook delivery
5. Validate one admin content ingestion
6. Validate one end to end reader flow with reading time and quiz persistence
7. Only then open the app to non admin traffic
