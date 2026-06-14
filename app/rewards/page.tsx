import type { Metadata } from "next";
import { requireDashboardAccess } from "@/app/_lib/require-dashboard-access";
import { RewardsPageClient } from "./RewardsPageClient";

export const metadata: Metadata = {
  title: "Rewards | ChapterFlow",
  description:
    "Earn Insight Points by reading, completing quizzes, and inviting friends. Redeem for bonus books, Pro passes, and more.",
};

export default async function RewardsPage() {
  await requireDashboardAccess();
  return <RewardsPageClient />;
}
