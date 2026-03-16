import type { Metadata } from "next";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import {
  CHAPTERFLOW_NAME,
  CHAPTERFLOW_TAGLINE,
  getChapterFlowSiteUrl,
} from "@/app/_lib/chapterflow-brand";

export const metadata: Metadata = {
  title: CHAPTERFLOW_NAME,
  description: CHAPTERFLOW_TAGLINE,
  metadataBase: new URL(getChapterFlowSiteUrl()),
  openGraph: {
    title: CHAPTERFLOW_NAME,
    description: CHAPTERFLOW_TAGLINE,
    url: getChapterFlowSiteUrl(),
    siteName: CHAPTERFLOW_NAME,
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${GeistSans.className} ${GeistMono.variable}`}>
      <head>
        {/* Anti-flash: apply theme before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var p=JSON.parse(localStorage.getItem('book-accelerator:preferences:v2')||'{}');var t=(p&&p.appearance&&p.appearance.theme)||'dark';if(t==='light'){document.documentElement.classList.remove('dark');}else if(t==='system'){if(!window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.remove('dark');}}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen w-full overflow-x-hidden bg-slate-50 text-slate-900 antialiased dark:bg-[#040812] dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
