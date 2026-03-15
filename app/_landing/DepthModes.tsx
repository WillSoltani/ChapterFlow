'use client'

import { useRef, useState } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Lock } from 'lucide-react'

type Mode = 'simple' | 'standard' | 'deeper'

const MODES: {
  id: Mode
  label: string
  badge?: string
  time: string
  tagline: string
  accent: string
  borderColor: string
  glowColor: string
  content: React.ReactNode
}[] = [
  {
    id: 'simple',
    label: 'Simple',
    time: '~1 min',
    tagline: 'The core idea, nothing more.',
    accent: 'text-slate-300',
    borderColor: 'border-white/10',
    glowColor: 'rgba(148,163,184,0.08)',
    content: (
      <div className="space-y-4">
        <div className="bg-white/4 border border-white/8 rounded-xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">Core idea</p>
          <p className="text-[14px] text-slate-200 leading-relaxed font-medium">
            Habits work through a four-stage loop. Design your environment around the first stage and everything else becomes automatic.
          </p>
        </div>
        <div className="bg-white/4 border border-white/8 rounded-xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-2">Key takeaway</p>
          <p className="text-[13px] text-slate-400 leading-relaxed italic">
            &ldquo;You do not rise to your goals. You fall to the level of your systems.&rdquo;
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-slate-600">
          <CheckCircle2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          Ready for the next chapter
        </div>
      </div>
    ),
  },
  {
    id: 'standard',
    label: 'Standard',
    time: '~4 min',
    tagline: 'Full breakdown with structure.',
    accent: 'text-indigo-400',
    borderColor: 'border-indigo-500/30',
    glowColor: 'rgba(99,102,241,0.1)',
    content: (
      <div className="space-y-4">
        <p className="text-[13.5px] text-slate-300 leading-[1.75]">
          Every habit follows the same four-stage loop: <strong className="text-white font-semibold">Cue</strong>,{' '}
          <strong className="text-white font-semibold">Craving</strong>,{' '}
          <strong className="text-white font-semibold">Response</strong>, and{' '}
          <strong className="text-white font-semibold">Reward</strong>. Your brain constantly scans for cues that predict rewarding outcomes.
        </p>
        <div className="space-y-2">
          {[
            { stage: 'Cue', note: 'The trigger. Make it obvious.' },
            { stage: 'Craving', note: 'The desire. Make it attractive.' },
            { stage: 'Response', note: 'The behavior. Make it easy.' },
            { stage: 'Reward', note: 'The outcome. Make it satisfying.' },
          ].map(({ stage, note }) => (
            <div key={stage} className="flex items-center gap-3 bg-indigo-500/6 border border-indigo-500/15 rounded-lg px-3 py-2">
              <span className="text-[11px] font-bold text-indigo-400 w-16 shrink-0">{stage}</span>
              <span className="text-[12px] text-slate-400">{note}</span>
            </div>
          ))}
        </div>
        <div className="bg-indigo-500/8 border border-indigo-500/20 rounded-xl p-3">
          <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider mb-1">Key insight</p>
          <p className="text-[12px] text-slate-300 italic leading-relaxed">&ldquo;You do not rise to your goals. You fall to the level of your systems.&rdquo;</p>
        </div>
      </div>
    ),
  },
  {
    id: 'deeper',
    label: 'Deeper',
    badge: 'Pro',
    time: '~10 min',
    tagline: 'Extended analysis and counterarguments.',
    accent: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    glowColor: 'rgba(245,158,11,0.08)',
    content: (
      <div className="space-y-4">
        <p className="text-[13.5px] text-slate-300 leading-[1.75]">
          The habit loop builds on decades of behavioral psychology. B.F. Skinner&apos;s operant conditioning framework established that behaviors followed by positive outcomes are more likely to recur. Clear synthesizes this into an actionable four-stage model.
        </p>
        <div className="bg-amber-500/6 border border-amber-500/20 rounded-xl p-3">
          <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2">Research context</p>
          <p className="text-[12px] text-slate-400 leading-relaxed">Wood et al. (2002) found that 43% of daily actions are performed habitually in the same context — suggesting environment design matters more than motivation.</p>
        </div>
        <div className="bg-white/4 border border-white/8 rounded-xl p-3">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Counterargument to consider</p>
          <p className="text-[12px] text-slate-400 leading-relaxed">Not all behaviors follow a clean four-stage loop. Emotional or trauma-driven habits often bypass the craving stage entirely, requiring different intervention strategies.</p>
        </div>
        <div>
          <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2">Application framework</p>
          <div className="space-y-1.5">
            {['Environment design: reduce cue friction', 'Implementation intentions: if X then Y', 'Temptation bundling: pair wanted with needed'].map((t) => (
              <div key={t} className="flex items-start gap-2 text-[12px] text-slate-400">
                <div className="w-1 h-1 rounded-full bg-amber-400/60 mt-1.5 shrink-0" />
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  },
]

export function DepthModes() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [active, setActive] = useState<Mode>('standard')

  return (
    <section
      ref={ref}
      className="py-28 relative overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #080e1e 0%, #0a1020 50%, #070b18 100%)' }}
    >
      {/* Section separators */}
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-500/25 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-indigo-500/20 to-transparent" />

      {/* Background glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.1) 0%, transparent 65%)',
          filter: 'blur(20px)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-5 lg:px-8">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-14"
        >
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-indigo-400 mb-4">
            Reading depth
          </span>
          <h2 className="text-[clamp(28px,4vw,50px)] font-extrabold text-white tracking-tight mb-4">
            Three ways to read every chapter
          </h2>
          <p className="text-[16px] text-slate-400 max-w-xl mx-auto leading-relaxed">
            Match your depth to your goal. A quick mental model, a thorough breakdown, or a deep analytical session —
            the same chapter, three different experiences.
          </p>
        </motion.div>

        {/* Mode selector tabs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex justify-center gap-2 mb-10"
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setActive(m.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-[13px] font-semibold transition-all duration-200 ${
                active === m.id
                  ? m.id === 'deeper'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/35 shadow-lg shadow-amber-500/10'
                    : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-white/5 text-slate-400 border border-white/8 hover:border-white/15 hover:text-slate-200'
              }`}
            >
              {m.label}
              {m.badge && (
                <span className="text-[10px] font-bold bg-amber-500 text-black px-1.5 py-0.5 rounded-full leading-none">
                  {m.badge}
                </span>
              )}
            </button>
          ))}
        </motion.div>

        {/* Three mode panels — desktop: side by side, mobile: stacked */}
        <div className="hidden lg:grid lg:grid-cols-3 gap-5">
          {MODES.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.65, delay: 0.1 + i * 0.1 }}
              onClick={() => setActive(m.id)}
              className={`relative rounded-2xl border cursor-pointer transition-all duration-300 overflow-hidden ${
                active === m.id
                  ? `${m.borderColor} -translate-y-1`
                  : 'border-white/8 hover:border-white/14'
              }`}
              style={
                active === m.id
                  ? { boxShadow: `0 0 60px ${m.glowColor}, 0 20px 60px rgba(0,0,0,0.4)` }
                  : {}
              }
            >
              {/* Card background */}
              <div
                className="absolute inset-0 transition-opacity duration-300"
                style={{
                  background: active === m.id
                    ? `linear-gradient(180deg, ${m.glowColor.replace('0.08', '0.12')} 0%, rgba(12,18,32,0.95) 40%)`
                    : 'rgba(12,18,32,0.6)',
                }}
              />

              {/* Top accent line */}
              <div
                className="absolute top-0 inset-x-0 h-px transition-opacity duration-300"
                style={{
                  background: active === m.id
                    ? `linear-gradient(to right, transparent, ${m.glowColor.replace('0.08', '0.9')}, transparent)`
                    : 'transparent',
                }}
              />

              <div className="relative p-5">
                {/* Card header */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[15px] font-bold ${active === m.id ? m.accent : 'text-slate-300'} transition-colors`}>
                        {m.label}
                      </span>
                      {m.badge && (
                        <span className="text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                          {m.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-slate-500">{m.tagline}</p>
                  </div>
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                    active === m.id ? `${m.borderColor} ${m.accent}` : 'border-white/8 text-slate-600'
                  } transition-all`}>
                    {m.time}
                  </span>
                </div>

                {/* Book context */}
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/6">
                  <div className="w-5 h-7 rounded bg-linear-to-br from-indigo-700 to-violet-800 border border-indigo-500/30 shrink-0" />
                  <p className="text-[11px] text-slate-500">Atomic Habits · Chapter 3</p>
                </div>

                {/* Content */}
                <div className="text-[13px]">{m.content}</div>

                {/* Deeper locked overlay for non-active */}
                {m.id === 'deeper' && active !== 'deeper' && (
                  <div className="absolute inset-0 rounded-2xl bg-[#0a0f1e]/60 flex items-center justify-center backdrop-blur-[2px]">
                    <div className="flex items-center gap-2 bg-[#0c1220] border border-amber-500/25 rounded-full px-4 py-2">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-[12px] font-semibold text-amber-400">Pro only</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile: animated single panel */}
        <div className="lg:hidden">
          <AnimatePresence mode="wait">
            {MODES.filter((m) => m.id === active).map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
                className={`rounded-2xl border ${m.borderColor} p-5 overflow-hidden`}
                style={{ background: `linear-gradient(180deg, ${m.glowColor.replace('0.08', '0.12')} 0%, rgba(12,18,32,0.95) 40%)` }}
              >
                <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/6">
                  <div className="w-5 h-7 rounded bg-linear-to-br from-indigo-700 to-violet-800 border border-indigo-500/30 shrink-0" />
                  <p className="text-[11px] text-slate-500">Atomic Habits · Chapter 3</p>
                  <span className="ml-auto text-[11px] font-medium text-slate-500">{m.time}</span>
                </div>
                {m.content}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Bottom note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6 }}
          className="text-center text-[13px] text-slate-600 mt-10"
        >
          Switch depth modes at any time. Your quiz and progress are always saved.
        </motion.p>
      </div>
    </section>
  )
}
