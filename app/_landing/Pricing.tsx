'use client'

import { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { CheckCircle2, Minus } from 'lucide-react'

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '',
    sub: 'Try ChapterFlow with no commitment.',
    cta: 'Start reading for free',
    ctaStyle: 'ghost',
    badge: null,
    highlight: null,
    features: [
      { text: 'Access to 200+ book library', included: true },
      { text: 'Finish up to 2 books', included: true },
      { text: 'Simple and Standard depth modes', included: true },
      { text: 'Chapter summaries and examples', included: true },
      { text: 'Chapter quizzes', included: true },
      { text: 'Deeper depth mode', included: false },
      { text: 'Unlimited books', included: false },
    ],
  },
  {
    name: 'Pro',
    price: '$7.99',
    period: 'CAD / month',
    sub: 'For readers who take learning seriously.',
    cta: 'Start Pro free for 14 days',
    ctaStyle: 'primary',
    badge: 'Most popular',
    highlight: 'Includes Deeper mode',
    features: [
      { text: 'Access to 200+ book library', included: true },
      { text: 'Unlimited books', included: true },
      { text: 'Simple and Standard depth modes', included: true },
      { text: 'Chapter summaries and examples', included: true },
      { text: 'Chapter quizzes', included: true },
      { text: 'Deeper depth mode', included: true },
      { text: 'Priority new title requests', included: true },
    ],
  },
]

export function Pricing() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <section
      id="pricing"
      ref={ref}
      className="py-28 relative"
      style={{ background: 'linear-gradient(180deg, #070b18 0%, #060a18 100%)' }}
    >
      {/* Section separators */}
      <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-indigo-500/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-indigo-500/20 to-transparent" />

      {/* Background glow */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-175 h-125 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 60% 50%, rgba(99,102,241,0.09) 0%, transparent 65%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="max-w-5xl mx-auto px-5 lg:px-8 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-14"
        >
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-indigo-400 mb-4">
            Pricing
          </span>
          <h2 className="text-[clamp(28px,4vw,50px)] font-extrabold text-white tracking-tight mb-4">
            Start free. Go deeper when you&apos;re ready.
          </h2>
          <p className="text-[16px] text-slate-400 max-w-md mx-auto leading-relaxed">
            No annual lock-in. No confusing tiers. Two plans, one purpose.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {PLANS.map((plan, i) => {
            const isPro = plan.ctaStyle === 'primary'
            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 28 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.65, delay: i * 0.12 }}
                className={`relative rounded-3xl border p-7 flex flex-col overflow-hidden ${
                  isPro ? 'border-indigo-500/40' : 'bg-white/2.5 border-white/8'
                }`}
                style={
                  isPro
                    ? {
                        background:
                          'linear-gradient(160deg, rgba(99,102,241,0.14) 0%, rgba(79,70,229,0.08) 30%, rgba(12,18,32,0.95) 70%)',
                        boxShadow:
                          '0 0 80px rgba(99,102,241,0.15), 0 32px 64px rgba(0,0,0,0.45)',
                      }
                    : {}
                }
              >
                {/* Top accent line */}
                <div
                  className="absolute top-0 inset-x-0 h-px"
                  style={{
                    background: isPro
                      ? 'linear-gradient(to right, transparent, rgba(99,102,241,0.8), rgba(167,139,250,0.6), transparent)'
                      : 'linear-gradient(to right, transparent, rgba(255,255,255,0.1), transparent)',
                  }}
                />

                {/* Pro: radial inner glow */}
                {isPro && (
                  <div
                    className="absolute top-0 inset-x-0 h-48 pointer-events-none"
                    style={{
                      background:
                        'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 70%)',
                    }}
                  />
                )}

                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="text-[11px] font-bold text-white bg-indigo-600 px-3.5 py-1 rounded-full shadow-lg shadow-indigo-600/40">
                      {plan.badge}
                    </span>
                  </div>
                )}

                <div className="relative mb-6">
                  <p
                    className={`text-[12px] font-bold uppercase tracking-widest mb-2 ${
                      isPro ? 'text-indigo-400' : 'text-slate-500'
                    }`}
                  >
                    {plan.name}
                  </p>
                  <div className="flex items-end gap-1.5 mb-2">
                    <span className="text-[44px] font-black text-white tracking-tight leading-none">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-[14px] text-slate-400 mb-1.5 font-medium">{plan.period}</span>
                    )}
                  </div>
                  <p className="text-[13.5px] text-slate-400 mb-3">{plan.sub}</p>

                  {plan.highlight && (
                    <div className="inline-flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 rounded-full px-3 py-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span className="text-[11px] font-semibold text-amber-400">{plan.highlight}</span>
                    </div>
                  )}
                </div>

                <ul className="space-y-3 mb-7 flex-1 relative">
                  {plan.features.map(({ text, included }) => (
                    <li key={text} className="flex items-start gap-3">
                      <span
                        className={`shrink-0 mt-0.5 ${
                          included
                            ? isPro
                              ? 'text-indigo-400'
                              : 'text-slate-400'
                            : 'text-slate-700'
                        }`}
                      >
                        {included ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <Minus className="w-4 h-4" />
                        )}
                      </span>
                      <span
                        className={`text-[13.5px] font-medium ${
                          included
                            ? isPro
                              ? 'text-slate-200'
                              : 'text-slate-300'
                            : 'text-slate-600'
                        }`}
                      >
                        {text}
                      </span>
                    </li>
                  ))}
                </ul>

                <a
                  href="/auth/login?returnTo=%2Fbook"
                  className={`block text-center font-semibold text-[14px] px-5 py-3.5 rounded-xl transition-all duration-200 ${
                    isPro
                      ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/35 hover:shadow-indigo-500/45 hover:-translate-y-0.5'
                      : 'bg-white/6 hover:bg-white/10 text-slate-200 border border-white/10'
                  }`}
                >
                  {plan.cta}
                </a>
              </motion.div>
            )
          })}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.5 }}
          className="text-center text-[13px] text-slate-600 mt-8"
        >
          Pro trial requires no credit card. Cancel before 14 days and you will never be charged.
        </motion.p>
      </div>
    </section>
  )
}
