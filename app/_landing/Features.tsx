'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Layers, Lightbulb, HelpCircle, TrendingUp, BookMarked, Gauge } from 'lucide-react'

const FEATURES = [
  {
    icon: <Layers className="w-5 h-5" />,
    color: 'indigo',
    accent: 'rgba(99,102,241,0.55)',
    title: 'Layered Summaries',
    desc: 'Every chapter distilled into three tiers. Choose Simple for the core insight, Standard for a full breakdown, or Deeper for expanded analysis with nuance and edge cases.',
  },
  {
    icon: <Lightbulb className="w-5 h-5" />,
    color: 'violet',
    accent: 'rgba(167,139,250,0.55)',
    title: 'Real-Life Examples',
    desc: 'Abstract ideas only stick when applied. Every chapter includes Student, Work, and Personal scenarios so concepts become usable in your actual life, not just understood in theory.',
  },
  {
    icon: <HelpCircle className="w-5 h-5" />,
    color: 'cyan',
    accent: 'rgba(34,211,238,0.55)',
    title: 'Quiz-Gated Progression',
    desc: 'You earn the next chapter by proving you understood this one. Five targeted questions per chapter use active recall — the method memory science consistently validates.',
  },
  {
    icon: <TrendingUp className="w-5 h-5" />,
    color: 'emerald',
    accent: 'rgba(52,211,153,0.55)',
    title: 'Progress and Mastery',
    desc: 'Track chapter completion, quiz averages, and mastery ratings. Watch comprehension grow over time — not just pages turned or books started.',
  },
  {
    icon: <BookMarked className="w-5 h-5" />,
    color: 'amber',
    accent: 'rgba(251,191,36,0.55)',
    title: 'Reading Momentum',
    desc: 'Save books, build your read-next queue, pick up exactly where you left off. Your entire reading path in one intentional space with zero friction to re-engage.',
  },
  {
    icon: <Gauge className="w-5 h-5" />,
    color: 'rose',
    accent: 'rgba(251,113,133,0.55)',
    title: 'Three Depth Modes',
    desc: 'Simple for a quick mental model. Standard for thorough understanding. Deeper for rich nuanced breakdown with extended examples and analysis. Match depth to your goal.',
  },
]

const ICON_STYLES: Record<string, { icon: string; bg: string; border: string; hover: string }> = {
  indigo: { icon: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', hover: 'group-hover:bg-indigo-500/18 group-hover:border-indigo-500/35' },
  violet: { icon: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', hover: 'group-hover:bg-violet-500/18 group-hover:border-violet-500/35' },
  cyan:   { icon: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   hover: 'group-hover:bg-cyan-500/18 group-hover:border-cyan-500/35' },
  emerald:{ icon: 'text-emerald-400',bg: 'bg-emerald-500/10',border: 'border-emerald-500/20',hover: 'group-hover:bg-emerald-500/18 group-hover:border-emerald-500/35' },
  amber:  { icon: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  hover: 'group-hover:bg-amber-500/18 group-hover:border-amber-500/35' },
  rose:   { icon: 'text-rose-400',   bg: 'bg-rose-500/10',   border: 'border-rose-500/20',   hover: 'group-hover:bg-rose-500/18 group-hover:border-rose-500/35' },
}

export function Features() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <section
      id="features"
      ref={ref}
      className="py-28 relative"
      style={{ background: 'linear-gradient(180deg, #0a0f1e 0%, #070b18 100%)' }}
    >
      {/* Top separator */}
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-indigo-500/20 to-transparent" />

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
            const s = ICON_STYLES[f.color]
            return (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: i * 0.08, ease: 'easeOut' }}
                className="group relative bg-white/[0.035] hover:bg-white/6 border border-white/8 hover:border-white/14 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1.5 overflow-hidden"
              >
                {/* Gradient top accent line — unique per card */}
                <div
                  className="absolute top-0 inset-x-0 h-px"
                  style={{
                    background: `linear-gradient(to right, transparent, ${f.accent}, transparent)`,
                  }}
                />

                {/* Subtle glow on hover */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
                  style={{
                    background: `radial-gradient(ellipse at 30% 0%, ${f.accent.replace('0.55', '0.06')} 0%, transparent 60%)`,
                  }}
                />

                <div className={`relative w-11 h-11 rounded-xl ${s.bg} ${s.border} border flex items-center justify-center mb-5 ${s.icon} ${s.hover} transition-all duration-300 group-hover:scale-110`}>
                  {f.icon}
                </div>
                <h3 className="relative text-[16px] font-bold text-white mb-2.5">{f.title}</h3>
                <p className="relative text-[13.5px] text-slate-400 leading-relaxed">{f.desc}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
