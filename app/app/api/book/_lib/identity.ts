import "server-only";

import type { AuthedUser } from "@/app/app/api/_lib/auth";

export type BookResolvedIdentity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string;
  authDisplayName: string | null;
  profileDisplayName: string | null;
  givenName: string | null;
  familyName: string | null;
  preferredUsername: string | null;
  source: "profile" | "cognito" | "email" | "fallback";
};

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function displayNameFromEmail(email: string | null): string | null {
  if (!email) return null;
  const localPart = email.split("@")[0]?.trim();
  if (!localPart) return null;
  return localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function resolveBookIdentity(
  user: AuthedUser,
  profile?: Record<string, unknown> | null
): BookResolvedIdentity {
  const profileDisplayName = clean(profile?.displayName);
  const authDisplayName =
    clean(user.name) ||
    [clean(user.givenName), clean(user.familyName)].filter(Boolean).join(" ").trim() ||
    clean(user.preferredUsername);
  const emailDisplayName = displayNameFromEmail(user.email ?? null);

  if (profileDisplayName) {
    return {
      sub: user.sub,
      email: user.email ?? null,
      emailVerified: user.emailVerified === true,
      displayName: profileDisplayName,
      authDisplayName: authDisplayName || null,
      profileDisplayName,
      givenName: clean(user.givenName),
      familyName: clean(user.familyName),
      preferredUsername: clean(user.preferredUsername),
      source: "profile",
    };
  }

  if (authDisplayName) {
    return {
      sub: user.sub,
      email: user.email ?? null,
      emailVerified: user.emailVerified === true,
      displayName: authDisplayName,
      authDisplayName,
      profileDisplayName: null,
      givenName: clean(user.givenName),
      familyName: clean(user.familyName),
      preferredUsername: clean(user.preferredUsername),
      source: "cognito",
    };
  }

  if (emailDisplayName) {
    return {
      sub: user.sub,
      email: user.email ?? null,
      emailVerified: user.emailVerified === true,
      displayName: emailDisplayName,
      authDisplayName: null,
      profileDisplayName: null,
      givenName: clean(user.givenName),
      familyName: clean(user.familyName),
      preferredUsername: clean(user.preferredUsername),
      source: "email",
    };
  }

  return {
    sub: user.sub,
    email: user.email ?? null,
    emailVerified: user.emailVerified === true,
    displayName: "Reader",
    authDisplayName: null,
    profileDisplayName: null,
    givenName: clean(user.givenName),
    familyName: clean(user.familyName),
    preferredUsername: clean(user.preferredUsername),
    source: "fallback",
  };
}
