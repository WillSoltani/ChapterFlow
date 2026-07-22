export const BILLING_RUNTIME_SECRET_NAMES = [
  "BOOK_STRIPE_SECRET_KEY",
  "BOOK_STRIPE_WEBHOOK_SECRET",
] as const;

export type BillingSecretResolver = (
  name: string,
) => Promise<string | undefined>;

export async function resolveBillingSecretReadiness(
  resolve: BillingSecretResolver,
): Promise<boolean> {
  const values = await Promise.all(
    BILLING_RUNTIME_SECRET_NAMES.map((name) => resolve(name)),
  );
  return values.every((value) => value !== undefined && value.trim().length > 0);
}
