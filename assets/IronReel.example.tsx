import React from "react";
import { AbsoluteFill, Easing, Freeze, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import fgMoments from "./fg.json";
import segSpec from "./reel-segments.json";
import wordsRoman from "./reel-words.roman.json";
import linesEn from "./reel-lines.en.json";
import faceJson from "./face.json";
import handJson from "./hands.json";
import { FONT, Word } from "./overlays";
import { Sfx } from "./reel-overlays";
import { BoldCaptions, EnglishLine, LOOKS, Line, MusicBed, ProgressBar } from "./noor-overlays";
import { CheckRows, Chip, CodeScroll, Gauge, Globe, HoloBehind, HoloWindow, Laptop, SendFile, Transcript } from "./iron2";
import { AICore, AMBER, Beam, CYAN, CommandLine, FaceData, FaceLock, HandData, HoloHook, HoloPanel, HoloProgress, HudFrame, HudTint, MONO, PalmBeam, RED, Readout, TakeStack, WaveCut, faceAt, glow, handAt, lastHand } from "./iron";

// IRON MAN MODE: the whole street reel.
// Every time below is a second of the ORIGINAL recording; E() maps it.
const FPS = 30;
const SRC = "talk/ig1080.mp4";
type Seg = { a: number; b: number; frames: number };
const SEGS = segSpec.segments as Seg[];
const SPEECH_FRAMES = SEGS.reduce((n, s) => n + s.frames, 0);
const OUTRO_FRAMES = Math.round(segSpec.outro * FPS);
export const IRON_DURATION = SPEECH_FRAMES + OUTRO_FRAMES;
const words = (wordsRoman as Word[]).filter((w) => w.start < SPEECH_FRAMES / FPS);
const lines = (linesEn as Line[]).filter((l) => l.start < SPEECH_FRAMES / FPS).map((l) => ({ ...l, end: Math.min(l.end, SPEECH_FRAMES / FPS) }));
const face = faceJson as unknown as FaceData;
const hands = handJson as unknown as HandData;
const segStart = (i: number) => SEGS.slice(0, i).reduce((n, s) => n + s.frames, 0);

const OFF = -100000;
const E = (t: number): number => {
  for (let i = 0; i < SEGS.length; i++) {
    const s = SEGS[i];
    if (t >= s.a - 1e-6 && t <= s.b + 1e-6) return segStart(i) + Math.round((t - s.a) * FPS);
  }
  for (let i = 0; i < SEGS.length; i++) if (SEGS[i].a > t) return i > 0 && SEGS[i].a - SEGS[i - 1].b <= 1.2 && t > SEGS[i - 1].b ? segStart(i) : OFF;
  return OFF;
};
const life = (from: number, to: number) => Math.max(8, (to === Infinity ? IRON_DURATION : E(to)) - E(from));
// edit frame -> ORIGINAL frame (for face/hand data)
const origOf = (f: number) => {
  for (let i = 0; i < SEGS.length; i++) if (f < segStart(i) + SEGS[i].frames) return Math.round(SEGS[i].a * FPS) + Math.max(0, f - segStart(i));
  const l = SEGS[SEGS.length - 1];
  return Math.round(l.a * FPS) + l.frames - 1;
};
const At: React.FC<{ from: number; to: number; children: React.ReactNode; name?: string }> = ({ from, to, children, name }) => (
  <Sequence from={E(from)} durationInFrames={life(from, to)} name={name} layout="none">
    {children}
  </Sequence>
);
const Hit: React.FC<{ t: number; src: string; vol?: number }> = ({ t, src, vol = 0.25 }) => <Sfx at={E(t)} src={src} vol={vol} />;

// zoom: a gentle snap at every cut (street footage: 1.06), push-in on the hook
const SNAPS: [number, number][] = (() => {
  const out: [number, number][] = [];
  let z = 1;
  let last = -999;
  SEGS.forEach((_, i) => {
    const fr = segStart(i);
    if (fr - last >= 0.7 * FPS) {
      out.push([fr, z]);
      z = z === 1 ? 1.06 : 1;
      last = fr;
    }
  });
  return out;
})();
const useZoom = () => {
  const f = useCurrentFrame();
  let z = 1;
  for (const [fr, zz] of SNAPS) if (f >= fr) z = zz;
  const a = E(2.3);
  const b = E(3.74);
  const push = f >= a && f < b + 8 ? 1 + 0.07 * interpolate(f, [a, a + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }) * interpolate(f, [b, b + 8], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 1;
  return z * push;
};

// ---- layout (measured: face centre ~ (512, 990), top of head ~ 600) ----
const PANEL_Y = 140;
const WAVE_W = 840;
const WAVE_H = 150;
const WAVE_BARS = 64;
// bad parts of the recording, with the word that names them
const MARKS = [
  { a: 8, b: 13, label: "GHALAT", t: 12.38 },
  { a: 22, b: 28, label: "IDHAR UDHAR", t: 13.38 },
  { a: 36, b: 42, label: "GAP", t: 14.28 },
  { a: 50, b: 57, label: "KHAMOSHI", t: 15.46 },
];
const WAVE_FROM = 11.52;
const WAVE_TO = 21.62;
const CUT_T = 21.04;
// where a red part sits on screen (for the laser from the AI core)
const markXY = (m: (typeof MARKS)[number]) => ({ x: (1080 - 900) / 2 + 30 + (((m.a + m.b) / 2) / WAVE_BARS) * WAVE_W, y: PANEL_Y + 70 + 40 + WAVE_H / 2 });

// Everything that has to move WITH the picture (face, hand, panels) lives in the zoom layer.
const IronLayer: React.FC = () => {
  const f = useCurrentFrame();
  const of = origOf(f);
  const hand = handAt(hands, of);
  const fc = faceAt(face, of);

  // AI core: born on the open palm when Claude is named, stays where the hand was
  const coreA = E(19.62);
  const coreB = E(WAVE_TO);
  const coreHand = f >= coreA && f < coreB ? lastHand(hands, of, 120) : null;
  const coreK = interpolate(f, [coreA, coreA + 10, coreB - 6, coreB], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // the core floats beside the head on the hand's side (chosen once, so it never jumps sides)
  const birth = lastHand(hands, origOf(coreA + 2), 120);
  const fb = faceAt(face, origOf(coreA + 2));
  const side = birth && fb ? (birth.x < fb.x ? -1 : 1) : 1;
  const coreX = side < 0 ? 150 : 930;
  const coreY = Math.max(640, coreHand ? coreHand.y - Math.max(170, coreHand.size * 1.6) : 900);

  // pointing at the best take
  const pointA = E(24.6);
  const pointB = E(25.9);
  const pointK = f >= pointA && f < pointB && hand ? hand.vis * interpolate(f, [pointA, pointA + 8], [0, 1], { extrapolateRight: "clamp" }) : 0;

  return (
    <>
      {/* hook: lock onto the face */}
      <Sequence from={0} durationInFrames={E(3.74)} layout="none" name="face lock">
        <FaceLock life={E(3.74)} face={fc} lines={["SUBJECT: NOOR", "EDITOR: AI", "HUMAN EDITS: 0"]} />
      </Sequence>

      {/* "test ... Claude skill ... how much can it edit" */}
      <At from={4.28} to={10.74} name="skill test">
        <HoloPanel life={life(4.28, 10.74)} y={PANEL_Y} h={300} title="CLAUDE SKILL // TEST RUN">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 26 }}>
            <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: 70, color: "#fff", textShadow: `0 0 16px ${CYAN}` }}>noor-reel</span>
            <SkillTag show={E(7.74) - E(4.28)} />
          </div>
          <HoloProgress start={8} end={life(4.28, 10.74) - 6} label={f >= E(9.14) ? "KITNA EDIT? ..." : "EDIT TEST"} />
        </HoloPanel>
      </At>

      {/* "I spoke badly, all over, gaps, went quiet" -> pulled out of the open hand; "Claude cut it all" */}
      <At from={WAVE_FROM} to={WAVE_TO} name="wave">
        <HoloPanel life={life(WAVE_FROM, WAVE_TO) + 10} y={PANEL_Y} h={330} title={f >= E(CUT_T) ? "RECORDING // CLEAN" : "RECORDING // RAW"} from={hand ? { x: hand.x, y: hand.y } : { x: 860, y: 1300 }} accent={f >= E(CUT_T) + 14 ? AMBER : CYAN}>
          <div style={{ marginTop: 40 }}>
            <WaveCut width={WAVE_W} height={WAVE_H} bars={WAVE_BARS} marks={MARKS.map((m) => ({ a: m.a, b: m.b, label: m.label, at: E(m.t) - E(WAVE_FROM) }))} cutAt={E(CUT_T) - E(WAVE_FROM) + 6} playFrom={0} playTo={E(CUT_T) - E(WAVE_FROM)} />
          </div>
          {f >= E(CUT_T) + 16 ? <div style={{ position: "absolute", right: 0, top: -6, fontFamily: MONO, fontSize: 34, letterSpacing: 4, color: AMBER, textShadow: `0 0 12px ${AMBER}` }}>CUT ✓</div> : null}
        </HoloPanel>
      </At>

      {/* the AI core on the palm, then the laser cuts */}
      {coreK > 0 ? (
        <>
          {coreHand && hand ? <PalmBeam topX={coreX} x={coreHand.x} y={coreHand.y - coreHand.size * 0.4} topY={coreY + 40} width={170} vis={coreK * hand.vis} /> : null}
          <div style={{ position: "absolute", left: coreX - 110, top: coreY - 110, opacity: coreK, transform: `scale(${0.4 + 0.6 * coreK})` }}>
            <AICore size={110} pulse={f >= E(CUT_T) && f < E(CUT_T) + 14 ? 1 : 0} />
          </div>
          {f >= E(20.6) ? (
            <div style={{ position: "absolute", left: coreX - 150, width: 300, top: coreY + 120, textAlign: "center", fontFamily: MONO, fontSize: 30, letterSpacing: 6, color: CYAN, opacity: coreK, textShadow: `0 0 10px ${CYAN}, 0 2px 4px #000` }}>CLAUDE</div>
          ) : null}
          {MARKS.map((m, i) => {
            const a = E(CUT_T) + i * 2;
            const k = interpolate(f, [a, a + 4, a + 10, a + 14], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
            const p = markXY(m);
            return <Beam key={i} x1={coreX} y1={coreY} x2={p.x} y2={p.y} k={k} color={RED} width={4} />;
          })}
        </>
      ) : null}

      {/* "a very long video, Claude kept my best" */}
      <At from={22.48} to={28.72} name="takes">
        <TakeStack n={6} best={3} life={life(22.48, 28.72)} y={PANEL_Y - 10} scanAt={E(23.1) - E(22.48)} pickAt={E(25.78) - E(22.48)} />
      </At>
      {pointK > 0 && hand ? <Beam x1={hand.tx} y1={hand.ty} x2={586} y2={PANEL_Y + 140} k={pointK} color={AMBER} width={4} /> : null}

      {/* "I did nothing" */}
      <At from={29.52} to={31.2} name="human 0">
        <Readout life={life(29.52, 31.2)} y={PANEL_Y + 20} label="HUMAN EDITS" value="0" />
      </At>

      {/* "I only said: edit this video" */}
      <At from={31.26} to={33.42} name="command">
        <CommandLine
          life={life(31.26, 33.42)}
          y={PANEL_Y}
          words={(
            [
              ["is", 31.96],
              ["video", 32.38],
              ["ko", 32.68],
              ["edit", 32.8],
              ["karo", 33.16],
            ] as [string, number][]
          ).map(([w, t]) => [w, E(t) - E(31.26)] as [string, number])}
          runAt={E(33.3) - E(31.26)}
          run="EDITING"
        />
      </At>
      <RestBeats hand={hand} />
    </>
  );
};

