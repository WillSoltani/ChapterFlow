import Link from "next/link";
import { RouteError } from "@/components/ui/RouteError";

export default function NotFound() {
  return (
    <RouteError
      title="Page not found"
      message="The page you're looking for doesn't exist or has been moved."
      primaryLink={{ href: "/", label: "Back to home" }}
      secondaryLinks={[
        { href: "/dashboard", label: "Go to your dashboard" },
        { href: "/books", label: "Browse library" },
      ]}
      footer={
        <>
          Think this is a mistake?{" "}
          <Link href="/contact" className="text-(--cf-accent) underline">
            Contact us
          </Link>
          .
        </>
      }
    />
  );
}
