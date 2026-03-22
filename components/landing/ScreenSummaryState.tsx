"use client";

import { useState } from "react";

type DepthMode = "simple" | "standard" | "deeper";

const MODES: {
  key: DepthMode;
  label: string;
  activeStyle: React.CSSProperties;
}[] = [
  {
    key: "simple",
    label: "Simple",
    activeStyle: {
      background: "rgba(45,212,191,0.12)",
      border: "1px solid rgba(45,212,191,0.2)",
      color: "var(--accent-teal)",
    },
  },
  {
    key: "standard",
    label: "Standard",
    activeStyle: {
      background: "var(--accent-blue)",
      border: "1px solid var(--accent-blue)",
      color: "white",
    },
  },
  {
    key: "deeper",
    label: "Deeper",
    activeStyle: {
      background: "rgba(232,185,49,0.12)",
      border: "1px solid rgba(232,185,49,0.2)",
      color: "#E8B931",
    },
  },
];

const INACTIVE_STYLE: React.CSSProperties = {
  background: "var(--bg-elevated)",
  border: "1px solid var(--border-subtle)",
  color: "var(--text-muted)",
};

/* ------------------------------------------------------------------ */
/*  Helper components                                                  */
/* ------------------------------------------------------------------ */

function Label({
  children,
  color = "var(--text-muted)",
}: {
  children: string;
  color?: string;
}) {
  return (
    <span
      className="text-[7px] font-semibold uppercase block mt-3 first:mt-0"
      style={{ color, letterSpacing: "0.1em" }}
    >
      {children}
    </span>
  );
}

function Paragraph({ children }: { children: React.ReactNode }) {
  return (
    <p
      className="text-[9px] mt-1"
      style={{ color: "var(--text-primary)", lineHeight: 1.7 }}
    >
      {children}
    </p>
  );
}

function Divider() {
  return (
    <div
      className="my-2"
      style={{ height: 1, background: "var(--border-subtle)" }}
    />
  );
}

function HighlightBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-r-md mt-2"
      style={{
        background: "rgba(5,150,105,0.06)",
        borderLeft: "2px solid #059669",
        padding: "8px 10px",
      }}
    >
      <p
        className="text-[8px] italic"
        style={{ color: "var(--text-primary)", lineHeight: 1.7 }}
      >
        {children}
      </p>
    </div>
  );
}

function BulletPoint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-1.5 items-start">
      <span
        className="shrink-0 rounded-full mt-[5px]"
        style={{ width: 4, height: 4, background: "var(--accent-blue)" }}
      />
      <p
        className="text-[8px]"
        style={{ color: "var(--text-primary)", lineHeight: 1.6 }}
      >
        {children}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Content panels                                                     */
/* ------------------------------------------------------------------ */

function SimpleContent() {
  return (
    <>
      <Label>MAIN IDEA</Label>
      <Paragraph>
        If you want to be a good conversationalist, be a good listener.
        Encourage others to talk about themselves. The person who asks
        questions and genuinely pays attention will be remembered as
        someone worth talking to, even if they barely said a word
        themselves.
      </Paragraph>

      <Divider />

      <Label>KEY POINTS</Label>
      <div className="flex flex-col gap-1.5 mt-1.5">
        <BulletPoint>
          Listening is the fastest way to make someone feel valued.
        </BulletPoint>
        <BulletPoint>
          Ask questions the other person enjoys answering.
        </BulletPoint>
        <BulletPoint>
          People associate good feelings with whoever made them feel
          heard, not with whoever spoke the most.
        </BulletPoint>
      </div>

      <Divider />

      <Label>IN ONE SENTENCE</Label>
      <p
        className="text-[9px] mt-1 italic"
        style={{ color: "var(--text-primary)", lineHeight: 1.7 }}
      >
        People care more about their own interests than yours, so ask
        about theirs and listen like it matters, because to them it does.
      </p>
    </>
  );
}

function StandardContent() {
  return (
    <>
      <Label>MAIN IDEA</Label>
      <Paragraph>
        The most effective way to win someone&apos;s respect in conversation
        is not by talking brilliantly, but by listening intently. People
        are starved for someone who will genuinely hear them out. Exclusive
        attention to the person speaking is one of the highest compliments
        you can pay. When you stop planning what to say next and simply
        focus on understanding, the other person feels it immediately.
      </Paragraph>

      <Divider />

      <Label>KEY INSIGHT</Label>
      <Paragraph>
        Carnegie argues that listening is not passive. The good listener
        actively asks questions, avoids interrupting, and encourages the
        speaker to elaborate. This creates a cycle: the more you listen,
        the more they share. The more they share, the more valued they
        feel. And the more valued they feel, the more they trust you.
        That trust is the foundation of every meaningful relationship,
        whether personal or professional.
      </Paragraph>

      <Divider />

      <Label>KEY POINTS</Label>
      <div className="flex flex-col gap-1.5 mt-1.5">
        <BulletPoint>
          Ask questions the other person enjoys answering, then let them
          talk without rushing to fill silences.
        </BulletPoint>
        <BulletPoint>
          Never interrupt, even when you have something brilliant to add.
          The moment you cut someone off, you tell them your thoughts
          matter more than theirs.
        </BulletPoint>
        <BulletPoint>
          Encourage the speaker to go deeper. Phrases like &quot;Tell me
          more about that&quot; or &quot;What happened next?&quot; signal
          genuine interest.
        </BulletPoint>
        <BulletPoint>
          People will remember how you made them feel long after they
          forget what you said. Listening is how you make them feel
          important.
        </BulletPoint>
      </div>

      <HighlightBox>
        To be interesting, be interested. The person who asks questions
        and listens to the answers will be considered a great
        conversationalist, even if they barely spoke.
      </HighlightBox>
    </>
  );
}

