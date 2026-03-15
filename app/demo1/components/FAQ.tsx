'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { Plus, Minus } from 'lucide-react'

const FAQS = [
  {
    q: 'What exactly does ChapterFlow do?',
    a: 'ChapterFlow takes a book and structures every chapter as a guided learning session. You read a layered summary at your chosen depth, explore real-life examples across student, work, and personal contexts, and then answer five quiz questions to prove understanding before moving to the next chapter. The result is genuine comprehension rather than pages turned.',
  },
  {
    q: 'How is this different from just reading the book myself?',
    a: 'Reading passively is easy. Retaining what you read is not. ChapterFlow adds three layers that standard reading lacks: structured summaries that organize the key ideas, applied examples that make abstract concepts concrete, and active recall through quizzes that force retrieval — the method proven by memory science to build long-term retention.',
  },
  {
    q: 'What happens if I fail a quiz?',
    a: 'You get another attempt. ChapterFlow shows you which answers were wrong, explains why the correct answer is right, and lets you retry. The goal is understanding, not gatekeeping. You can retake a quiz as many times as needed before advancing.',
  },
  {
    q: 'What is "Deeper mode" and when should I use it?',
    a: 'Deeper mode provides an extended breakdown of the chapter — more context, additional examples, nuanced analysis, and edge cases that Standard mode does not cover. Use it when a topic is central to your goals or when you want to genuinely master a subject rather than just understand it at a surface level. It is only available on the Pro plan.',
  },
  {
    q: 'How many books are available right now?',
    a: 'ChapterFlow currently has over 200 books across 15+ categories including habits, productivity, leadership, psychology, finance, and philosophy. New titles are added every week. If there is a book you want that is not in the library, you can submit a request from within your account.',
  },
  {
    q: 'Is the free plan actually free with no credit card?',
    a: 'Yes. The free plan requires no credit card and no payment information of any kind. You can read and complete up to two books in Simple and Standard mode at no cost, for as long as you like. There is no trial period on the free plan.',
  },
]

function FAQItem({ q, a, i }: { q: string; a: string; i: number }) {
  const [open, setOpen] = useState(false)
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: i * 0.07, duration: 0.5 }}
      className={`border rounded-2xl overflow-hidden transition-colors duration-200 ${
        open ? 'border-indigo-500/30 bg-indigo-500/[0.04]' : 'border-white/[0.07] bg-white/[0.025]'
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
        aria-expanded={open}
      >
        <span className="text-[15px] font-semibold text-white leading-snug">{q}</span>
        <span
          className={`flex-shrink-0 w-7 h-7 rounded-full border flex items-center justify-center transition-all duration-200 ${
            open ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-400' : 'border-white/[0.12] text-slate-500'
          }`}
        >
          {open ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <p className="px-6 pb-5 text-[14px] text-slate-400 leading-[1.75]">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function FAQ() {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })

  return (
    <section id="faq" ref={ref} className="py-28">
      <div className="max-w-3xl mx-auto px-5 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-12"
        >
          <span className="inline-block text-[11px] font-semibold uppercase tracking-[0.15em] text-indigo-400 mb-4">
            Common questions
          </span>
          <h2 className="text-[clamp(28px,4vw,48px)] font-extrabold text-white tracking-tight mb-4">
            Everything you need to know
          </h2>
          <p className="text-[15px] text-slate-400 leading-relaxed">
            If something is not covered here,{' '}
            <a href="#" className="text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
              reach out directly
            </a>
            .
          </p>
        </motion.div>

        {inView && (
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <FAQItem key={f.q} q={f.q} a={f.a} i={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