// ---- the rest of the reel (33.4 s onwards, ORIGINAL seconds) ----
const handAtT = (t: number) => handAt(hands, Math.round(t * FPS));
const pt = (t: number, fb: { x: number; y: number }) => {
  const h = lastHand(hands, Math.round(t * FPS), 30);
  return h ? { x: h.x, y: h.y } : fb;
};
const rel = (t: number, from: number) => E(t) - E(from);
const ww = (from: number, list: [string, number][]) => list.map(([w, t]) => [w, rel(t, from)] as [string, number]);

// the code on screen is the real code that makes this part of the video
const CODE = [
  `<At from={92.75} to={96.3} name="needed">`,
  `  <HoloPanel title="NEEDED?" y={PANEL_Y}>`,
  `    <CheckRows rows={[`,
  `      { text: "GRAPHICS WORK", ok: false },`,
  `      { text: "CUTTING", ok: false },`,
  `      { text: "CODE", ok: true },`,
  `    ]} />`,
  `  </HoloPanel>`,
  `</At>`,
  `const hand = handAt(hands, origFrame);`,
  `<Chip text="CLAUDE" from={pinch} />`,
  `<Globe size={170} ping={found} />`,
  `<Gauge value={70} label="UAE USE AI" />`,
];

const EmojiTiles: React.FC<{ items: [string, number][] }> = ({ items }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", gap: 30, justifyContent: "center", marginTop: 6 }}>
      {items.map(([e, at], i) => {
        const s = spring({ frame: f - at, fps, config: { damping: 11, stiffness: 160 } });
        return (
          <div key={i} style={{ width: 170, height: 150, border: `2px solid ${CYAN}`, background: "rgba(98,230,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 96, transform: `scale(${s}) rotateY(${(1 - s) * 90}deg)`, boxShadow: `0 0 16px rgba(98,230,255,0.35)` }}>
            {e}
          </div>
        );
      })}
    </div>
  );
};

// HUD brackets around the caption band: "this text, AI is writing it"
const CaptionBrackets: React.FC<{ life: number }> = ({ life }) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [0, 8, life - 6, life], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const y0 = 1300;
  const y1 = 1560;
  const L = 70;
  const c = (x: number, y: number, sx: number, sy: number) => `M ${x} ${y + sy * L} L ${x} ${y} L ${x + sx * L} ${y}`;
  const pad = 30 * (1 - k);
  return (
    <div style={{ position: "absolute", inset: 0, opacity: k }}>
      <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, filter: glow(CYAN, 6) }}>
        {[c(60 - pad, y0 - pad, 1, 1), c(1020 + pad, y0 - pad, -1, 1), c(60 - pad, y1 + pad, 1, -1), c(1020 + pad, y1 + pad, -1, -1)].map((d, i) => (
          <path key={i} d={d} stroke={CYAN} strokeWidth={4} fill="none" />
        ))}
      </svg>
      <div style={{ position: "absolute", left: 80, top: y0 - 46, fontFamily: MONO, fontSize: 26, letterSpacing: 4, color: CYAN, textShadow: `0 0 8px ${CYAN}, 0 2px 4px #000` }}>
        AI WRITING<span style={{ opacity: Math.floor(f / 8) % 2 ? 1 : 0 }}>▌</span>
      </div>
    </div>
  );
};

