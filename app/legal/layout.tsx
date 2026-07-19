import { PublicMasthead } from "@/components/marketing/PublicMasthead";
import { PublicSiteShell } from "@/components/marketing/PublicSiteShell";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicSiteShell>
      <main id="main" tabIndex={-1} className="focus:outline-none">
        <PublicMasthead
          eyebrow="Trust & transparency"
          title="Legal & policies"
          headingAs="p"
          compact
        />
        <div
          data-public-hero-end
          aria-hidden="true"
          className="pointer-events-none h-px w-full"
        />
        <section
          aria-label="Legal documents"
          className="cf-paper-folio relative z-10 mx-auto mb-20 w-[calc(100%-2rem)] max-w-3xl rounded-[2rem] px-6 py-10 sm:w-[calc(100%-3rem)] sm:px-10 sm:py-14 lg:px-14"
        >
          {children}
        </section>
      </main>
    </PublicSiteShell>
  );
}
