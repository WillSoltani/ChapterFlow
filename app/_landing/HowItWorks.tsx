'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Search, BookOpen, HelpCircle, BarChart3 } from 'lucide-react'

function StepPreview1() {
  return (
    <div className="bg-[#080d1c] rounded-xl border border-white/6 p-3 mb-4">
      <div className="flex gap-1.5 mb-2.5">
        <div className="flex-1 bg-white/4 rounded-lg px-2 py-1 text-[10px] text-slate-600">Search books...</div>
        <div className="w-5 h-5 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0">
          <Search className="w-2.5 h-2.5 text-indigo-400" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {[
          'from-indigo-700 to-violet-800',
          'from-cyan-700 to-blue-800',
          'from-amber-600 to-orange-800',
        ].map((g, i) => (
          <div key={i} className={`h-10 rounded-lg bg-linear-to-br ${g} border border-white/10`} />
        ))}
      </div>
    </div>
  )
}

function StepPreview2() {
  return (
    <div className="bg-[#080d1c] rounded-xl border border-white/6 p-3 mb-4">
      <div className="flex gap-1 mb-2.5">
        {[['Simple', false], ['Standard', true], ['✦ Deeper', false]].map(([t, active]) => (
          <span
            key={String(t)}
            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${active ? 'bg-indigo-600 text-white' : 'bg-white/5 text-slate-500'}`}
          >
            {t}
          </span>
        ))}
      </div>
      <p className="text-[10px] text-slate-400 leading-relaxed">
        Every habit follows the same four-stage loop: Cue, Craving, Response, and Reward. Your brain scans for cues that predict rewarding outcomes.
      </p>
    </div>
  )
}

function StepPreview3() {
  return (
    <div className="bg-[#080d1c] rounded-xl border border-white/6 p-3 mb-4 space-y-1.5">
      <p className="text-[10px] font-semibold text-white mb-1.5">What initiates the habit loop?</p>
      {[
        { text: 'A cue or trigger', selected: true },
        { text: 'A craving', selected: false },
        { text: 'A reward', selected: false },
      ].map(({ text, selected }) => (
        <div
          key={text}
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1 border ${
            selected ? 'bg-cyan-500/10 border-cyan-500/25' : 'bg-white/3 border-white/6'
          }`}
        >
          <div
            className={`w-3 h-3 rounded-full border flex items-center justify-center shrink-0 ${
              selected ? 'border-cyan-400 bg-cyan-500/30' : 'border-white/20'
            }`}
          >
            {selected && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
          </div>
          <span className={`text-[10px] ${selected ? 'text-cyan-300' : 'text-slate-500'}`}>{text}</span>
        </div>
      ))}
    </div>
  )
}

function StepPreview4() {
  return (
    <div className="bg-[#080d1c] rounded-xl border border-white/6 p-3 mb-4 space-y-2">
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[10px] text-slate-400">Atomic Habits</span>
          <span className="text-[10px] font-semibold text-emerald-400">72%</span>
        </div>
        <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
          <div className="h-full w-[72%] bg-linear-to-r from-emerald-500 to-cyan-500 rounded-full" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 text-center">
        {[['3', 'Books'], ['47', 'Chapters'], ['94%', 'Quiz avg']].map(([val, lbl]) => (
          <div key={lbl} className="bg-white/4 rounded-lg py-1.5">
            <p className="text-[11px] font-bold text-white">{val}</p>
            <p className="text-[9px] text-slate-500">{lbl}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

const STEPS: {
  n: number
  icon: React.ReactNode
  color: { accent: string; bg: string; border: string; topLine: string }
  title: string
  desc: string
  preview: React.ReactNode
}[] = [
  {
    n: 1,
    icon: <Search className="w-5 h-5" />,
    color: { accent: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', topLine: 'rgba(99,102,241,0.7)' },
    title: 'Pick a book',
    desc: 'Browse 200+ titles across topics that matter to you. Save any book to your personal reading queue.',
    preview: <StepPreview1/>,
  },
  {
    n: 2,
    icon: <BookOpen className="w-5 h-5" />,
    color: { accent: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', topLine: 'rgba(167,139,250,0.7)' },
    title: 'Read with structure',
    desc: 'Open a chapter and work through the summary and real-life examples at your chosen depth mode. No fluff, no filler.',
    preview: <StepPreview2/>,
  },
  {
    n: 3,
    icon: <HelpCircle className="w-5 h-5" />,
    color: { accent: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', topLine: 'rgba(34,211,238,0.7)' },
    title: 'Prove you understood it',
    desc: 'Answer five targeted questions before moving on. Active recall is the method that makes knowledge stick.',
    preview: <StepPreview3/>,
  },
  {
    n: 4,
    icon: <BarChart3 className="w-5 h-5" />,
    color: { accent: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', topLine: 'rgba(52,211,153,0.7)' },
    title: 'Watch yourself grow',
    desc: 'Track mastery scores, streaks, and book completion. Turn reading from a passive habit into measurable progress.',
    preview: <StepPreview4/>,
  },
]

export function HowItWorks() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <section
      id="how-it-works"
      ref={ref}
      className="py-28 relative"
      style={{ background: 'linear-gradient(180deg, #060a18 0%, #080e1c 50%, #060a18 100%)' }}
    >
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-violet-500/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-indigo-500/20 to-transparent" />

      {/* Background glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, rgba(99,102,241,0.06) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="max-w-7xl mx-auto px-5 lg:px-8 relative z-10">
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

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 28 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.65, delay: i * 0.12, ease: 'easeOut' }}
              className="relative bg-white/[0.035] hover:bg-white/6 border border-white/8 hover:border-white/14 rounded-2xl p-5 flex flex-col transition-all duration-300 hover:-translate-y-1 overflow-hidden group"
            >
              {/* Top accent line */}
              <div
                className="absolute top-0 inset-x-0 h-px"
                style={{ background: `linear-gradient(to right, transparent, ${s.color.topLine}, transparent)` }}
              />

              {/* Step header */}
              <div className="flex items-center justify-between mb-4">
                <div
                  className={`w-11 h-11 rounded-xl ${s.color.bg} ${s.color.border} border flex items-center justify-center ${s.color.accent} transition-all duration-300 group-hover:scale-110`}
                >
                  {s.icon}
                </div>
                <span className={`text-[28px] font-black ${s.color.accent} opacity-15 leading-none tabular-nums`}>
                  0{s.n}
                </span>
              </div>

              {/* Mini UI preview */}
              {s.preview}

              {/* Text */}
              <h3 className="text-[15px] font-bold text-white mb-1.5">{s.title}</h3>
              <p className="text-[13px] text-slate-400 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
