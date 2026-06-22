"use client";

import { LazyMotion, domAnimation } from "framer-motion";

/**
 * LandingMotionProvider — ONE LazyMotion provider for the whole marketing tree.
 *
 * Wraps the landing page in a single `LazyMotion` boundary loading the
 * `domAnimation` feature bundle. Components inside should use the lightweight
 * `m` component (`import { m } from "framer-motion"`) instead of `motion.*`:
 * `m` ships ~5kb and defers feature code to this provider, trimming the
 * framer-motion weight in the SSR'd ServerFn bundle (the 250 MiB Lambda budget).
 *
 * `domAnimation` covers what the landing needs (animations, variants, exit,
 * gestures) but NOT `layout`/`layoutId` shared-element animations — those need
 * `domMax`. Library.tsx + AppWindowChrome use `layout`, so they must keep
 * importing the full `motion` (which carries its own features) until either
 * they drop `layout` or this provider is upgraded to `domMax`.
 *
 * `strict` is intentionally OFF during the migration: existing sections still
 * import `motion`, and `strict` would throw on any `motion.*` usage. Flip it to
 * `strict` once every landing section has migrated to `m` — at which point the
 * bundle trim is fully realized (the trim is partial while any `motion` import
 * remains in the tree, since `motion` pulls the full feature set regardless).
 */
export function LandingMotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LazyMotion features={domAnimation}>{children}</LazyMotion>;
}