const RestBeats: React.FC<{ hand: ReturnType<typeof handAt> }> = () => {
  const f = useCurrentFrame();
  const pinch1 = pt(82.4, { x: 760, y: 1200 });
  const pinch2 = pt(90.5, { x: 760, y: 1200 });
  return (
    <>
      {/* "all the emojis you see" -> out of the open hand */}
      <At from={34.22} to={36.36} name="emojis">
        <HoloPanel life={life(34.22, 36.36)} y={PANEL_Y} h={290} title="EMOJIS // AUTO" from={pt(34.6, { x: 800, y: 1200 })}>
          <EmojiTiles items={[["🤔", 10], ["🏆", 16], ["😎", 22]]} />
        </HoloPanel>
      </At>

      {/* "below, Urdu, English, Roman Urdu text: AI writes it" */}
      <At from={36.4} to={42.45} name="captions">
        <HoloPanel life={life(36.4, 42.45)} y={PANEL_Y} h={300} title="CAPTIONS // AI">
          <CheckRows rows={[{ text: "URDU", at: rel(36.98, 36.4), ok: true }, { text: "ENGLISH", at: rel(38.86, 36.4), ok: true }, { text: "ROMAN URDU", at: rel(39.46, 36.4), ok: true }]} />
        </HoloPanel>
      </At>
      <At from={40.44} to={42.45} name="caption brackets">
        <CaptionBrackets life={life(40.44, 42.45)} />
      </At>

      {/* "the words coming out of my mouth are written here" -> live speech to text */}
      <At from={43.0} to={48.02} name="speech to text">
        <HoloPanel life={life(43.0, 48.02)} y={PANEL_Y} h={360} title="SPEECH → TEXT // LIVE">
          <Transcript
            size={38}
            highlight={["english", "urdu"]}
            words={ww(43.0, [["jo", 43.18], ["words", 43.44], ["mere", 43.74], ["munh", 43.84], ["se", 43.96], ["nikal", 44.24], ["rahe,", 44.38], ["woh", 44.5], ["yahan", 44.72], ["neeche", 44.94], ["likh", 45.22], ["raha", 45.32], ["hai,", 45.44], ["English", 46.04], ["mein", 46.12], ["bhi", 46.28], ["aur", 46.48], ["Urdu", 46.74], ["mein", 46.82], ["bhi.", 46.96]])}
          />
          {f >= E(47.54) ? <div style={{ position: "absolute", right: 0, bottom: 0, fontFamily: MONO, fontSize: 34, letterSpacing: 4, color: AMBER, textShadow: `0 0 12px ${AMBER}` }}>100% AI ✓</div> : null}
        </HoloPanel>
      </At>

      {/* the news, then the real number */}
      <At from={50.26} to={53.3} name="news">
        <HoloPanel life={life(50.26, 53.3)} y={PANEL_Y} h={330} title="NEWS // GULF NEWS · 18 SEP 2026">
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 50, lineHeight: 1.2, color: "#fff", textShadow: `0 0 12px ${CYAN}` }}>
            <span style={{ color: AMBER }}>70% of UAE workers use AI</span>, Microsoft says businesses now face the harder test
          </div>
        </HoloPanel>
      </At>
      <At from={53.36} to={55.36} name="70 gauge">
        <Gauge life={life(53.36, 55.36)} x={540} y={380} r={190} value={70} label="UAE WORKERS" sub="use AI · Gulf News" />
      </At>

      {/* "AI goes and searches the news itself, pulls the article, puts it here" */}
      <At from={57.24} to={59.95} name="globe">
        <GlobeSearch life={life(57.24, 59.95)} found={rel(59.24, 57.24)} />
      </At>
      <At from={59.7} to={62.05} name="article">
        <Chip at={0} from={{ x: 600, y: 330 }} to={{ x: 540, y: 330 }} text="ARTICLE ✓" color={AMBER} w={460} />
        <Sequence from={rel(60.9, 59.7)} layout="none">
          <ArticleSlot />
        </Sequence>
      </At>

      {/* "graphics in front, graphics behind" (behind = in the cut-out layer, see IronReel) */}
      <At from={63.72} to={66.6} name="front">
        <Chip at={0} from={{ x: 540, y: 1000 }} to={{ x: 840, y: 1220 }} text="AAGE" color={CYAN} w={300} />
      </At>
      <At from={67.94} to={69.45} name="AI edited">
        <Readout life={life(67.94, 69.45)} y={PANEL_Y + 20} label="EDITED BY" value="AI" />
      </At>

      {/* "Claude made it with Remotion": both pulled out of the pinch */}
      <At from={82.3} to={85.39} name="claude + remotion">
        <Chip at={rel(82.4, 82.3)} from={pinch1} to={{ x: 300, y: 330 }} text="Claude" color="#D97757" />
        <Chip at={rel(82.86, 82.3)} from={pinch1} to={{ x: 780, y: 330 }} text="Remotion" color="#0B84F3" />
        {f >= E(83.2) ? <Beam x1={480} y1={330} x2={600} y2={330} k={interpolate(f, [E(83.2), E(83.2) + 8], [0, 1], { extrapolateRight: "clamp" })} /> : null}
      </At>

      {/* "Remotion, a website... Claude will show it here" -> pinched shut at the end */}
      <At from={86.2} to={91.0} name="remotion site">
        <HoloWindow life={life(86.2, 91.0)} y={PANEL_Y - 10} src={staticFile("cut/remotion.png")} label="remotion.dev" h={540} focus="50% 14%" closeTo={pinch2} closeAt={rel(90.3, 86.2)} />
      </At>

      {/* "no graphics work, no cutting needed: it edits video like code" */}
      <At from={92.75} to={96.3} name="needed">
        <HoloPanel life={life(92.75, 96.3)} y={PANEL_Y} h={330} title="NEEDED?" from={pt(92.8, { x: 800, y: 1200 })}>
          <CheckRows rows={[{ text: "GRAPHICS WORK", at: rel(94.0, 92.75), ok: false }, { text: "CUTTING", at: rel(95.14, 92.75), ok: false }]} size={44} />
        </HoloPanel>
      </At>
      <At from={96.3} to={98.86} name="code">
        <HoloPanel life={life(96.3, 98.86)} y={PANEL_Y} h={420} title="CODE // IronReel.tsx ✓">
          <CodeScroll code={CODE} h={320} size={25} speed={1.6} />
        </HoloPanel>
      </At>

      {/* "send it to your editor friend, I'll attach my skill" */}
      <At from={100.9} to={108.5} name="send">
        <SendFile life={life(100.9, 108.5)} y={PANEL_Y} file="this video" to="EDITOR DOST" sendAt={rel(104.7, 100.9)} attachAt={rel(106.62, 100.9)} extra="noor-reel skill" />
      </At>

      {/* "they install it on their laptop, Claude edits like this" */}
      <At from={108.9} to={Infinity} name="laptop">
        <Laptop life={life(108.9, Infinity)} y={PANEL_Y - 10}>
          <div style={{ fontFamily: MONO, fontSize: 28, color: "#fff", textShadow: `0 0 8px ${CYAN}` }}>
            <span style={{ color: CYAN }}>&gt;</span> install noor-reel
          </div>
          <div style={{ marginTop: 30 }}>
            <HoloProgress start={rel(109.56, 108.9)} end={rel(111.4, 108.9)} label="INSTALL" />
          </div>
          {f >= E(112.62) ? <div style={{ marginTop: 30, fontFamily: MONO, fontSize: 30, color: AMBER, textShadow: `0 0 10px ${AMBER}` }}>READY ✓ edit this video</div> : null}
        </Laptop>
      </At>
    </>
  );
};