function DeeperContent() {
  return (
    <>
      <Label>MAIN IDEA</Label>
      <Paragraph>
        Carnegie opens with the story of a dinner party where he spoke to
        a botanist for hours. The botanist later told the host that
        Carnegie was &quot;a most interesting conversationalist,&quot; yet
        Carnegie had barely said a word the entire evening. He had simply
        listened with genuine curiosity, asked thoughtful questions, and
        let the botanist talk about what he loved. This story illustrates
        the central paradox of the chapter: the way to be fascinating is
        not to be fascinating but to be fascinated.
      </Paragraph>

      <Divider />

      <Label>KEY INSIGHT</Label>
      <Paragraph>
        Active listening accomplishes three things simultaneously. First,
        you learn information you can use later, giving you an advantage
        in future conversations and decisions. Second, the speaker feels
        respected and important, which builds emotional equity you cannot
        buy with clever words. Third, you build rapport without the risk
        of saying something wrong, making listening the lowest risk,
        highest reward social strategy available.
      </Paragraph>

      <Divider />

      <Label color="#E8B931">PRACTICAL FRAMEWORK</Label>
      <Paragraph>
        Carnegie&apos;s four part listening formula:
      </Paragraph>
      <div className="flex flex-col gap-1.5 mt-1.5">
        <BulletPoint>
          Give undivided attention. Put away your phone, close your
          laptop, turn your body toward the speaker. Physical signals
          of attention are just as important as mental focus.
        </BulletPoint>
        <BulletPoint>
          Ask questions the other person enjoys answering. People light
          up when invited to share their expertise, passions, or stories.
          Find that spark and follow it.
        </BulletPoint>
        <BulletPoint>
          Encourage them to talk about themselves and their accomplishments.
          This is not flattery. It is giving someone permission to share
          what they are proud of, which most social norms discourage.
        </BulletPoint>
        <BulletPoint>
          Be genuinely interested, not performatively interested. People
          sense fakery instantly. If you cannot find something genuinely
          interesting about the person, look harder.
        </BulletPoint>
      </div>

      <HighlightBox>
        In a study of successful salespeople, the top performers spoke
        only 30% of the time in client meetings. The other 70% they spent
        listening and asking targeted follow up questions. The pattern
        holds across industries: the best communicators are not the best
        talkers. They are the best listeners.
      </HighlightBox>

      <Label color="var(--accent-blue)">ANALYSIS</Label>
      <p
        className="text-[8px] mt-1"
        style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}
      >
        This principle connects to Chapter 3 (Remember names) and Chapter
        6 (Make others feel important). Together they form Carnegie&apos;s
        core thesis: genuine interest in others is the master key to
        influence. What makes this chapter particularly powerful is that
        it reframes a passive activity as an active skill. Most people
        think of listening as waiting for their turn to speak. Carnegie
        treats it as a deliberate practice that, when done well, is more
        persuasive than any argument you could construct.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Main export                                                        */
/* ------------------------------------------------------------------ */

export function ScreenSummaryState() {
  const [mode, setMode] = useState<DepthMode>("standard");

  return (
    <div
      className="h-full overflow-y-auto hide-scrollbar"
      style={{ padding: "16px 16px 20px" }}
    >
      {/* Depth selector */}
      <div className="flex justify-center gap-1 mb-3">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className="text-[8px] font-semibold rounded-full cursor-pointer transition-all duration-200"
            style={{
              padding: "4px 12px",
              ...(mode === m.key ? m.activeStyle : INACTIVE_STYLE),
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Content area with crossfade */}
      <div className="relative">
        <div
          style={{
            opacity: mode === "simple" ? 1 : 0,
            transition: "opacity 0.2s",
            position: mode === "simple" ? "relative" : "absolute",
            inset: mode === "simple" ? undefined : 0,
            pointerEvents: mode === "simple" ? "auto" : "none",
          }}
        >
          <SimpleContent />
        </div>

        <div
          style={{
            opacity: mode === "standard" ? 1 : 0,
            transition: "opacity 0.2s",
            position: mode === "standard" ? "relative" : "absolute",
            inset: mode === "standard" ? undefined : 0,
            pointerEvents: mode === "standard" ? "auto" : "none",
          }}
        >
          <StandardContent />
        </div>

        <div
          style={{
            opacity: mode === "deeper" ? 1 : 0,
            transition: "opacity 0.2s",
            position: mode === "deeper" ? "relative" : "absolute",
            inset: mode === "deeper" ? undefined : 0,
            pointerEvents: mode === "deeper" ? "auto" : "none",
          }}
        >
          <DeeperContent />
        </div>
      </div>
    </div>
  );
}
