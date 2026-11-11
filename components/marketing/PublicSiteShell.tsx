import { RecallNav } from "@/components/landing/recall/RecallNav";
import { Footer } from "@/components/sections/Footer";

/**
 * Canonical public-site chrome.
 *
 * Pages keep ownership of their single `main#main` landmark so they can place
 * atmospheric layers and route-specific mastheads without forcing those into a
 * client boundary. Navigation and the footer live here exactly once.
 *
 * `skipLinks`: the page's own skip links, mounted by the nav right after its
 * shared skip link (the landing's "Skip the film").
 */
export function PublicSiteShell({ children, skipLinks }: { children: React.ReactNode; skipLinks?: React.ReactNode }) {
  return (
    <div className="landing-dark cf-public-site relative min-h-screen overflow-x-clip">
      <RecallNav skipLinks={skipLinks} />
      {children}
      <Footer />
    </div>
  );
}
