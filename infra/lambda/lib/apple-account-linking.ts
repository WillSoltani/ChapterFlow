// Pure decision logic for the Cognito PreSignUp trigger that links a federated
// Sign-in-with-Apple identity to a pre-existing native (email/password) Cognito
// user with the SAME verified email — instead of letting Cognito mint a SECOND
// user (a different `sub`) and split the person's books/progress/entitlement.
//
// No AWS SDK imports here on purpose: this file is unit-tested directly. The
// handler (cognito-pre-signup.ts) wires the real ListUsers / AdminLinkProviderForUser.

/** The Cognito provider name for a native username/password user. */
export const COGNITO_NATIVE_PROVIDER = "Cognito";
/** The provider name Cognito assigns to the Sign-in-with-Apple IdP. */
export const APPLE_PROVIDER_NAME = "SignInWithApple";
/** Cognito's PreSignUp trigger source for a federated (external-IdP) sign-in. */
export const EXTERNAL_PROVIDER_TRIGGER = "PreSignUp_ExternalProvider";

/** A federated Cognito userName is `<ProviderName>_<providerUserId>`. */
export function parseFederatedUserName(
  userName: string | undefined | null
): { providerName: string; providerUserId: string } | null {
  if (!userName) return null;
  const idx = userName.indexOf("_");
  if (idx <= 0 || idx === userName.length - 1) return null;
  return {
    providerName: userName.slice(0, idx),
    providerUserId: userName.slice(idx + 1),
  };
}

function isAppleProvider(providerName: string): boolean {
  return providerName.toLowerCase().includes("apple");
}

export interface PreSignUpEventLike {
  triggerSource?: string;
  userName?: string;
  request?: {
    userAttributes?: Record<string, string | undefined>;
  };
}

export type LinkingDecision =
  | {
      action: "attempt_link";
      email: string;
      providerName: string;
      providerUserId: string;
    }
  | { action: "skip"; reason: string };

/**
 * First-pass decision from the trigger event alone (before any directory lookup):
 * should we even consider linking this sign-in?
 *
 * Links ONLY when: it's the external-provider flow, the provider is Apple, an
 * email is present, and Apple asserts the email is VERIFIED. An unverified email
 * must NEVER link (it would let anyone claiming an email hijack the matching
 * account) — we skip and log instead.
 */
export function decideAppleLinking(event: PreSignUpEventLike): LinkingDecision {
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

  // Cognito passes booleans as the strings "true"/"false".
  if (attrs.email_verified !== "true") {
    return { action: "skip", reason: "email_unverified" };
  }

  return {
    action: "attempt_link",
    email,
    providerName: parsed.providerName,
    providerUserId: parsed.providerUserId,
  };
}

/** A simplified view of a directory user returned by ListUsers. */
export interface CandidateUser {
  username: string;
  /** Lowercased email attribute, if any. */
  email?: string;
  /** "true"/"false" — the string Cognito stores. */
  emailVerified?: string;
  /** Present (non-empty) when the user is ITSELF a federated identity. */
  identities?: string;
}

export type LinkTargetChoice =
  | { target: string }
  | { target: null; reason: string };

/**
 * Choose which existing user (if any) the incoming Apple identity should be
 * linked into. We link ONLY into a NATIVE Cognito account whose email matches
 * and is itself verified — never into another federated identity, and never when
 * the match is ambiguous.
 */
export function chooseLinkTarget(
  candidates: CandidateUser[],
  incomingEmail: string
): LinkTargetChoice {
  const email = incomingEmail.trim().toLowerCase();
  const matches = candidates.filter((c) => {
    if ((c.email ?? "").trim().toLowerCase() !== email) return false;
    // The existing account must own the email verifiably, or linking could hand
    // the Apple login an unverified/attacker-seeded account.
    if (c.emailVerified !== "true") return false;
    // Only a native user is a valid destination; a federated user (has an
    // `identities` attribute) is skipped — linking two IdPs is not this flow.
    if (c.identities && c.identities.trim() !== "" && c.identities.trim() !== "[]") {
      return false;
    }
    return true;
  });

  if (matches.length === 0) return { target: null, reason: "no_existing_native_user" };
  if (matches.length > 1) return { target: null, reason: "ambiguous_multiple_matches" };
  return { target: matches[0].username };
}

/** Injected side effects so the orchestration is unit-testable without the SDK. */
export interface LinkingDeps {
  /** Look up directory users whose email matches (ListUsers with an email filter). */
  listUsersByEmail: (email: string) => Promise<CandidateUser[]>;
  /** Link the Apple source identity into the existing native destination user. */
  linkProvider: (params: {
    destinationUsername: string;
    appleProviderUserId: string;
    appleProviderName: string;
  }) => Promise<void>;
  log: (event: string, fields: Record<string, unknown>) => void;
}

export type LinkingOutcome =
  | { status: "skipped"; reason: string }
  | { status: "linked"; target: string };

/**
 * Full PreSignUp linking orchestration with side effects injected. Returns an
 * outcome; NEVER swallows a genuine link FAILURE — it rethrows so Cognito aborts
 * the sign-up rather than silently minting a second, split account. All the
 * "don't link" decisions (not Apple, unverified, no/ambiguous match) resolve to a
 * `skipped` outcome so the sign-up proceeds normally.
 */
export async function linkAppleAccount(
  event: PreSignUpEventLike,
  deps: LinkingDeps
): Promise<LinkingOutcome> {
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
      appleProviderName: decision.providerName,
    });
  } catch (error) {
    // Fail-closed: surface loudly and abort sign-up rather than create the split
    // account this trigger exists to prevent. A transient error succeeds on the
    // user's retry; a persistent one is immediately visible in CloudWatch.
    deps.log("apple_link_failed", {
      target: choice.target,
      email: decision.email,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  deps.log("apple_link_ok", { target: choice.target, email: decision.email });
  return { status: "linked", target: choice.target };
}
