import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chooseLinkTarget,
  decideAppleLinking,
  linkAppleAccount,
  parseFederatedUserName,
  type CandidateUser,
  type LinkingDeps,
  type PreSignUpEventLike,
} from "./apple-account-linking";

test("parseFederatedUserName splits provider and id, rejects malformed", () => {
  assert.deepEqual(parseFederatedUserName("SignInWithApple_001234.abcdef"), {
    providerName: "SignInWithApple",
    providerUserId: "001234.abcdef",
  });
  assert.equal(parseFederatedUserName("noseparator"), null);
  assert.equal(parseFederatedUserName("_leading"), null);
  assert.equal(parseFederatedUserName("trailing_"), null);
  assert.equal(parseFederatedUserName(undefined), null);
});

function appleEvent(overrides: Partial<PreSignUpEventLike> = {}): PreSignUpEventLike {
  return {
    triggerSource: "PreSignUp_ExternalProvider",
    userName: "SignInWithApple_001234.abcdef",
    request: { userAttributes: { email: "User@Example.com", email_verified: "true" } },
    ...overrides,
  };
}

test("decideAppleLinking: happy path → attempt_link with normalized email", () => {
  const d = decideAppleLinking(appleEvent());
  assert.equal(d.action, "attempt_link");
  if (d.action === "attempt_link") {
    assert.equal(d.email, "user@example.com");
    assert.equal(d.providerName, "SignInWithApple");
    assert.equal(d.providerUserId, "001234.abcdef");
  }
});

test("decideAppleLinking: skips non-external / non-Apple / unverified / no-email", () => {
  assert.deepEqual(decideAppleLinking(appleEvent({ triggerSource: "PreSignUp_SignUp" })), {
    action: "skip",
    reason: "not_external_provider",
  });
  assert.deepEqual(
    decideAppleLinking(appleEvent({ userName: "Google_1122" })),
    { action: "skip", reason: "not_apple" }
  );
  assert.deepEqual(
    decideAppleLinking(
      appleEvent({ request: { userAttributes: { email: "a@b.com", email_verified: "false" } } })
    ),
    { action: "skip", reason: "email_unverified" }
  );
  assert.deepEqual(
    decideAppleLinking(
      appleEvent({ request: { userAttributes: { email_verified: "true" } } })
    ),
    { action: "skip", reason: "no_email" }
  );
});

test("chooseLinkTarget: links to the single verified native match", () => {
  const candidates: CandidateUser[] = [
    { username: "native-1", email: "user@example.com", emailVerified: "true" },
  ];
  assert.deepEqual(chooseLinkTarget(candidates, "User@Example.com"), { target: "native-1" });
});

test("chooseLinkTarget: skips unverified, federated, non-matching, and ambiguous", () => {
  // unverified existing account
  assert.deepEqual(
    chooseLinkTarget([{ username: "u", email: "user@example.com", emailVerified: "false" }], "user@example.com"),
    { target: null, reason: "no_existing_native_user" }
  );
  // existing account is itself federated
  assert.deepEqual(
    chooseLinkTarget(
      [{ username: "u", email: "user@example.com", emailVerified: "true", identities: '[{"providerName":"Google"}]' }],
      "user@example.com"
    ),
    { target: null, reason: "no_existing_native_user" }
  );
  // no email match
  assert.deepEqual(
    chooseLinkTarget([{ username: "u", email: "other@example.com", emailVerified: "true" }], "user@example.com"),
    { target: null, reason: "no_existing_native_user" }
  );
  // ambiguous: two verified native matches
  assert.deepEqual(
    chooseLinkTarget(
      [
        { username: "a", email: "user@example.com", emailVerified: "true" },
        { username: "b", email: "user@example.com", emailVerified: "true" },
      ],
      "user@example.com"
    ),
    { target: null, reason: "ambiguous_multiple_matches" }
  );
});

test("chooseLinkTarget: empty identities string/[] still counts as native", () => {
  assert.deepEqual(
    chooseLinkTarget([{ username: "u", email: "user@example.com", emailVerified: "true", identities: "[]" }], "user@example.com"),
    { target: "u" }
  );
});

// ---- linkAppleAccount orchestration --------------------------------------

function makeDeps(overrides: Partial<LinkingDeps> = {}): {
  deps: LinkingDeps;
  linkCalls: unknown[];
  logs: { event: string; fields: Record<string, unknown> }[];
} {
  const linkCalls: unknown[] = [];
  const logs: { event: string; fields: Record<string, unknown> }[] = [];
  const deps: LinkingDeps = {
    listUsersByEmail: async () => [
      { username: "native-1", email: "user@example.com", emailVerified: "true" },
    ],
    linkProvider: async (p) => {
      linkCalls.push(p);
    },
    log: (event, fields) => logs.push({ event, fields }),
    ...overrides,
  };
  return { deps, linkCalls, logs };
}

test("linkAppleAccount: links a verified Apple sign-in to the existing native user", async () => {
  const { deps, linkCalls } = makeDeps();
  const outcome = await linkAppleAccount(appleEvent(), deps);
  assert.deepEqual(outcome, { status: "linked", target: "native-1" });
  assert.deepEqual(linkCalls, [
    {
      destinationUsername: "native-1",
      appleProviderUserId: "001234.abcdef",
      appleProviderName: "SignInWithApple",
    },
  ]);
});

test("linkAppleAccount: no directory match → skipped, no link call", async () => {
  const { deps, linkCalls } = makeDeps({ listUsersByEmail: async () => [] });
  const outcome = await linkAppleAccount(appleEvent(), deps);
  assert.deepEqual(outcome, { status: "skipped", reason: "no_existing_native_user" });
  assert.equal(linkCalls.length, 0);
});

test("linkAppleAccount: unverified Apple email → skipped before any lookup", async () => {
  let looked = 0;
  const { deps } = makeDeps({
    listUsersByEmail: async () => {
      looked += 1;
      return [];
    },
  });
  const outcome = await linkAppleAccount(
    appleEvent({ request: { userAttributes: { email: "a@b.com", email_verified: "false" } } }),
    deps
  );
  assert.deepEqual(outcome, { status: "skipped", reason: "email_unverified" });
  assert.equal(looked, 0, "must not query the directory for an unverified email");
});

test("linkAppleAccount: rethrows (fail-closed) when the link call fails", async () => {
  const { deps, logs } = makeDeps({
    linkProvider: async () => {
      throw new Error("AdminLinkProviderForUser boom");
    },
  });
  await assert.rejects(() => linkAppleAccount(appleEvent(), deps), /boom/);
  assert.ok(logs.some((l) => l.event === "apple_link_failed"));
});
