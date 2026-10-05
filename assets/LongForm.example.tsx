import React from "react";
import { AbsoluteFill, Easing, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import segSpec from "./reel-segments.json";
import wordsJson from "./reel-words.roman.json";
import linesEn from "./reel-lines.en.json";
import { FONT, Word } from "./overlays";
import { Sfx } from "./reel-overlays";
import { EnglishLine, LOOKS, Line, MusicBed, ProgressBar } from "./noor-overlays";
import { setLook } from "./iron";
import { ChapterCard, FlowSteps, SaveCard, TermCard } from "./teach";

// noor-reel LONG FORM template: a 16:9 YouTube video (1920x1080) from a
// landscape recording (phone turned sideways or a laptop camera), same
// pipeline as a reel (prep, transcribe, tighten, cut -> reel-segments.json).
// Register in Root.tsx:
//   <Composition id="LongForm" component={LongForm} durationInFrames={LONG_DURATION} fps={30} width={1920} height={1080} />
// Rules for long videos (Teaching With Graphics research):
// - Build it as CHAPTERS of 1-3 min, each opened by a ChapterCard and a small hook.
// - Noor sits on the LEFT third, teaching pieces use the right half (useBand does this).
// - Fewer zooms than a reel (one gentle push per chapter), no emoji pops, captions
//   as one clean line at the bottom (YouTube viewers watch with sound on more often,
//   but many watch in a second language).
// - End each chapter with a one-line recap; end the video with SaveCard.
setLook("clean");

const FPS = 30;
const SRC = "talk/ig1080.mp4"; // the landscape source after prep.sh
type Seg = { a: number; b: number; frames: number };
const SEGS = segSpec.segments as Seg[];
const SPEECH = SEGS.reduce((n, s) => n + s.frames, 0);
const OUTRO = Math.round((segSpec.outro ?? 4) * FPS);
export const LONG_DURATION = SPEECH + OUTRO;
const words = wordsJson as Word[];
const segStart = (i: number) => SEGS.slice(0, i).reduce((n, s) => n + s.frames, 0);
const E = (t: number) => {
  for (let i = 0; i < SEGS.length; i++) if (t >= SEGS[i].a - 1e-6 && t <= SEGS[i].b + 1e-6) return segStart(i) + Math.round((t - SEGS[i].a) * FPS);
  for (let i = 0; i < SEGS.length; i++) if (SEGS[i].a > t) return segStart(i);
  return SPEECH;
};
const life = (a: number, b: number) => Math.max(8, E(b) - E(a));
const At: React.FC<{ from: number; to: number; children: React.ReactNode; name?: string }> = ({ from, to, children, name }) => (
  <Sequence from={E(from)} durationInFrames={life(from, to)} layout="none" name={name}>
    {children}
  </Sequence>
);

// CHAPTERS: [original second it starts, title]. Copy these times into the YouTube description too.
const CHAPTERS: [number, string][] = [
  // [0, "Intro"], [95.2, "How AI writes"], [210.0, "Try it yourself"],
];

// one slow push-in per chapter (no snaps in long form)
const useZoom = () => {
  const f = useCurrentFrame();
  let z = 1;
  for (const [t] of CHAPTERS) {
    const a = E(t);
    if (f >= a && f < a + 6 * FPS) z = 1 + 0.04 * interpolate(f, [a, a + 6 * FPS], [0, 1], { easing: Easing.inOut(Easing.cubic) });
  }
  return z;
};

export const LongForm: React.FC = () => {
  const zoom = useZoom();
  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: FONT }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "30% 45%", filter: LOOKS.natural }}>
        {SEGS.map((s, i) => (
          <Sequence key={i} from={segStart(i)} durationInFrames={s.frames} layout="none">
            <OffthreadVideo src={staticFile(SRC)} startFrom={Math.round(s.a * FPS)} endAt={Math.round(s.a * FPS) + s.frames} style={{ width: "100%", height: "100%" }} />
          </Sequence>
        ))}
      </AbsoluteFill>

      {CHAPTERS.map(([t, title], i) => (
        <At key={i} from={t} to={t + 4} name={`chapter ${i + 1}`}>
          <ChapterCard life={life(t, t + 4)} n={i + 1} title={title} />
        </At>
      ))}

      {/* TEACHING BEATS go here (ORIGINAL seconds), e.g.
      <At from={12.0} to={16.5} name="term"><TermCard life={life(12.0, 16.5)} term="Prompt" icon="💬" meaning="The message you give the AI" /></At>
      <At from={40.0} to={52.0} name="flow"><FlowSteps life={life(40.0, 52.0)} title="How it works" steps={[{ text: "You ask", icon: "💬", at: 0 }, { text: "AI reads", icon: "🤖", at: E(43.1) - E(40.0) }]} /></At>
      */}

      <EnglishLine lines={linesEn as Line[]} bottom={60} size={44} maxWords={9} />
      <ProgressBar total={SPEECH} />
      <MusicBed words={words} total={LONG_DURATION} under={-30} />
      <Sequence from={SPEECH} durationInFrames={OUTRO} layout="none" name="save card">
        <SaveCard life={OUTRO} title="Remember this" points={["(point 1)", "(point 2)", "(point 3)"]} handle="@yourhandle" />
      </Sequence>
    </AbsoluteFill>
  );
};
void Sfx; void FlowSteps; void TermCard;
