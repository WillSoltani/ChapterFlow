'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Zap } from 'lucide-react'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.7 } }),
}

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-16 pb-12 overflow-hidden">
      {/* ── Animated background ── */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
        {/* Orb 1 — indigo */}
        <motion.div
          className="absolute top-[-10%] left-[-5%] w-[700px] h-[700px] rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)', filter: 'blur(80px)' }}
          animate={{ x: [0, 40, -20, 0], y: [0, -60, 30, 0], scale: [1, 1.15, 0.9, 1] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
        />
        {/* Orb 2 — cyan */}
        <motion.div
          className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #22d3ee 0%, transparent 70%)', filter: 'blur(80px)' }}
          animate={{ x: [0, -40, 20, 0], y: [0, 50, -30, 0], scale: [1, 0.9, 1.1, 1] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
        />
        {/* Orb 3 — violet */}
        <motion.div
          className="absolute top-[40%] left-[40%] w-[400px] h-[400px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #a78bfa 0%, transparent 70%)', filter: 'blur(60px)' }}
          animate={{ x: [0, 30, -30, 0], y: [0, -30, 40, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        />
        {/* Vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#070b18]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-5 lg:px-8 w-full">
        <div className="grid lg:grid-cols-2 gap-14 items-center">

          {/* ── Left copy ── */}
          <div>
            <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0}>
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.15em] text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 rounded-full mb-6">
                <Zap className="w-3 h-3 fill-indigo-400" />
                Guided reading platform
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={1}
              className="text-[clamp(38px,5.5vw,72px)] font-black leading-[1.06] tracking-tight text-white mb-6"
            >
              Finish books.{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
                Actually
              </span>{' '}
              understand them.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={2}
              className="text-[17px] text-slate-400 leading-relaxed mb-8 max-w-[500px]"
            >
              ChapterFlow structures every chapter with layered summaries, real-life examples, and quizzes — so you stop
              reading passively and start learning intentionally.
            </motion.p>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={3}
              className="flex flex-wrap items-center gap-3 mb-8"
            >
              <a
                href="#"
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[15px] px-6 py-3 rounded-full transition-all duration-200 shadow-xl shadow-indigo-600/30 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
              >
                Start reading for free
                <span aria-hidden>→</span>
              </a>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 font-medium text-[15px] px-6 py-3 rounded-full border border-white/[0.1] transition-all duration-200"
              >
                See how it works
              </a>
            </motion.div>

            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={4}
              className="flex flex-wrap gap-4"
            >
              {['200+ books available', 'Free to start', 'No credit card needed'].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] text-slate-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" />
                  {t}
                </span>
              ))}
            </motion.div>
          </div>

          {/* ── Right: product mockup ── */}
          <motion.div
            initial={{ opacity: 0, x: 40, y: 20 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
            className="relative hidden lg:block"
          >
            {/* Glow behind card */}
            <div className="absolute inset-0 bg-indigo-600/10 rounded-3xl blur-3xl scale-110" />

            {/* Main mockup card */}
            <div className="relative bg-[#0d1225] rounded-2xl border border-white/[0.09] shadow-2xl overflow-hidden">
              {/* Browser bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                </div>
                <div className="flex-1 mx-3">
                  <div className="bg-white/[0.05] rounded-md px-3 py-1 text-[11px] text-slate-500 font-mono text-center">
                    app.chapterflow.io/read
                  </div>
                </div>
              </div>

              {/* App header */}
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-12 rounded-md bg-gradient-to-br from-indigo-700 to-violet-800 border border-indigo-600/30 flex-shrink-0" />
                    <div>
                      <p className="text-[13px] font-semibold text-white">Atomic Habits</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">James Clear • Chapter 3 of 20</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-indigo-400 font-semibold">35%</p>
                    <div className="w-20 h-1.5 bg-white/[0.08] rounded-full mt-1 overflow-hidden">
                      <div className="h-full w-[35%] bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full" />
                    </div>
                  </div>
                </div>

                {/* Mode selector */}
                <div className="flex gap-1.5 mt-3">
                  {['Simple', 'Standard', 'Deeper'].map((m) => (
                    <button
                      key={m}
                      className={`text-[11px] font-semibold px-3 py-1 rounded-full transition-colors ${
                        m === 'Standard'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/[0.05] text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary content */}
              <div className="px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-400 mb-2">
                  Chapter Summary
                </p>
                <p className="text-[12.5px] text-slate-300 leading-relaxed mb-3">
                  Every habit follows the same four-stage loop: Cue, Craving, Response, and Reward. Your brain is
                  constantly scanning for cues that predict rewarding experiences.
                </p>
                <div className="space-y-2 mb-4">
                  {[
                    'Cues are environmental triggers that start the habit loop',
                    'Cravings are the motivational force that drives behavior',
                    'The response is the habit itself — a thought or action',
                  ].map((pt) => (
                    <div key={pt} className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0" />
                      <p className="text-[11.5px] text-slate-400 leading-relaxed">{pt}</p>
                    </div>
                  ))}
                </div>

                {/* Chapter step indicator */}
                <div className="flex items-center gap-2 pt-3 border-t border-white/[0.06]">
                  {[
                    { label: 'Summary', done: true },
                    { label: 'Examples', done: false },
                    { label: 'Quiz', done: false },
                  ].map(({ label, done }) => (
                    <div
                      key={label}
                      className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${
                        done
                          ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                          : 'bg-white/[0.04] text-slate-500 border border-white/[0.07]'
                      }`}
                    >
                      {done && <CheckCircle2 className="w-3 h-3" />}
                      {label}
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA bar */}
              <div className="px-5 pb-4">
                <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] font-semibold py-2.5 rounded-xl transition-colors">
                  Continue to Real-Life Examples →
                </button>
              </div>
            </div>

            {/* Floating badge — streak */}
            <motion.div
              className="absolute -bottom-4 -left-8 bg-[#0d1225] border border-white/[0.1] rounded-2xl px-4 py-3 shadow-2xl"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center text-lg">
                  🔥
                </div>
                <div>
                  <p className="text-[13px] font-bold text-white">7-day streak</p>
                  <p className="text-[11px] text-slate-500">Keep it going</p>
                </div>
              </div>
            </motion.div>

            {/* Floating badge — quiz */}
            <motion.div
              className="absolute -top-4 -right-6 bg-[#0d1225] border border-white/[0.1] rounded-2xl px-4 py-3 shadow-2xl"
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-[12px] font-semibold text-white">Quiz passed</p>
                  <p className="text-[10px] text-slate-500">Ch. 2 — 5/5 correct</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#070b18] to-transparent pointer-events-none" />
    </section>
  )
}
