"use client";

import { Navbar } from "@/components/sections/Navbar";
import { Pricing } from "@/components/sections/Pricing";
import { Footer } from "@/components/sections/Footer";

export function PricingPageClient() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-base)" }}>
      <Navbar />
      <div className="pt-8">
        <Pricing />
      </div>
      <Footer />
    </div>
  );
}
