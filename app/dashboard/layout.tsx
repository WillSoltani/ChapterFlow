import { TokenExpiryGuard } from "@/components/auth/TokenExpiryGuard";

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