const GlobeSearch: React.FC<{ life: number; found: number }> = ({ life, found }) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [0, 8, life - 6, life], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: PANEL_Y - 20, height: 460, opacity: k, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ transform: `scale(${0.6 + 0.4 * k})` }}>
        <Globe size={170} ping={found} />
      </div>
      <div style={{ marginTop: -6, fontFamily: MONO, fontSize: 28, letterSpacing: 4, color: f >= found ? AMBER : CYAN, textShadow: `0 0 10px ${f >= found ? AMBER : CYAN}, 0 2px 4px #000` }}>
        {f >= found ? "FOUND: gulfnews.com" : `SEARCHING THE WEB${".".repeat(1 + (Math.floor(f / 6) % 3))}`}
      </div>
    </div>
  );
};

const ArticleSlot: React.FC = () => {
  const f = useCurrentFrame();
  const k = interpolate(f, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  return <div style={{ position: "absolute", left: 300, right: 300, top: 400, height: 4, background: AMBER, opacity: k, boxShadow: `0 0 14px ${AMBER}` }} />;
};
void handAtT;

const IronEndCard: React.FC = () => {
  const f = useCurrentFrame();
  const dim = interpolate(f, [0, 10], [0, 0.55], { extrapolateRight: "clamp" });
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: `rgba(0,8,14,${dim})` }} />
      <HoloPanel life={OUTRO_FRAMES + 20} y={560} h={360} title="NOOR AI CONCIERGE // END">
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 64, color: "#fff", textShadow: `0 0 16px ${CYAN}` }}>Your Name</div>
          <div style={{ fontFamily: MONO, fontSize: 30, color: CYAN, marginTop: 18, letterSpacing: 2 }}>AI for real UAE businesses</div>
          <div style={{ fontFamily: FONT, fontWeight: 700, fontSize: 38, color: AMBER, marginTop: 24, textShadow: `0 0 10px ${AMBER}` }}>Yeh video apne editor dost ko bhejo</div>
        </div>
      </HoloPanel>
    </>
  );
};

