import { JetBrains_Mono, Newsreader } from "next/font/google";

/**
 * Fonts the landing's FIRST SCREEN uses besides the root's preloaded ones
 * (Satoshi 700, Plus Jakarta Sans): JetBrains Mono for .film-label and
 * Newsreader (normal) for .film-lede. app/layout.tsx declares both families
 * for every route with preload: false (most routes' first screens never use
 * them). These declarations are the SAME families with the same options and
 * preload on, imported only by app/page.tsx, so only the landing preloads
 * their latin files. next/font keeps the real family names, so the faces
 * declared here join the root's families; the page's stylesheet comes after
 * the layout's, so for the latin range the browser uses these (preloaded)
 * files and never fetches the root's copies. e2e/film-first-paint.spec.ts
 * checks that every font the landing preloads is used by its first screen
 * and that no other font file is fetched there.
 */
const landingMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const landingSerif = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  style: ["normal"],
});

/** Class names that pull these declarations into the landing (same CSS variables as the root's). */
export const landingFontVariables = `${landingMono.variable} ${landingSerif.variable}`;
