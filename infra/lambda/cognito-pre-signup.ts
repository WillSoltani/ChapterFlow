// Cognito PreSignUp Lambda trigger — Sign-in-with-Apple account linking.
//
// Without this, a federated Apple sign-in for an email that already exists as a
// native (email/password) Cognito user creates a SECOND user with a different
// `sub`, splitting the person's books/progress/entitlement across two accounts.
// This trigger detects that case (Apple IdP + VERIFIED matching email) and links
// the Apple identity into the existing native user via AdminLinkProviderForUser
// instead of letting a duplicate be created.
//
// The decision + orchestration logic lives in ./lib/apple-account-linking.ts and
// is unit-tested there. This file only wires the real Cognito SDK calls.
//
// IAM (granted in infra CDK, scoped to THIS pool): cognito-idp:ListUsers,
// cognito-idp:AdminLinkProviderForUser.

import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminLinkProviderForUserCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  linkAppleAccount,
  COGNITO_NATIVE_PROVIDER,
  type CandidateUser,
  type PreSignUpEventLike,
} from "./lib/apple-account-linking";

const cognito = new CognitoIdentityProviderClient({});

/** Attribute value by name from a ListUsers user's Attributes array. */
function attr(
  attributes: { Name?: string; Value?: string }[] | undefined,
  name: string
): string | undefined {
  return attributes?.find((a) => a.Name === name)?.Value;
}

/** Escape the email for interpolation into a Cognito SCIM ListUsers filter. */
function safeEmailFilter(email: string): string {
  return email.replace(/["\\]/g, "");
}

export async function handler(
  event: PreSignUpEventLike & { userPoolId?: string }
): Promise<PreSignUpEventLike> {
  const userPoolId = event.userPoolId;

  await linkAppleAccount(event, {
    listUsersByEmail: async (email) => {
      if (!userPoolId) return [];
      const res = await cognito.send(
        new ListUsersCommand({
          UserPoolId: userPoolId,
          Filter: `email = "${safeEmailFilter(email)}"`,
          Limit: 10,
        })
      );
      return (res.Users ?? []).map<CandidateUser>((u) => ({
        username: u.Username ?? "",
        email: attr(u.Attributes, "email")?.toLowerCase(),
        emailVerified: attr(u.Attributes, "email_verified"),
        identities: attr(u.Attributes, "identities"),
      }));
    },
    linkProvider: async ({ destinationUsername, appleProviderUserId, appleProviderName }) => {
      if (!userPoolId) throw new Error("missing userPoolId on PreSignUp event");
      await cognito.send(
        new AdminLinkProviderForUserCommand({
          UserPoolId: userPoolId,
          // The existing native user to keep as the single account.
          DestinationUser: {
            ProviderName: COGNITO_NATIVE_PROVIDER,
            ProviderAttributeValue: destinationUsername,
          },
          // The incoming Apple federated identity, keyed by its `sub`.
          SourceUser: {
            ProviderName: appleProviderName,
            ProviderAttributeName: "Cognito_Subject",
            ProviderAttributeValue: appleProviderUserId,
          },
        })
      );
    },
    log: (marker, fields) => console.log(JSON.stringify({ marker, ...fields })),
  });

  // Cognito requires the (possibly mutated) event echoed back.
  return event;
}