// the speaker cut-out (matte.py, fg.json) so "PEECHE" sits BEHIND him
const BEHIND_FROM = 64.9;
const BEHIND_TO = 66.6;
type FgMoment = { f0: number; f1: number; src: string };
const FgPiece: React.FC<{ seg: Seg; index: number }> = ({ seg, index }) => {
  const f = useCurrentFrame();
  const abs = segStart(index) + f;
  if (abs < E(BEHIND_FROM) - 1 || abs >= E(BEHIND_TO) + 1) return null;
  const p0 = Math.round(seg.a * FPS);
  const m = (fgMoments as FgMoment[]).find((x) => p0 + f >= x.f0 && p0 + f < x.f1);
  if (!m) return null;
  return (
    <AbsoluteFill>
      <Freeze frame={p0 + f - m.f0}>
        <OffthreadVideo src={staticFile(m.src)} transparent muted style={{ width: "100%", height: "100%" }} />
      </Freeze>
    </AbsoluteFill>
  );
};

const SkillTag: React.FC<{ show: number }> = ({ show }) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [show, show + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <span style={{ fontFamily: MONO, fontSize: 30, letterSpacing: 3, padding: "6px 16px", border: `2px solid ${AMBER}`, color: AMBER, opacity: k, transform: `scale(${0.8 + 0.2 * k})`, display: "inline-block", filter: glow(AMBER, 6) }}>CLAUDE SKILL</span>
  );
};

