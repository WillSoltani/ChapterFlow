'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Layers, Lightbulb, HelpCircle, TrendingUp, BookMarked, Gauge } from 'lucide-react'

const FEATURES = [
  {
    icon: <Layers className="w-5 h-5" />,
    color: 'indigo',
    title: 'Layered Summaries',
    desc: 'Every chapter is distilled into tiered summaries. Choose Simple for the core idea, Standard for the full breakdown, or Deeper for expanded analysis. Your depth, your pace.',
  },
  {
    icon: <Lightbulb className="w-5 h-5" />,
    color: 'violet',
    title: 'Real-Life Examples',
    desc: 'Abstract ideas only stick when you can see them applied. Every chapter includes Student, Work, and Personal scenarios that make concepts immediately usable in your actual life.',
  },
  {
    icon: <HelpCircle className="w-5 h-5" />,
    color: 'cyan',
    title: 'Quiz-Gated Progression',
    desc: 'You earn the next chapter by demonstrating you understood this one. Five targeted questions per chapter test active recall — the method that actually builds long-term memory.',
  },
  {
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'emerald',
    title: 'Progress and Mastery',
    desc: 'Track chapter completion, quiz scores, reading streaks, and mastery ratings. See your comprehension grow over time — not just your page count.',
  },
  {
    icon: <BookMarked className="w-5 h-5" />,
    color: 'amber',
    title: 'Reading Momentum',
    desc: 'Save books, build your read-next queue, and pick up exactly where you left off. Your entire reading path organized in one intentional space.',
  },
  {
    icon: <Gauge className="w-5 h-5" />,
    color: 'rose',
    title: 'Three Depth Modes',
    desc: 'Simple mode for a quick mental model. Standard for a thorough understanding. Deeper for a rich, nuanced breakdown of the chapter with extended examples and analysis.',
  },
]

const COLOR_MAP: Record<string, { icon: string; bg: string; border: string; glow: string }> = {
  indigo: { icon: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', glow: 'group-hover:shadow-indigo-500/20' },
  violet: { icon: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', glow: 'group-hover:shadow-violet-500/20' },
  cyan: { icon: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', glow: 'group-hover:shadow-cyan-500/20' },
  emerald: { icon: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', glow: 'group-hover:shadow-emerald-500/20' },
  amber: { icon: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', glow: 'group-hover:shadow-amber-500/20' },
  rose: { icon: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', glow: 'group-hover:shadow-rose-500/20' },
}

export function Features() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <section id="features-list" ref={ref} className="py-28 relative">
      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-indigo-400 mb-4">
            Everything you need
          </span>
          <h2 className="text-[clamp(28px,4vw,50px)] font-extrabold text-white tracking-tight mb-4">
            Six pillars of intentional reading
          </h2>
          <p className="text-[16px] text-slate-400 max-w-lg mx-auto leading-relaxed">
            Not a feature list. A learning system built around how comprehension and retention actually work.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => {
            const c = COLOR_MAP[f.color]
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                className={`group bg-white/[0.03] hover:bg-white/[0.055] border border-white/[0.07] hover:border-white/[0.13] rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${c.glow}`}
              >
                <div
                  className={`w-11 h-11 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center mb-5 ${c.icon} transition-transform duration-300 group-hover:scale-110`}
                >
                  {f.icon}
                </div>
                <h3 className="text-[16px] font-bold text-white mb-2.5">{f.title}</h3>
                <p className="text-[13.5px] text-slate-400 leading-relaxed">{f.desc}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
