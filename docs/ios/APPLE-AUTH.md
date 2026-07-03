# Sign in with Apple — revoke-on-delete + account linking (B8)

Two Apple-critical auth behaviors the native iOS app depends on. Both are
implemented server-side in this web repo; the iOS app only triggers them.

- **Revoke on delete** — App Review **requires** that deleting an account also
  revokes the user's Apple token for any app offering Sign in with Apple.
- **Account linking** — a federated Apple sign-in for an email that already
  exists as a native (email/password) Cognito user must land in the **same**
  account, not create a second `sub` that splits the person's books, progress,
  and entitlement.

---

## 1. Revoke on delete

### What happens

`POST /book/me/account/delete` ([route](../../app/app/api/book/me/account/delete/route.ts)),
after committing the soft-delete and revoking Cognito sessions, calls
[`revokeAppleIdentityOnDelete`](../../app/app/api/book/_lib/apple-auth.ts):

1. Resolve the Cognito user by `sub` (a federated user's `Username` is
   `SignInWithApple_<id>`, so we look up via a `sub` filter) and check whether it
   has a linked Apple identity — via the `identities` attribute **or** the
   `SignInWithApple_` username prefix.
2. If **no Apple identity** → skip (`apple_revoke_skip reason=no_apple_identity`).
3. Load the stored Apple **refresh token** (see [§1.3](#13-where-the-apple-token-comes-from)).
   If none is held → skip (`reason=no_token`).
4. Mint an ES256 **client-secret JWT** signed with the `APPLE_*` key config and
   `POST` it to `https://appleid.apple.com/auth/revoke` with the user's token.

The revoke request construction and skip decisions are pure and unit-tested in
[`apple-auth-core.test.ts`](../../app/app/api/book/_lib/apple-auth-core.test.ts).

### Best-effort but observable

The revoke runs **after** the authoritative soft-delete has committed and
**never** blocks or fails the deletion. Every outcome emits a greppable
CloudWatch marker:

| Marker | Meaning |
|---|---|
| `apple_revoke_ok` | Apple returned 200; token revoked. |
| `apple_revoke_skip` | Not attempted (`no_apple_identity` / `no_token` / `not_configured`). |
| `apple_revoke_retry` | A transient failure (5xx/429); retried once. |
| `apple_revoke_failed` | Apple-linked + token held, but revoke failed after retries. |

A `failed` outcome is additionally recorded as an **ops-failure**
(`kind: "apple_token_revoke"`, context `account_delete`) so an operator can
follow up and re-revoke. 4xx responses are treated as terminal (no retry);
5xx/429 get one cheap retry.

### 1.3 Where the Apple token comes from

Revoking a token requires **holding** one. This is the crux:

- **Cognito hosted-UI federation** (today's web sign-in) performs the Apple
  code↔token exchange **inside Cognito** and never exposes Apple's refresh token
  to us — so for a hosted-UI-only Apple user there is nothing to revoke, and the
  delete logs `apple_revoke_skip reason=no_token`. That is expected.
- The **native iOS** Sign-in-with-Apple flow returns an authorization code that
  the backend can exchange with Apple for a **refresh token**. That flow persists
  the token via
  [`putAppleRefreshToken`](../../app/app/api/book/_lib/apple-token-store.ts)
  (item `PK=BOOKUSER#<sub>, SK=APPLE#IDENTITY`), and deletion then revokes it.

The token item lives under the user's partition, so account **erasure** already
sweeps it away with the rest of the user's data.

### 1.4 Env config (`APPLE_*`, shared with B3)

| Var | JWT role | Notes |
|---|---|---|
| `APPLE_ISSUER_ID` | `iss` | Apple Developer **Team ID** (10 chars). |
| `APPLE_BUNDLE_ID` | `sub` / `client_id` | The Services ID / bundle id (the OAuth client). |
| `APPLE_KEY_ID` | header `kid` | Key id of the `.p8` AuthKey. |
| `APPLE_PRIVATE_KEY` | signing key | PKCS#8 PEM of the `.p8`; literal `\n` tolerated. |

When any is unset the revoke is skipped (`reason=not_configured`) — the delete
still succeeds. These are the **same** four values B3 (Apple IAP) uses; define
them once as prod GitHub Environment secrets (also listed in
[ENVIRONMENT.md](../ENVIRONMENT.md)).

**App Store Connect setup:** Certificates, Identifiers & Profiles → Keys → create
a key with **Sign in with Apple** enabled → download the `.p8` (once) → its Key ID
is `APPLE_KEY_ID`, your Team ID is `APPLE_ISSUER_ID`, and the Services ID / app
bundle id configured for Sign in with Apple is `APPLE_BUNDLE_ID`.

---

## 2. Account linking (Cognito PreSignUp trigger)

### The problem

Cognito treats a federated Apple identity and a native email/password user as
**separate** users with different `sub`s — even when they share the same email.
So a user who signed up with email/password and later taps "Sign in with Apple"
would get a **second** account, splitting their library, progress, and Pro
entitlement.

### The fix

A **PreSignUp Lambda trigger**
([`cognito-pre-signup.ts`](../../infra/lambda/cognito-pre-signup.ts), logic in
[`apple-account-linking.ts`](../../infra/lambda/lib/apple-account-linking.ts))
runs before Cognito creates the federated user. When it's the Apple IdP flow with
a **verified matching email**, it links the Apple identity into the existing
native user via `AdminLinkProviderForUser` instead of creating a new one.

### Decision logic (unit-tested)

1. Only act on `triggerSource === "PreSignUp_ExternalProvider"`.
2. Only the **Apple** provider (parsed from the `<Provider>_<id>` username).
3. Email must be present and **`email_verified === "true"`**. An **unverified**
   email must **never** link — that would let anyone asserting an email hijack
   the matching account. Unverified → skip + log (`apple_link_skip
   reason=email_unverified`), and normal sign-up proceeds.
4. `ListUsers` by that email; choose a link target only if there is **exactly
   one** match that is a **native** user (no `identities` attribute) whose own
   email is **verified**. Zero matches → let sign-up proceed; ambiguous (>1) →
   skip + log.
5. `AdminLinkProviderForUser` with:
   - `DestinationUser`: `{ ProviderName: "Cognito", ProviderAttributeValue: <existing username> }`
   - `SourceUser`: `{ ProviderName: "SignInWithApple", ProviderAttributeName: "Cognito_Subject", ProviderAttributeValue: <Apple sub> }`

**Fail-closed:** if the link call errors, the trigger **rethrows** so Cognito
**aborts** the sign-up rather than silently creating the split account this
trigger exists to prevent. A transient error succeeds on the user's retry; a
persistent one is immediately visible (CloudWatch alarm
`ChapterFlowCognitoPreSignUpErrorsAlarm`). The trade-off is deliberate: a blocked
retry beats a permanent, invisible account split.

Markers: `apple_link_ok`, `apple_link_skip` (with `reason`), `apple_link_failed`.

### Why linking is safe

`AdminLinkProviderForUser` merges the Apple login into the existing password
account. We link **only** when Apple asserts the incoming email is verified **and**
the existing native account's email is itself verified — i.e. both sides provably
control the same mailbox. This is Cognito's standard linking recipe.

### Edge cases

| Case | Behavior |
|---|---|
| Apple email is Apple's **private relay** (`@privaterelay.appleid.com`) | Apple still marks it `email_verified=true`; it links only if a native account uses that exact relay address (unusual) — otherwise no match, normal sign-up. |
| User **hid** their email / no email in the assertion | `no_email` → skip; sign-up proceeds as a fresh Apple account. |
| Existing account is **also federated** (e.g. Google) | Not a native destination → skip (no `Cognito` link target). |
| **Two** native users share the email | `ambiguous_multiple_matches` → skip + log; a human must resolve. |
| Existing native email **unverified** | Not a valid target → skip (prevents takeover of an unconfirmed account). |
| Apple email **unverified** | Skip before any lookup. |

---

## 3. Infra + one-time pool wiring

The Cognito user pool is **external** to this CDK (referenced by the
`COGNITO_USER_POOL_ID` secret). The backend stack
([`chapterflow-backend-stack.ts`](../../infra/lib/chapterflow-backend-stack.ts))
therefore provisions, **only when that id is known at synth**:

- the `ChapterFlowCognitoPreSignUp` Lambda (bundled to `lambda/dist`),
- **scoped IAM** — only `cognito-idp:ListUsers` + `cognito-idp:AdminLinkProviderForUser`, restricted to **this** pool's ARN,
- a `lambda:InvokeFunction` permission for `cognito-idp.amazonaws.com`, scoped by `SourceArn`/`SourceAccount` to this pool,
- an errors alarm on the ops SNS topic,
- a `CognitoPreSignUpFunctionArn` stack output.

Because the pool isn't CDK-managed, its **PreSignUp trigger must be wired once**
to the function ARN (CDK can't set an external pool's `LambdaConfig`):

```bash
FN_ARN="$(aws cloudformation describe-stacks \
  --stack-name ChapterFlowBackend \
  --query "Stacks[0].Outputs[?OutputKey=='CognitoPreSignUpFunctionArn'].OutputValue" \
  --output text)"

aws cognito-idp update-user-pool \
  --user-pool-id "$COGNITO_USER_POOL_ID" \
  --lambda-config "PreSignUp=$FN_ARN"
```

> `update-user-pool` **replaces** the whole pool config — first
> `describe-user-pool` and merge any existing `LambdaConfig`/settings so you don't
> drop them.

Re-bundle the handler after any change:

```bash
cd infra
npx esbuild lambda/cognito-pre-signup.ts --bundle --platform=node \
  --target=node20 --outfile=lambda/dist/cognito-pre-signup.js \
  --external:@aws-sdk/client-cognito-identity-provider
```

### Cognito IdP setup (Sign in with Apple)

In the Cognito user pool → Sign-in experience → Federated identity provider
sign-in → add **Apple**: provide the Services ID (`client_id`), Team ID, Key ID,
and the `.p8` private key; map the Apple `email` claim to the pool `email`
attribute and `email_verified` to `email_verified`. Add `SignInWithApple` to the
app client's identity providers (this repo's `/auth/login` already allow-lists it).

---

## 4. Manual verification (test pool)

1. **Linking.** In a test pool with Apple federation configured and the PreSignUp
   trigger wired: create a native user `test@yourdomain.com` (verified). Then run
   the Sign-in-with-Apple flow for the **same** verified email. Confirm in the
   Cognito console that **no second user** was created and the original user now
   lists a linked `SignInWithApple` identity (same `sub`). Repeat with an
   **unverified**/hidden email and confirm it does **not** link (a fresh Apple
   user is created and `apple_link_skip` is logged).
2. **Revoke.** With `APPLE_*` set and an Apple refresh token stored for a test
   user, call `POST /book/me/account/delete` and confirm `apple_revoke_ok` in the
   logs (Apple returns 200 empty). With no token stored, confirm the delete still
   succeeds and logs `apple_revoke_skip reason=no_token`.
