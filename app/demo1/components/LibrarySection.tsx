'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { TrendingUp } from 'lucide-react'

const GENRES = [
  'Habit Formation', 'Productivity', 'Leadership', 'Psychology', 'Philosophy',
  'Entrepreneurship', 'Finance', 'Health', 'Communication', 'Creativity',
  'Science', 'History', 'Decision Making', 'Focus', 'Mindset',
]

const STATS = [
  { value: '200+', label: 'Books available now', sub: 'Across 15+ categories' },
  { value: 'Weekly', label: 'New titles added', sub: 'Library grows every week' },
  { value: '3 modes', label: 'Depth per chapter', sub: 'Simple, Standard, Deeper' },
]

export function LibrarySection() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <section id="library" ref={ref} className="py-28">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-indigo-400 mb-5">
              <TrendingUp className="w-3.5 h-3.5" />
              The library
            </span>
            <h2 className="text-[clamp(28px,4vw,50px)] font-extrabold text-white tracking-tight mb-5">
              200+ books and growing every week
            </h2>
            <p className="text-[15.5px] text-slate-400 leading-relaxed mb-8">
              The library spans the books that serious learners return to repeatedly — from habit science and
              leadership to philosophy, finance, and decision making. Every title is fully structured with summaries,
              examples, and quizzes across all depth modes.
            </p>

            <div className="grid grid-cols-3 gap-4">
              {STATS.map((s) => (
                <div key={s.label} className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 text-center">
                  <p className="text-[22px] font-extrabold text-white tracking-tight">{s.value}</p>
                  <p className="text-[12px] font-semibold text-slate-300 mt-1">{s.label}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">{s.sub}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right: genre cloud */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
            className="relative"
          >
            <div
              className="absolute inset-0 rounded-3xl opacity-30 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at center, rgba(99,102,241,0.25) 0%, transparent 70%)' }}
            />
            <div className="relative bg-[#0b1024] border border-white/[0.08] rounded-3xl p-8">
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-5">
                Available categories
              </p>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g, i) => (
                  <motion.span
                    key={g}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={inView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 0.2 + i * 0.04, duration: 0.4, ease: 'easeOut' }}
                    className={`text-[12.5px] font-medium px-3.5 py-1.5 rounded-full border transition-colors cursor-default ${
                      i % 4 === 0
                        ? 'bg-indigo-500/12 border-indigo-500/25 text-indigo-300'
                        : i % 4 === 1
                        ? 'bg-violet-500/10 border-violet-500/20 text-violet-300'
                        : i % 4 === 2
                        ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300'
                        : 'bg-white/[0.04] border-white/[0.1] text-slate-400'
                    }`}
                  >
                    {g}
                  </motion.span>
                ))}
              </div>
              <div className="mt-6 pt-5 border-t border-white/[0.06]">
                <p className="text-[13px] text-slate-500">
                  Don&apos;t see a book you want?{' '}
                  <a href="#" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                    Request it →
                  </a>
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
