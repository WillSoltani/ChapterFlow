import type { Metadata } from "next";
import { RewardsPageClient } from "./RewardsPageClient";

export const metadata: Metadata = {
  title: "Rewards | ChapterFlow",
  description:
    "Earn Flow Points by reading, completing quizzes, and inviting friends. Redeem for bonus books, Pro passes, and more.",
};

export default function RewardsPage() {
  return <RewardsPageClient />;
}
