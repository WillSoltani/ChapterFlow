import "server-only";

import { AuthError, requireUser, type AuthedUser } from "./auth";
import {
  guestSubFromSessionId,
  isGuestProjectId,
  readGuestSessionId,
} from "./guest-session";

export type RequestActor =
  | {
      kind: "user";
      sub: string;
      email?: string;
      quotaScope: "signed_in";
    }
  | {
      kind: "guest";
      sub: string;
      guestSessionId: string;
      quotaScope: "guest";
    };

function fromAuthedUser(user: AuthedUser): RequestActor {
  return {
    kind: "user",
    sub: user.sub,
    email: user.email,
    quotaScope: "signed_in",
  };
}

export async function requireActorForProject(projectId: string): Promise<RequestActor> {
  if (isGuestProjectId(projectId)) {
    const guestSessionId = await readGuestSessionId();
    if (guestSessionId) {
      return {
        kind: "guest",
        sub: guestSubFromSessionId(guestSessionId),
        guestSessionId,
        quotaScope: "guest",
      };
    }
  }

  try {
    const user = await requireUser();
    return fromAuthedUser(user);
  } catch (error: unknown) {
    const isAuthError = error instanceof AuthError;
    if (!isAuthError) throw error;
    if (!isGuestProjectId(projectId)) throw error;

    const guestSessionId = await readGuestSessionId();
    if (!guestSessionId) throw new AuthError("UNAUTHENTICATED");

    return {
      kind: "guest",
      sub: guestSubFromSessionId(guestSessionId),
      guestSessionId,
      quotaScope: "guest",
    };
  }
}
