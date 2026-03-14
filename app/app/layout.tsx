import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen text-slate-100">
      {/* NO header here. NO max-width wrapper here. */}
      {children}
    </div>
  );
}
