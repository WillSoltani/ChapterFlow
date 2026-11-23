import { RouteError } from "@/components/ui/RouteError";

// In-app 404 boundary for everything under /book/**. Next.js resolves the
// nearest not-found.tsx to the segment where notFound() is thrown, so this one
// file catches all /book notFound() calls (book detail + chapter pages) without
// touching any call site. CTAs stay inside the app; the root app/not-found.tsx
// still serves genuinely public bad URLs.
export default function BookNotFound() {
  return (
    <RouteError
      title="We couldn't find that page"
      message="This book or chapter may have moved or is no longer available. Your progress and streak are safe."
      secondaryLinks={[{ href: "/book/library", label: "Browse library" }]}
    />
  );
}
