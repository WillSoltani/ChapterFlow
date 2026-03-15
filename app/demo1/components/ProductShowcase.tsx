'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { BookOpen, Lightbulb, HelpCircle, BarChart3, CheckCircle2, ChevronRight } from 'lucide-react'

type MainTab = 'summary' | 'examples' | 'quiz' | 'progress'
type ExampleAudience = 'student' | 'work' | 'personal'

const MAIN_TABS: { id: MainTab; label: string; icon: React.ReactNode }[] = [
  { id: 'summary', label: 'Chapter Summary', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'examples', label: 'Real-Life Examples', icon: <Lightbulb className="w-4 h-4" /> },
  { id: 'quiz', label: 'Chapter Quiz', icon: <HelpCircle className="w-4 h-4" /> },
  { id: 'progress', label: 'Your Progress', icon: <BarChart3 className="w-4 h-4" /> },
]

const EXAMPLES: Record<ExampleAudience, { name: string; role: string; scenario: string }> = {
  student: {
    name: 'Maya, 21',
    role: 'University student',
    scenario:
      'Instead of trying to study for 3 hours straight, Maya placed her textbooks on her desk before bed each night (cue). The next morning, seeing the books open created an immediate craving to continue. Her response: 25 minutes of study before breakfast. Reward: coffee. After two weeks, the habit was automatic.',
  },
  work: {
    name: 'Daniel, 34',
    role: 'Product manager',
    scenario:
      'After his morning stand-up ends (cue), Daniel feels a craving to "get ahead" of his day. His response: immediately opening his task manager and tagging the one thing that matters most. Reward: a visible priority at the top of the screen. Decision fatigue dropped by noon.',
  },
  personal: {
    name: 'Sara, 29',
    role: 'Freelance designer',
    scenario:
      'Sara put her running shoes next to the door every evening (cue). The visible shoes created a mild craving for the satisfaction of a morning run. Response: lacing up and going — no decision required. Reward: energy boost. She went from 0 to 5 days per week in under a month.',
  },
}

const QUIZ_QUESTION = {
  text: 'What is the correct order of the four stages in the habit loop, as described by James Clear?',
  options: [
    { id: 'a', text: 'Craving → Cue → Response → Reward' },
    { id: 'b', text: 'Cue → Craving → Response → Reward', correct: true },
    { id: 'c', text: 'Response → Cue → Reward → Craving' },
    { id: 'd', text: 'Cue → Response → Craving → Reward' },
  ],
  explanation:
    'The habit loop always starts with a Cue (the trigger), which leads to a Craving (desire), then a Response (action), and finally the Reward that reinforces the loop.',
}

