"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// lambda/cognito-pre-signup.ts
var cognito_pre_signup_exports = {};
__export(cognito_pre_signup_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(cognito_pre_signup_exports);
var import_client_cognito_identity_provider = require("@aws-sdk/client-cognito-identity-provider");

// lambda/lib/apple-account-linking.ts
var COGNITO_NATIVE_PROVIDER = "Cognito";
var EXTERNAL_PROVIDER_TRIGGER = "PreSignUp_ExternalProvider";
function parseFederatedUserName(userName) {
  if (!userName) return null;
  const idx = userName.indexOf("_");
  if (idx <= 0 || idx === userName.length - 1) return null;
  return {
    providerName: userName.slice(0, idx),
    providerUserId: userName.slice(idx + 1)
  };
}
function isAppleProvider(providerName) {
  return providerName.toLowerCase().includes("apple");
}
function decideAppleLinking(event) {
  if (event.triggerSource !== EXTERNAL_PROVIDER_TRIGGER) {
    return { action: "skip", reason: "not_external_provider" };
  }
  const parsed = parseFederatedUserName(event.userName);
  if (!parsed) return { action: "skip", reason: "unparseable_username" };
  if (!isAppleProvider(parsed.providerName)) {
    return { action: "skip", reason: "not_apple" };
  }
  const attrs = event.request?.userAttributes ?? {};
  const email = (attrs.email ?? "").trim().toLowerCase();
  if (!email) return { action: "skip", reason: "no_email" };
  if (attrs.email_verified !== "true") {
    return { action: "skip", reason: "email_unverified" };
  }
  return {
    action: "attempt_link",
    email,
    providerName: parsed.providerName,
    providerUserId: parsed.providerUserId
  };
}
function chooseLinkTarget(candidates, incomingEmail) {
  const email = incomingEmail.trim().toLowerCase();
  const matches = candidates.filter((c) => {
    if ((c.email ?? "").trim().toLowerCase() !== email) return false;
    if (c.emailVerified !== "true") return false;
    if (c.identities && c.identities.trim() !== "" && c.identities.trim() !== "[]") {
      return false;
    }
    return true;
  });
  if (matches.length === 0) return { target: null, reason: "no_existing_native_user" };
  if (matches.length > 1) return { target: null, reason: "ambiguous_multiple_matches" };
  return { target: matches[0].username };
}
async function linkAppleAccount(event, deps) {
  const decision = decideAppleLinking(event);
  if (decision.action === "skip") {
    deps.log("apple_link_skip", { reason: decision.reason });
    return { status: "skipped", reason: decision.reason };
  }
  const candidates = await deps.listUsersByEmail(decision.email);
  const choice = chooseLinkTarget(candidates, decision.email);
  if (choice.target === null) {
    deps.log("apple_link_skip", { reason: choice.reason, email: decision.email });
    return { status: "skipped", reason: choice.reason };
  }
  try {
    await deps.linkProvider({
      destinationUsername: choice.target,
      appleProviderUserId: decision.providerUserId,
      appleProviderName: decision.providerName
    });
  } catch (error) {
    deps.log("apple_link_failed", {
      target: choice.target,
      email: decision.email,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
  deps.log("apple_link_ok", { target: choice.target, email: decision.email });
  return { status: "linked", target: choice.target };
}

// lambda/cognito-pre-signup.ts
var cognito = new import_client_cognito_identity_provider.CognitoIdentityProviderClient({});
function attr(attributes, name) {
  return attributes?.find((a) => a.Name === name)?.Value;
}
function safeEmailFilter(email) {
  return email.replace(/["\\]/g, "");
}
async function handler(event) {
  const userPoolId = event.userPoolId;
  await linkAppleAccount(event, {
    listUsersByEmail: async (email) => {
      if (!userPoolId) return [];
      const res = await cognito.send(
        new import_client_cognito_identity_provider.ListUsersCommand({
          UserPoolId: userPoolId,
          Filter: `email = "${safeEmailFilter(email)}"`,
          Limit: 10
        })
      );
      return (res.Users ?? []).map((u) => ({
        username: u.Username ?? "",
        email: attr(u.Attributes, "email")?.toLowerCase(),
        emailVerified: attr(u.Attributes, "email_verified"),
        identities: attr(u.Attributes, "identities")
      }));
    },
    linkProvider: async ({ destinationUsername, appleProviderUserId, appleProviderName }) => {
      if (!userPoolId) throw new Error("missing userPoolId on PreSignUp event");
      await cognito.send(
        new import_client_cognito_identity_provider.AdminLinkProviderForUserCommand({
          UserPoolId: userPoolId,
          // The existing native user to keep as the single account.
          DestinationUser: {
            ProviderName: COGNITO_NATIVE_PROVIDER,
            ProviderAttributeValue: destinationUsername
          },
          // The incoming Apple federated identity, keyed by its `sub`.
          SourceUser: {
            ProviderName: appleProviderName,
            ProviderAttributeName: "Cognito_Subject",
            ProviderAttributeValue: appleProviderUserId
          }
        })
      );
    },
    log: (marker, fields) => console.log(JSON.stringify({ marker, ...fields }))
  });
  return event;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
