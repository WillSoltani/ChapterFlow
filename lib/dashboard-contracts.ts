/** The subset of the dashboard entitlement object consumed by client UI. */
export type DashboardEntitlement = {
  plan: "FREE" | "PRO";
  freeBookSlots: number;
  unlockedBookIds: string[];
} | null;
