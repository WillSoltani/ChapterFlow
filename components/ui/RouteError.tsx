"use client";

import { startTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type RouteLink = { href: string; label: string };

export type RouteErrorProps = {
  title: string;
  message: string;
  /** The error boundary's `reset`. When given, a "Try again" button is shown. */
  reset?: () => void;
  /** Main way out. Defaults to Home. */
  primaryLink?: RouteLink;
  /** Optional second way out (e.g. the library). */
  secondaryLinks?: RouteLink[];
  /** Small print under the actions (e.g. a support contact). */
  footer?: ReactNode;
};

const HOME_LINK: RouteLink = { href: "/dashboard", label: "Back to Home" };

/**
 * Shared, token-based error / not-found screen for route boundaries (SHELL-12,
 * SHELL-25). "Try again" re-requests the page from the server before resetting
 * the boundary: `reset()` alone only re-renders the client tree, so an error
 * thrown while rendering on the server would simply come back.
 */
export function RouteError({
  title,
  message,
  reset,
  primaryLink = HOME_LINK,
  secondaryLinks = [],
  footer,
}: RouteErrorProps) {
  const router = useRouter();

  const retry = () => {
    if (!reset) return;
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <main className="cf-app-shell flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        <h1 className="font-(family-name:--font-display) text-2xl font-semibold text-(--cf-text-1)">
          {title}
        </h1>
        <p className="mt-3 text-cf-body leading-relaxed text-(--cf-text-3)">{message}</p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          {reset ? (
            <Button type="button" onClick={retry}>
              Try again
            </Button>
          ) : null}
          <Button asChild variant={reset ? "secondary" : "default"}>
            <Link href={primaryLink.href}>{primaryLink.label}</Link>
          </Button>
          {secondaryLinks.map((link) => (
            <Button key={link.href} asChild variant="secondary">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </div>
        {footer ? <div className="mt-8 text-cf-label text-(--cf-text-3)">{footer}</div> : null}
      </div>
    </main>
  );
}
