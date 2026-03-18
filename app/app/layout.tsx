import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="cf-app-shell-subtle relative min-h-screen">
      {/* NO header here. NO max-width wrapper here. */}
      {children}
    </div>
  );
}
