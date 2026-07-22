export type AuthStateSecretResolver = (
  name: string,
) => Promise<string | undefined>;

/** Resolve and validate OAuth state key material without exposing its value. */
export async function resolveAuthStateSecret(
  resolve: AuthStateSecretResolver,
): Promise<string> {
  const secret = await resolve("AUTH_STATE_SECRET");
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      "AUTH_STATE_SECRET must resolve at runtime and be at least 32 characters long",
    );
  }
  return secret;
}
