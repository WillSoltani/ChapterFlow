'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

export function FinalCTA() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <section ref={ref} className="py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 50% 100%, rgba(99,102,241,0.18) 0%, transparent 65%), radial-gradient(ellipse 50% 40% at 20% 60%, rgba(167,139,250,0.1) 0%, transparent 60%)',
          }}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-5 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-indigo-400 mb-6">
            Your first chapter starts now
          </span>

          <h2 className="text-[clamp(34px,5.5vw,68px)] font-black text-white leading-[1.06] tracking-tight mb-6">
            Stop collecting books.{' '}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              Start mastering them.
            </span>
          </h2>

          <p className="text-[17px] text-slate-400 leading-relaxed max-w-2xl mx-auto mb-10">
            ChapterFlow turns every chapter into a structured learning session. Pick a book, understand it deeply,
            prove it with a quiz, and build a reading habit that compounds. Free to start. Genuinely useful from day one.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
            <a
              href="#"
              className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[16px] px-8 py-4 rounded-full transition-all duration-200 shadow-2xl shadow-indigo-600/35 hover:shadow-indigo-500/50 hover:-translate-y-0.5"
            >
              Start reading for free
              <span aria-hidden>→</span>
            </a>
            <a
              href="#pricing"
              className="inline-flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 font-semibold text-[16px] px-7 py-4 rounded-full border border-white/[0.1] transition-all duration-200"
            >
              View pricing
            </a>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6">
            {['No credit card required', 'Free tier — no expiry', '14-day Pro trial available'].map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-[13px] text-slate-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                {t}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
