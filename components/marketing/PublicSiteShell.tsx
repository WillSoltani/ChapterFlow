import { RecallNav } from "@/components/landing/recall/RecallNav";
import { Footer } from "@/components/sections/Footer";

/**
 * Canonical public-site chrome.
 *
 * Pages keep ownership of their single `main#main` landmark so they can place
 * atmospheric layers and route-specific mastheads without forcing those into a
 * client boundary. Navigation and the footer live here exactly once.
 */
export function PublicSiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="landing-dark cf-public-site relative min-h-screen overflow-x-clip">
      <RecallNav />
      {children}
      <Footer />
    </div>
  );
}
