'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Zap } from 'lucide-react'

const START_FREE_HREF = '/auth/login?returnTo=%2Fbook'

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 pb-16 overflow-hidden">

      {/* ── Background ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: 'radial-gradient(rgba(139,92,246,0.9) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <motion.div
          className="absolute -top-40 -left-20 w-170 h-170 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.32) 0%, rgba(79,70,229,0.08) 50%, transparent 70%)',
            filter: 'blur(80px)',
          }}
          animate={{ x: [0, 35, -18, 0], y: [0, -45, 22, 0], scale: [1, 1.1, 0.94, 1] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute -bottom-32 -right-20 w-130 h-130 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(34,211,238,0.16) 0%, transparent 65%)',
            filter: 'blur(75px)',
          }}
          animate={{ x: [0, -28, 14, 0], y: [0, 35, -18, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
        />
        <div className="absolute top-0 inset-x-0 h-[55%] bg-linear-to-b from-indigo-950/25 to-transparent" />
        <div className="absolute bottom-0 inset-x-0 h-36 bg-linear-to-t from-[#070b18] to-transparent" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-14 xl:gap-20 items-center">

          {/* ── Left: copy ── */}
          <div>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 rounded-full mb-7">
                <Zap className="w-3 h-3 fill-indigo-400" />
                Guided reading platform
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-[clamp(40px,5.5vw,70px)] font-black leading-[1.06] tracking-tight text-white mb-6"
            >
              Finish books.{' '}
              <span className="bg-linear-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
                Actually
              </span>{' '}
              understand them.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-[17px] text-slate-400 leading-[1.75] mb-8 max-w-122.5"
            >
              ChapterFlow structures every chapter with layered summaries, real-life examples, and quizzes — so you
              stop reading passively and start learning intentionally.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap items-center gap-3 mb-8"
            >
              <a
                href={START_FREE_HREF}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[15px] px-6 py-3.5 rounded-full transition-all duration-200 shadow-xl shadow-indigo-600/30 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
              >
                Start reading for free <span aria-hidden>→</span>
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 bg-white/6 hover:bg-white/10 text-slate-200 font-medium text-[15px] px-6 py-3.5 rounded-full border border-white/10 hover:border-white/18 transition-all duration-200"
              >
                See how it works
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-wrap gap-5"
            >
              {['200+ books available', 'Free to start', 'No credit card needed'].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] text-slate-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                  {t}
                </span>
              ))}
            </motion.div>
          </div>

          {/* ── Right: product preview ── */}
          {/*
            Badges are placed in a grid row BELOW the card — no negative
            positioning, no overlap, no z-index interference whatsoever.
          */}
          <motion.div
            initial={{ opacity: 0, x: 36, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.9, delay: 0.4, ease: 'easeOut' }}
            className="relative hidden lg:flex flex-col gap-3"
          >
            <div
              className="absolute -inset-12 rounded-[48px] pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at 60% 40%, rgba(99,102,241,0.14) 0%, transparent 70%)',
              }}
            />

            {/* ── Main reading card ── */}
            <div className="relative bg-[#0c1220] rounded-2xl border border-white/9 shadow-2xl overflow-hidden">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-black/25 border-b border-white/6">
                <div className="flex gap-1.5">
                  {['bg-red-400/50', 'bg-yellow-400/50', 'bg-green-400/50'].map((c, i) => (
                    <div key={i} className={`w-2.5 h-2.5 rounded-full ${c}`} />
                  ))}
                </div>
                <div className="flex-1 mx-3">
                  <div className="bg-white/4 rounded px-3 py-0.5 text-[11px] text-slate-600 font-mono text-center">
                    app.chapterflow.io/read
                  </div>
                </div>
              </div>

              {/* App header */}
              <div className="px-5 py-3.5 border-b border-white/6 bg-linear-to-b from-white/2.5 to-transparent">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-11 rounded-lg bg-linear-to-br from-indigo-600 to-violet-700 border border-indigo-500/40 shrink-0 shadow-lg shadow-indigo-800/40" />
                    <div>
                      <p className="text-[13px] font-semibold text-white leading-tight">Atomic Habits</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">James Clear · Chapter 3 of 20</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[11px] text-indigo-400 font-semibold mb-1.5">35%</p>
                    <div className="w-20 h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-linear-to-r from-indigo-500 to-violet-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: '35%' }}
                        transition={{ duration: 1.4, delay: 0.9, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Depth mode selector */}
                <div className="flex gap-1.5">
                  {[
                    { label: 'Simple', style: 'bg-white/5 text-slate-500' },
                    { label: 'Standard', style: 'bg-indigo-600 text-white shadow-sm shadow-indigo-800/50' },
                    { label: '✦ Deeper', style: 'bg-amber-500/10 text-amber-400 border border-amber-500/25' },
                  ].map(({ label, style }) => (
                    <button key={label} className={`text-[10.5px] font-semibold px-2.5 py-1 rounded-full transition-all ${style}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary content */}
              <div className="px-5 py-4">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-indigo-400 mb-2">
                  Chapter Summary
                </p>
                <p className="text-[12.5px] text-slate-300 leading-relaxed mb-3">
                  Every habit follows the same four-stage loop: Cue, Craving, Response, and Reward. Your brain
                  constantly scans for cues that predict rewarding experiences.
                </p>
                <div className="space-y-1.5 mb-4">
                  {[
                    'Cues are environmental triggers that start the habit loop',
                    'Cravings are the motivational force that drives behavior',
                    'The response is the habit itself — a thought or action',
                  ].map((pt) => (
                    <div key={pt} className="flex items-start gap-2">
                      <div className="w-1 h-1 rounded-full bg-indigo-400/60 mt-2 shrink-0" />
                      <p className="text-[11.5px] text-slate-400 leading-relaxed">{pt}</p>
                    </div>
                  ))}
                </div>

                {/* Step progress */}
                <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                  {[
                    { label: 'Summary', done: true },
                    { label: 'Examples', done: false },
                    { label: 'Quiz', done: false },
                  ].map(({ label, done }) => (
                    <div
                      key={label}
                      className={`flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-full ${
                        done
                          ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                          : 'bg-white/4 text-slate-600 border border-white/6'
                      }`}
                    >
                      {done && <CheckCircle2 className="w-2.5 h-2.5" />}
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              <div className="px-5 pb-4">
                <button className="w-full bg-indigo-600/90 hover:bg-indigo-600 text-white text-[12.5px] font-semibold py-2 rounded-lg transition-colors">
                  Continue to Real-Life Examples →
                </button>
              </div>
            </div>

            {/* ── Stat badges — clean row below the card, no interference ── */}
            <div className="grid grid-cols-2 gap-3">
              <motion.div
                className="bg-[#0c1220] border border-white/8 rounded-xl px-4 py-3 flex items-center gap-3"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-[18px] shrink-0">
                  🔥
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-white leading-tight">7-day streak</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Keep it going</p>
                </div>
              </motion.div>

              <motion.div
                className="bg-[#0c1220] border border-white/8 rounded-xl px-4 py-3 flex items-center gap-3"
                animate={{ y: [0, -2, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-white leading-tight">Quiz passed</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Ch. 2 · 5/5 correct</p>
                </div>
              </motion.div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
