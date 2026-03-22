"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SectionReveal } from "@/components/ui/SectionReveal";
import { SectionLabel } from "@/components/ui/SectionLabel";

/* ------------------------------------------------------------------ */
/*  Tab definitions                                                    */
/* ------------------------------------------------------------------ */

const TABS = ["Summary", "Scenarios", "Quiz", "Unlock"] as const;
type TabIndex = 0 | 1 | 2 | 3;

const AUTO_ADVANCE_MS = 6000;

/* ------------------------------------------------------------------ */
/*  Confetti dots (static decoration for Unlock tab)                   */
/* ------------------------------------------------------------------ */

const confettiDots = [
  { x: "8%", y: "12%", size: 6, color: "var(--accent-teal)" },
  { x: "18%", y: "6%", size: 4, color: "var(--accent-green)" },
  { x: "30%", y: "18%", size: 5, color: "var(--accent-orange)" },
  { x: "45%", y: "8%", size: 7, color: "var(--accent-teal)" },
  { x: "60%", y: "14%", size: 4, color: "var(--accent-green)" },
  { x: "72%", y: "5%", size: 6, color: "var(--accent-orange)" },
  { x: "85%", y: "10%", size: 5, color: "var(--accent-teal)" },
  { x: "92%", y: "20%", size: 4, color: "var(--accent-green)" },
  { x: "12%", y: "85%", size: 5, color: "var(--accent-orange)" },
  { x: "25%", y: "90%", size: 4, color: "var(--accent-teal)" },
  { x: "40%", y: "88%", size: 6, color: "var(--accent-green)" },
  { x: "55%", y: "92%", size: 5, color: "var(--accent-orange)" },
  { x: "70%", y: "86%", size: 4, color: "var(--accent-teal)" },
  { x: "82%", y: "90%", size: 7, color: "var(--accent-green)" },
  { x: "5%", y: "50%", size: 4, color: "var(--accent-orange)" },
  { x: "95%", y: "55%", size: 5, color: "var(--accent-teal)" },
];

/* ------------------------------------------------------------------ */
/*  Content transition wrapper                                         */
/* ------------------------------------------------------------------ */

