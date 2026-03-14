import type { ReactNode } from "react";
import { Navbar } from "@/components/Navbar";

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen w-full overflow-x-hidden text-slate-100">
      <div className="relative z-10 pt-20">
        <Navbar />
        {children}
      </div>
    </main>
  );
}