export function ProductShowcase() {
  const [activeTab, setActiveTab] = useState<MainTab>('summary')
  const [exampleTab, setExampleTab] = useState<ExampleAudience>('student')
  const [quizSelected, setQuizSelected] = useState<string | null>(null)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  const quizAnswered = quizSelected !== null
  const quizCorrect = quizSelected === 'b'

  return (
    <section id="features" ref={ref} className="py-28 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-5 lg:px-8">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-14"
        >
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-indigo-400 mb-4">
            Interactive product demo
          </span>
          <h2 className="text-[clamp(28px,4vw,52px)] font-extrabold text-white tracking-tight mb-4">
            Your reading session,{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              redesigned from scratch
            </span>
          </h2>
          <p className="text-[16px] text-slate-400 max-w-xl mx-auto leading-relaxed">
            Every chapter becomes a structured learning session — not just pages to get through. Explore how it works.
          </p>
        </motion.div>

        {/* Product panel */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="bg-[#0b1024] rounded-3xl border border-white/[0.08] shadow-2xl overflow-hidden"
          style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.1)' }}
        >
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-5 py-3.5 bg-white/[0.02] border-b border-white/[0.06]">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/50" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
              <div className="w-3 h-3 rounded-full bg-green-500/50" />
            </div>
            <div className="flex-1 mx-4">
              <div className="max-w-xs mx-auto bg-white/[0.04] rounded-md px-3 py-1 text-[11px] text-slate-500 font-mono text-center">
                app.chapterflow.io/books/atomic-habits/chapter/3
              </div>
            </div>
          </div>

          {/* Book header bar */}
          <div className="flex items-center gap-4 px-6 py-4 bg-white/[0.02] border-b border-white/[0.06]">
            <div className="w-8 h-11 rounded bg-gradient-to-br from-indigo-700 to-violet-800 border border-indigo-500/30 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-white truncate">Atomic Habits — Chapter 3</p>
              <p className="text-[11px] text-slate-500">How to Build Better Habits in 4 Simple Steps</p>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex gap-1">
                {['Simple', 'Standard', 'Deeper'].map((m) => (
                  <span
                    key={m}
                    className={`text-[11px] font-medium px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
                      m === 'Standard'
                        ? 'bg-indigo-600/80 text-white'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Tab navigation */}
          <div className="flex overflow-x-auto border-b border-white/[0.06] bg-white/[0.015]">
            {MAIN_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap px-5 py-3.5 text-[13px] font-medium transition-all border-b-2 relative ${
                  activeTab === tab.id
                    ? 'text-indigo-400 border-indigo-500'
                    : 'text-slate-500 border-transparent hover:text-slate-300'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'quiz' && quizCorrect && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-0.5" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="min-h-[420px] p-6">
            <AnimatePresence mode="wait">
              {/* ── SUMMARY ── */}
              {activeTab === 'summary' && (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-3xl"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                      Standard depth
                    </span>
                    <span className="text-[11px] text-slate-600">~4 min read</span>
                  </div>

                  <h3 className="text-[20px] font-bold text-white mb-3">
                    The Four Laws of Behavior Change
                  </h3>

                  <p className="text-[14px] text-slate-300 leading-relaxed mb-4">
                    Every habit follows the same four-stage loop: <strong className="text-white">Cue</strong>,{' '}
                    <strong className="text-white">Craving</strong>,{' '}
                    <strong className="text-white">Response</strong>, and{' '}
                    <strong className="text-white">Reward</strong>. Your brain constantly scans the environment for
                    cues that predict rewarding experiences — and when it finds one, it triggers an automatic chain of
                    events.
                  </p>

                  <p className="text-[14px] text-slate-300 leading-relaxed mb-5">
                    To build a new habit, you need to engineer each stage. To break a bad one, you need to disrupt the
                    chain at its weakest point.
                  </p>

                  <div className="grid sm:grid-cols-2 gap-3 mb-5">
                    {[
                      { stage: '01 Cue', color: 'indigo', desc: 'The trigger that initiates the behavior. Make it obvious.' },
                      { stage: '02 Craving', color: 'violet', desc: 'The motivational force. Make it attractive.' },
                      { stage: '03 Response', color: 'cyan', desc: 'The actual habit performed. Make it easy.' },
                      { stage: '04 Reward', color: 'emerald', desc: 'The end goal that satisfies the craving. Make it satisfying.' },
                    ].map(({ stage, desc }) => (
                      <div key={stage} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-3.5">
                        <p className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider mb-1">{stage}</p>
                        <p className="text-[13px] text-slate-300 leading-relaxed">{desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-indigo-500/8 border border-indigo-500/20 rounded-xl p-4">
                    <p className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider mb-2">Key insight</p>
                    <p className="text-[13px] text-slate-300 leading-relaxed italic">
                      &ldquo;You do not rise to the level of your goals. You fall to the level of your systems. Building
                      better habits is not about trying harder - it is about engineering better environments.&rdquo;
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1.5">— James Clear, Atomic Habits</p>
                  </div>

                  <button
                    onClick={() => setActiveTab('examples')}
                    className="mt-5 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[13px] px-5 py-2.5 rounded-xl transition-colors"
                  >
                    Continue to Real-Life Examples
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {/* ── EXAMPLES ── */}
              {activeTab === 'examples' && (
                <motion.div
                  key="examples"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-3xl"
                >
                  <div className="mb-5">
                    <p className="text-[13px] text-slate-400 mb-4">
                      See how this chapter&apos;s core ideas apply to three different real-life contexts. Pick the one that
                      resonates with you.
                    </p>
                    <div className="flex gap-2">
                      {(['student', 'work', 'personal'] as ExampleAudience[]).map((t) => (
                        <button
                          key={t}
                          onClick={() => setExampleTab(t)}
                          className={`text-[13px] font-semibold px-4 py-1.5 rounded-full capitalize transition-all ${
                            exampleTab === t
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                              : 'bg-white/[0.05] text-slate-400 hover:text-white border border-white/[0.08]'
                          }`}
                        >
                          {t === 'student' ? '🎓 Student' : t === 'work' ? '💼 Work' : '🏃 Personal'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    <motion.div
                      key={exampleTab}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="bg-[#0d1530] border border-white/[0.08] rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-9 h-9 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-[18px]">
                            {exampleTab === 'student' ? '🎓' : exampleTab === 'work' ? '💼' : '🏃'}
                          </div>
                          <div>
                            <p className="text-[13px] font-semibold text-white">{EXAMPLES[exampleTab].name}</p>
                            <p className="text-[11px] text-slate-500">{EXAMPLES[exampleTab].role}</p>
                          </div>
                        </div>
                        <p className="text-[14px] text-slate-300 leading-[1.75]">{EXAMPLES[exampleTab].scenario}</p>
                      </div>

                      <div className="mt-4 bg-violet-500/8 border border-violet-500/20 rounded-xl p-4">
                        <p className="text-[12px] font-semibold text-violet-400 uppercase tracking-wider mb-1.5">
                          Why it works
                        </p>
                        <p className="text-[13px] text-slate-400 leading-relaxed">
                          The habit loop stages are all present: a deliberate environmental cue, a natural craving, a
                          low-friction response, and a clear reward. The system does the work so willpower does not have to.
                        </p>
                      </div>
                    </motion.div>
                  </AnimatePresence>

                  <button
                    onClick={() => setActiveTab('quiz')}
                    className="mt-5 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[13px] px-5 py-2.5 rounded-xl transition-colors"
                  >
                    Take the chapter quiz
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </motion.div>
              )}

              {/* ── QUIZ ── */}
              {activeTab === 'quiz' && (
                <motion.div
                  key="quiz"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-2xl"
                >
                  <div className="flex items-center gap-2 mb-5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Question 1 of 5
                    </span>
                    <div className="flex gap-1 ml-2">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 w-8 rounded-full ${i === 0 ? 'bg-indigo-500' : 'bg-white/[0.1]'}`}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="text-[17px] font-semibold text-white leading-snug mb-6">
                    {QUIZ_QUESTION.text}
                  </p>

                  <div className="space-y-3 mb-5">
                    {QUIZ_QUESTION.options.map((opt) => {
                      const isSelected = quizSelected === opt.id
                      const isCorrect = opt.correct
                      let stateClass = 'bg-white/[0.04] border-white/[0.1] text-slate-300 hover:border-indigo-500/40 hover:bg-indigo-500/5 cursor-pointer'
                      if (quizAnswered && isSelected && isCorrect)
                        stateClass = 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 cursor-default'
                      else if (quizAnswered && isSelected && !isCorrect)
                        stateClass = 'bg-red-500/10 border-red-500/30 text-red-300 cursor-default'
                      else if (quizAnswered && isCorrect)
                        stateClass = 'bg-emerald-500/8 border-emerald-500/30 text-emerald-300 cursor-default'
                      else if (quizAnswered)
                        stateClass = 'bg-white/[0.02] border-white/[0.05] text-slate-500 cursor-default'

                      return (
                        <motion.button
                          key={opt.id}
                          onClick={() => !quizAnswered && setQuizSelected(opt.id)}
                          className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left text-[14px] font-medium transition-all ${stateClass}`}
                          whileHover={!quizAnswered ? { x: 3 } : {}}
                          whileTap={!quizAnswered ? { scale: 0.99 } : {}}
                        >
                          <span
                            className={`w-6 h-6 rounded-full border flex-shrink-0 flex items-center justify-center text-[11px] font-bold ${
                              quizAnswered && isSelected && isCorrect
                                ? 'bg-emerald-500 border-emerald-400 text-white'
                                : quizAnswered && isSelected
                                ? 'bg-red-500 border-red-400 text-white'
                                : 'border-current opacity-50'
                            }`}
                          >
                            {opt.id.toUpperCase()}
                          </span>
                          {opt.text}
                          {quizAnswered && isCorrect && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-auto flex-shrink-0" />
                          )}
                        </motion.button>
                      )
                    })}
                  </div>

                  <AnimatePresence>
                    {quizAnswered && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className={`rounded-xl p-4 mb-4 border ${
                          quizCorrect
                            ? 'bg-emerald-500/8 border-emerald-500/25'
                            : 'bg-orange-500/8 border-orange-500/25'
                        }`}
                      >
                        <p className={`text-[11px] font-semibold uppercase tracking-wider mb-1.5 ${quizCorrect ? 'text-emerald-400' : 'text-orange-400'}`}>
                          {quizCorrect ? '✓ Correct' : 'Not quite — here is why:'}
                        </p>
                        <p className="text-[13px] text-slate-300 leading-relaxed">{QUIZ_QUESTION.explanation}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {quizCorrect ? (
                    <button
                      onClick={() => setActiveTab('progress')}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[13px] px-5 py-2.5 rounded-xl transition-colors"
                    >
                      Chapter unlocked — view progress
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : !quizAnswered ? null : (
                    <button
                      onClick={() => setQuizSelected(null)}
                      className="flex items-center gap-2 bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 font-medium text-[13px] px-5 py-2.5 rounded-xl border border-white/[0.1] transition-colors"
                    >
                      Try again
                    </button>
                  )}
                </motion.div>
              )}

              {/* ── PROGRESS ── */}
              {activeTab === 'progress' && (
                <motion.div
                  key="progress"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.3 }}
                  className="max-w-3xl"
                >
                  <div className="grid sm:grid-cols-3 gap-4 mb-6">
                    {[
                      { label: 'Chapters done', value: '3 / 20', sub: 'Atomic Habits', color: 'text-indigo-400' },
                      { label: 'Quiz average', value: '92%', sub: 'Last 5 quizzes', color: 'text-emerald-400' },
                      { label: 'Reading streak', value: '7 days', sub: 'Current streak', color: 'text-orange-400' },
                    ].map(({ label, value, sub, color }) => (
                      <div key={label} className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-4 text-center">
                        <p className={`text-[26px] font-extrabold tracking-tight ${color}`}>{value}</p>
                        <p className="text-[12px] font-semibold text-white mt-0.5">{label}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">{sub}</p>
                      </div>
                    ))}
                  </div>

                  <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Chapter checklist — Ch. 3
                  </p>
                  <div className="space-y-2.5 mb-6">
                    {[
                      { label: 'Chapter summary read', done: true },
                      { label: 'Real-life examples reviewed', done: true },
                      { label: 'Quiz completed (5/5)', done: quizCorrect },
                    ].map(({ label, done }) => (
                      <div key={label} className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center transition-all ${
                            done ? 'bg-indigo-600 border-indigo-500' : 'border-white/[0.15] bg-transparent'
                          }`}
                        >
                          {done && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`text-[13px] font-medium ${done ? 'text-slate-300' : 'text-slate-600'}`}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    Book progress — Atomic Habits
                  </p>
                  <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4">
                    <div className="flex justify-between text-[12px] mb-2">
                      <span className="text-slate-400 font-medium">3 of 20 chapters</span>
                      <span className="text-indigo-400 font-semibold">15%</span>
                    </div>
                    <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-indigo-600 to-violet-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: '15%' }}
                        transition={{ duration: 1.2, ease: 'easeOut' }}
                      />
                    </div>
                    <div className="flex gap-1.5 mt-3 flex-wrap">
                      {Array.from({ length: 20 }, (_, i) => (
                        <div
                          key={i}
                          className={`w-6 h-2 rounded-full ${i < 3 ? 'bg-indigo-500' : 'bg-white/[0.07]'}`}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