function TabContent({ tabKey, children }: { tabKey: number; children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={tabKey}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Summary Tab                                                        */
/* ------------------------------------------------------------------ */

function SummaryContent() {
  const keyPoints = [
    "Give your full, undivided attention when someone speaks",
    "Ask questions that show genuine curiosity",
    "Encourage others to talk about themselves and their interests",
  ];

  return (
    <div className="space-y-6">
      {/* Book & chapter header */}
      <div>
        <p className="text-xs uppercase tracking-wider text-[--text-muted] font-[family-name:var(--font-display)]">
          How to Win Friends and Influence People
        </p>
        <h3 className="text-xl font-semibold text-[--text-heading] mt-1 font-[family-name:var(--font-display)]">
          Chapter 4: Be a Good Listener
        </h3>
      </div>

      {/* Main Idea card */}
      <div className="rounded-xl bg-[--bg-glass] border border-[--border-subtle] p-5">
        <span className="text-[0.7rem] font-semibold uppercase tracking-widest text-[--accent-teal] font-[family-name:var(--font-display)]">
          Main Idea
        </span>
        <p className="text-[--text-heading] mt-2 leading-relaxed font-[family-name:var(--font-body)]">
          Becoming a good listener is one of the most powerful ways to win people over. Most people
          are so eager to talk about themselves that a person who genuinely listens stands out.
        </p>
      </div>

      {/* Key Insight */}
      <div className="rounded-xl bg-[--bg-glass] border border-[--border-subtle] p-5">
        <span className="text-[0.7rem] font-semibold uppercase tracking-widest text-[--accent-green] font-[family-name:var(--font-display)]">
          Key Insight
        </span>
        <p className="text-[--text-heading] mt-2 leading-relaxed font-[family-name:var(--font-body)]">
          You don&apos;t need clever things to say — you need to show genuine interest in what others
          are saying.
        </p>
      </div>

      {/* Key Points */}
      <div>
        <span className="text-[0.7rem] font-semibold uppercase tracking-widest text-[--text-muted] font-[family-name:var(--font-display)]">
          Key Points
        </span>
        <ul className="mt-3 space-y-3">
          {keyPoints.map((point, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[--accent-teal]" />
              <span className="text-[--text-secondary] leading-relaxed font-[family-name:var(--font-body)]">
                {point}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scenarios Tab                                                      */
/* ------------------------------------------------------------------ */

interface ScenarioCardProps {
  tag: string;
  tagColor: string;
  situation: string;
  whatToDo: string;
  whyMatters: string;
}

function ScenarioCard({ tag, tagColor, situation, whatToDo, whyMatters }: ScenarioCardProps) {
  return (
    <div className="flex-1 rounded-xl bg-[--bg-glass] border border-[--border-subtle] p-5 space-y-4">
      {/* Tag pill */}
      <span
        className="inline-block text-[0.65rem] font-bold uppercase tracking-widest px-3 py-1 rounded-full"
        style={{ color: tagColor, backgroundColor: `${tagColor}18` }}
      >
        {tag}
      </span>

      <div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-1 font-[family-name:var(--font-display)]">
          The Situation
        </p>
        <p className="text-[--text-heading] leading-relaxed font-[family-name:var(--font-body)]">
          {situation}
        </p>
      </div>

      <div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-1 font-[family-name:var(--font-display)]">
          What To Do
        </p>
        <p className="text-[--text-secondary] leading-relaxed font-[family-name:var(--font-body)]">
          {whatToDo}
        </p>
      </div>

      <div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-widest text-[--text-muted] mb-1 font-[family-name:var(--font-display)]">
          Why This Matters
        </p>
        <p className="text-[--text-secondary] leading-relaxed italic font-[family-name:var(--font-body)]">
          {whyMatters}
        </p>
      </div>
    </div>
  );
}

function ScenariosContent() {
  return (
    <div className="flex flex-col md:flex-row gap-5">
      <ScenarioCard
        tag="WORK"
        tagColor="var(--accent-orange)"
        situation="Your colleague is explaining a project they're passionate about, but you're tempted to check your phone."
        whatToDo="Put your phone away, maintain eye contact, and ask follow-up questions about their approach."
        whyMatters="People who feel heard become your strongest allies at work."
      />
      <ScenarioCard
        tag="PERSONAL"
        tagColor="var(--accent-teal)"
        situation="A friend is telling you about their weekend, but your mind keeps drifting to your own plans."
        whatToDo="Refocus by mentally summarizing what they're saying. Ask 'What was the best part?'"
        whyMatters="Deep listening strengthens friendships more than any amount of advice."
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Quiz Tab                                                           */
/* ------------------------------------------------------------------ */

interface QuizOption {
  label: string;
  text: string;
  correct?: boolean;
}

interface QuizQuestionProps {
  number: number;
  question: string;
  options: QuizOption[];
}

function QuizQuestion({ number, question, options }: QuizQuestionProps) {
  return (
    <div className="space-y-3">
      <p className="text-[--text-heading] font-medium font-[family-name:var(--font-body)]">
        <span className="text-[--accent-teal] font-[family-name:var(--font-display)] mr-2">
          Q{number}.
        </span>
        {question}
      </p>
      <div className="grid gap-2">
        {options.map((opt) => (
          <div
            key={opt.label}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 border transition-colors ${
              opt.correct
                ? "border-[--accent-teal] bg-[--accent-teal]/5"
                : "border-[--border-subtle] bg-[--bg-glass]"
            }`}
          >
            <span
              className={`text-sm font-semibold shrink-0 ${
                opt.correct ? "text-[--accent-teal]" : "text-[--text-muted]"
              } font-[family-name:var(--font-display)]`}
            >
              {opt.label})
            </span>
            <span
              className={`text-sm leading-relaxed ${
                opt.correct ? "text-[--text-heading]" : "text-[--text-secondary]"
              } font-[family-name:var(--font-body)]`}
            >
              {opt.text}
            </span>
            {opt.correct && (
              <svg
                className="ml-auto shrink-0 h-5 w-5 text-[--accent-green]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuizContent() {
  return (
    <div className="space-y-8">
      <QuizQuestion
        number={1}
        question="Your coworker starts explaining a problem they're facing. What's the most effective response?"
        options={[
          { label: "A", text: "\"Here's what I'd do...\"" },
          { label: "B", text: "\"That reminds me of my situation...\"" },
          { label: "C", text: "\"Tell me more about what happened\"", correct: true },
          { label: "D", text: "\"Have you tried asking your manager?\"" },
        ]}
      />
      <QuizQuestion
        number={2}
        question="Why does Carnegie say listening is more powerful than talking?"
        options={[
          { label: "A", text: "It gives you more information" },
          {
            label: "B",
            text: "People crave to be understood, and a listener fulfills that need",
            correct: true,
          },
          { label: "C", text: "It's less effort" },
          { label: "D", text: "It makes you seem smarter" },
        ]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Unlock Tab                                                         */
/* ------------------------------------------------------------------ */

function UnlockContent() {
  const chaptersCompleted = 4;
  const totalChapters = 12;
  const progressPercent = Math.round((chaptersCompleted / totalChapters) * 100);

  // SVG ring geometry
  const radius = 54;
  const strokeWidth = 7;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (chaptersCompleted / totalChapters) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center text-center py-4">
      {/* Confetti dots */}
      {confettiDots.map((dot, i) => (
        <span
          key={i}
          className="absolute rounded-full opacity-50"
          style={{
            left: dot.x,
            top: dot.y,
            width: dot.size,
            height: dot.size,
            backgroundColor: dot.color,
          }}
        />
      ))}

      {/* Celebration heading */}
      <h3 className="text-3xl md:text-4xl font-bold text-[--accent-teal] mb-6 font-[family-name:var(--font-display)]">
        Chapter Complete!
      </h3>

      {/* Circular progress ring */}
      <div className="relative mb-6">
        <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90">
          {/* Background ring */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="var(--bg-elevated)"
            strokeWidth={strokeWidth}
          />
          {/* Progress ring */}
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="var(--accent-teal)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-700"
          />
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-[--text-heading] font-[family-name:var(--font-display)]">
            {chaptersCompleted}/{totalChapters}
          </span>
        </div>
      </div>

      <p className="text-[--text-secondary] mb-6 font-[family-name:var(--font-body)]">
        {chaptersCompleted} of {totalChapters} chapters completed
      </p>

      {/* Progress bar */}
      <div className="w-full max-w-xs mx-auto mb-2">
        <div className="h-2 w-full rounded-full bg-[--bg-elevated] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[--accent-teal] to-[--accent-green] transition-all duration-700"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
      <p className="text-xs text-[--text-muted] mb-6 font-[family-name:var(--font-body)]">
        {progressPercent}% complete
      </p>

      {/* Next chapter preview */}
      <div className="rounded-xl bg-[--bg-glass] border border-[--border-subtle] px-5 py-3 inline-flex items-center gap-3">
        <span className="text-[--text-muted] text-sm font-[family-name:var(--font-body)]">
          Next up:
        </span>
        <span className="text-[--text-heading] text-sm font-medium font-[family-name:var(--font-body)]">
          Chapter 5 — Make People Feel Important
        </span>
        <svg
          className="h-4 w-4 text-[--accent-teal] shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Main InteractiveDemo Section                                       */
/* ================================================================== */

export function InteractiveDemo() {
  const [activeTab, setActiveTab] = useState<TabIndex>(0);
  const hasInteracted = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ---- Auto-advance logic ---- */
  const clearAutoAdvance = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (hasInteracted.current) return;

    intervalRef.current = setInterval(() => {
      setActiveTab((prev) => ((prev + 1) % 4) as TabIndex);
    }, AUTO_ADVANCE_MS);

    return () => clearAutoAdvance();
  }, [clearAutoAdvance]);

  const handleTabClick = (index: TabIndex) => {
    hasInteracted.current = true;
    clearAutoAdvance();
    setActiveTab(index);
  };

  /* ---- Render active tab content ---- */
  const renderContent = () => {
    switch (activeTab) {
      case 0:
        return <SummaryContent />;
      case 1:
        return <ScenariosContent />;
      case 2:
        return <QuizContent />;
      case 3:
        return <UnlockContent />;
    }
  };

  return (
    <section id="demo" className="py-14 lg:py-20">
      <div className="max-w-5xl mx-auto px-4">
        {/* ---- Header ---- */}
        <SectionReveal>
          <div className="text-center mb-12 md:mb-16">
            <SectionLabel>SEE IT IN ACTION</SectionLabel>

            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[--text-heading] mt-4 font-[family-name:var(--font-display)]">
              This is what reading looks like on ChapterFlow.
            </h2>

            <p className="text-[--text-secondary] mt-4 text-lg font-[family-name:var(--font-body)]">
              Summary. Scenario. Quiz. Unlock. Every chapter, every book.
            </p>
          </div>
        </SectionReveal>

        {/* ---- Browser / App Frame ---- */}
        <SectionReveal delay={0.15}>
          <div className="bg-[--bg-raised] border border-[--border-subtle] rounded-2xl overflow-hidden">
            {/* Browser chrome */}
            <div className="h-10 bg-[--bg-elevated] flex items-center px-4 gap-2">
              {/* Traffic-light dots */}
              <span className="w-3 h-3 rounded-full bg-[#ef4444]" />
              <span className="w-3 h-3 rounded-full bg-[#eab308]" />
              <span className="w-3 h-3 rounded-full bg-[#22c55e]" />

              {/* URL bar */}
              <div className="ml-4 flex-1 max-w-xs">
                <div className="bg-[--bg-base] rounded-md px-3 py-1 text-xs text-[--text-muted] font-[family-name:var(--font-body)] select-none">
                  chapterflow.app
                </div>
              </div>
            </div>

            {/* Tab bar */}
            <div className="relative flex border-b border-[--border-subtle]" role="tablist">
              {TABS.map((tab, i) => (
                <button
                  key={tab}
                  role="tab"
                  aria-selected={activeTab === i}
                  tabIndex={activeTab === i ? 0 : -1}
                  onClick={() => handleTabClick(i as TabIndex)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") handleTabClick(((i + 1) % TABS.length) as TabIndex);
                    if (e.key === "ArrowLeft") handleTabClick(((i - 1 + TABS.length) % TABS.length) as TabIndex);
                  }}
                  className={`relative px-6 py-3 text-sm font-medium transition-colors font-[family-name:var(--font-display)] ${
                    activeTab === i ? "text-[--accent-teal]" : "text-[--text-secondary] hover:text-[--text-heading]"
                  }`}
                >
                  {tab}

                  {/* Animated underline indicator */}
                  {activeTab === i && (
                    <motion.div
                      layoutId="demo-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-[--accent-teal]"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Content area */}
            <div className="min-h-[400px] p-6 md:p-8">
              <TabContent tabKey={activeTab}>{renderContent()}</TabContent>
            </div>
          </div>
        </SectionReveal>

        {/* ---- CTA below demo ---- */}
        <SectionReveal delay={0.3}>
          <div className="text-center mt-10">
            <a
              href="/auth/login?returnTo=%2Fbook"
              className="text-[--accent-teal] hover:underline underline-offset-4 text-sm font-medium transition-colors font-[family-name:var(--font-body)]"
            >
              Like what you see? Start your first book free &rarr;
            </a>
          </div>
        </SectionReveal>
      </div>
    </section>
  );
}