export const IronReel: React.FC = () => {
  const zoom = useZoom();
  const last = SEGS[SEGS.length - 1];
  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: FONT }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: "50% 52%" }}>
        <AbsoluteFill style={{ filter: `${LOOKS.natural} contrast(1.05)` }}>
          {SEGS.map((s, i) => {
            const from = Math.round(s.a * FPS);
            return (
              <Sequence key={i} from={segStart(i)} durationInFrames={s.frames} layout="none" name={`piece ${i + 1}`}>
                <OffthreadVideo
                  src={staticFile(SRC)}
                  startFrom={from}
                  endAt={from + s.frames}
                  volume={(f) => interpolate(f, [0, 1, s.frames - 2, s.frames - 1], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
                  style={{ width: "100%", height: "100%" }}
                />
              </Sequence>
            );
          })}
          <Sequence from={SPEECH_FRAMES} durationInFrames={OUTRO_FRAMES} layout="none" name="outro freeze">
            <Freeze frame={last.frames - 1}>
              <OffthreadVideo src={staticFile(SRC)} startFrom={Math.round(last.a * FPS)} muted style={{ width: "100%", height: "100%" }} />
            </Freeze>
          </Sequence>
          {/* "graphics behind": the word sits between the background and Noor */}
          <At from={BEHIND_FROM} to={BEHIND_TO} name="behind">
            <HoloBehind life={life(BEHIND_FROM, BEHIND_TO)} text="PEECHE" y={330} size={250} />
          </At>
          {SEGS.map((s, i) => (
            <Sequence key={`fg-${i}`} from={segStart(i)} durationInFrames={s.frames} layout="none" name={`cut-out ${i + 1}`}>
              <FgPiece seg={s} index={i} />
            </Sequence>
          ))}
        </AbsoluteFill>
        <IronLayer />
      </AbsoluteFill>
      <HudTint />

      {/* dark band behind captions (street footage) */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 300, height: 600, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.4) 80%, rgba(0,0,0,0))" }} />
      <Sequence from={SPEECH_FRAMES} durationInFrames={OUTRO_FRAMES} layout="none" name="end card">
        <IronEndCard />
      </Sequence>
      <HudFrame off={IRON_DURATION - 12} />
      <Sequence from={0} durationInFrames={E(3.74)} layout="none" name="hook">
        <HoloHook life={E(3.74)} text="Insaan ne edit nahi kiya" highlight="nahi" tag="// TEST 01 · AI EDIT" y={110} size={88} />
      </Sequence>
      <BoldCaptions words={words} bottom={490} latinGroup={3} upper={false} />
      <EnglishLine lines={lines} bottom={405} />
      <ProgressBar total={SPEECH_FRAMES} color={CYAN} />
      <MusicBed words={words} total={IRON_DURATION} src="music/iron-bed.wav" under={-26} />

      {/* sound design: quiet, every sound belongs to something you see */}
      <Sfx at={0} src="hud_on.wav" vol={0.22} />
      <Sfx at={6} src="lock.wav" vol={0.2} />
      <Hit t={4.28} src="holo.wav" vol={0.22} />
      <Hit t={7.74} src="data.wav" vol={0.1} />
      <Hit t={11.52} src="holo.wav" vol={0.25} />
      {MARKS.map((m) => (
        <Hit key={m.label} t={m.t} src="data.wav" vol={0.1} />
      ))}
      <Hit t={19.62} src="hit.wav" vol={0.24} />
      <Hit t={21.04} src="slice.wav" vol={0.3} />
      <Hit t={22.48} src="holo.wav" vol={0.22} />
      <Hit t={23.1} src="scan.wav" vol={0.2} />
      <Hit t={25.78} src="hit.wav" vol={0.26} />
      <Hit t={29.52} src="data.wav" vol={0.1} />
      <Hit t={31.26} src="holo.wav" vol={0.2} />
      <Hit t={31.96} src="typing.wav" vol={0.25} />
      <Hit t={34.22} src="holo.wav" vol={0.2} />
      <Hit t={36.4} src="holo.wav" vol={0.18} />
      <Hit t={36.98} src="data.wav" vol={0.1} />
      <Hit t={38.86} src="data.wav" vol={0.1} />
      <Hit t={39.46} src="data.wav" vol={0.1} />
      <Hit t={40.44} src="lock.wav" vol={0.16} />
      <Hit t={43.0} src="holo.wav" vol={0.18} />
      <Hit t={47.54} src="data.wav" vol={0.1} />
      <Hit t={50.26} src="holo.wav" vol={0.2} />
      <Hit t={53.36} src="hit.wav" vol={0.28} />
      <Hit t={57.24} src="scan.wav" vol={0.22} />
      <Hit t={59.24} src="lock.wav" vol={0.2} />
      <Hit t={59.7} src="holo.wav" vol={0.18} />
      <Hit t={63.72} src="holo.wav" vol={0.16} />
      <Hit t={64.9} src="holo.wav" vol={0.16} />
      <Hit t={67.94} src="data.wav" vol={0.1} />
      <Hit t={82.4} src="holo.wav" vol={0.2} />
            <Hit t={86.2} src="scan.wav" vol={0.18} />
      <Hit t={90.3} src="lock.wav" vol={0.16} />
      <Hit t={92.75} src="holo.wav" vol={0.18} />
      <Hit t={94.0} src="data.wav" vol={0.1} />
      <Hit t={95.14} src="data.wav" vol={0.1} />
      <Hit t={96.3} src="holo.wav" vol={0.16} />
      <Hit t={100.9} src="holo.wav" vol={0.18} />
      <Hit t={104.7} src="scan.wav" vol={0.2} />
      <Hit t={106.62} src="lock.wav" vol={0.18} />
      <Hit t={108.9} src="hud_on.wav" vol={0.18} />
      <Hit t={112.62} src="hit.wav" vol={0.24} />
      <Sfx at={SPEECH_FRAMES} src="holo.wav" vol={0.2} />
      <Sfx at={IRON_DURATION - 14} src="power_off.wav" vol={0.22} />
    </AbsoluteFill>
  );
};
