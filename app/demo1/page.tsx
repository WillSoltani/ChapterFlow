import type { Metadata } from 'next'
import { Navbar } from './components/Navbar'
import { Hero } from './components/Hero'
import { ProductShowcase } from './components/ProductShowcase'
import { Features } from './components/Features'
import { HowItWorks } from './components/HowItWorks'
import { LibrarySection } from './components/LibrarySection'
import { Pricing } from './components/Pricing'
import { FAQ } from './components/FAQ'
import { FinalCTA } from './components/FinalCTA'
import { Footer } from './components/Footer'

export const metadata: Metadata = {
  title: 'ChapterFlow — Read Deeper. Understand More.',
  description:
    'ChapterFlow structures every chapter with layered summaries, real-life examples, and quizzes so knowledge actually sticks.',
}

export default function Demo1Page() {
  return (
    <div className="bg-[#070b18] min-h-screen overflow-x-hidden">
      <Navbar />
      <Hero />
      <ProductShowcase />
      <Features />
      <HowItWorks />
      <LibrarySection />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  )
}
