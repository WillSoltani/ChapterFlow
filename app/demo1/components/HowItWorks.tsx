'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Search, BookOpen, HelpCircle, BarChart3 } from 'lucide-react'

const STEPS = [
  {
    n: '01',
    icon: <Search className="w-5 h-5" />,
    title: 'Pick a book',
    desc: 'Browse 200+ titles across topics that matter to you. Save any book to your personal reading queue.',
  },
  {
    n: '02',
    icon: <BookOpen className="w-5 h-5" />,
    title: 'Read with structure',
    desc: 'Open a chapter and work through the summary and real-life examples at your chosen depth mode. No fluff, no filler.',
  },
  {
    n: '03',
    icon: <HelpCircle className="w-5 h-5" />,
    title: 'Prove you understood it',
    desc: 'Answer five targeted questions before moving on. Active recall is the method that makes knowledge stick.',
  },
  {
    n: '04',
    icon: <BarChart3 className="w-5 h-5" />,
    title: 'Watch yourself grow',
    desc: 'Track mastery scores, streaks, and book completion. Turn reading from a passive habit into measurable progress.',
  },
]

export function HowItWorks() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <section id="how-it-works" ref={ref} className="py-28 relative bg-[#060a18]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />

      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-indigo-400 mb-4">
            The process
          </span>
          <h2 className="text-[clamp(28px,4vw,50px)] font-extrabold text-white tracking-tight mb-4">
            How ChapterFlow works
          </h2>
          <p className="text-[16px] text-slate-400 max-w-md mx-auto leading-relaxed">
            Four steps from choosing a book to genuinely understanding it.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {/* Connecting line (desktop) */}
          <div className="absolute top-[42px] left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-indigo-500/30 via-violet-500/30 to-cyan-500/30 hidden lg:block" />

          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.65, delay: i * 0.12, ease: 'easeOut' }}
              className="flex flex-col items-center text-center"
            >
              {/* Number circle */}
              <div className="relative mb-6 z-10">
                <div className="w-[84px] h-[84px] rounded-full bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-[#0d1230] border border-indigo-500/40 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                    <div className="text-indigo-400">{s.icon}</div>
                  </div>
                </div>
                <span className="absolute -top-1 -right-1 text-[10px] font-black text-indigo-400 bg-indigo-600 w-5 h-5 rounded-full flex items-center justify-center leading-none">
                  {i + 1}
                </span>
              </div>

              <h3 className="text-[16px] font-bold text-white mb-2">{s.title}</h3>
              <p className="text-[13.5px] text-slate-400 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
