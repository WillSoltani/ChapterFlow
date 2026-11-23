import type { Metadata } from "next";
import { TokenExpiryGuard } from "@/components/auth/TokenExpiryGuard";

// The dashboard sits outside app/book, so it carries the full title itself.
export const metadata: Metadata = {
  title: "Home | ChapterFlow",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <TokenExpiryGuard />
    </>
  );
}
