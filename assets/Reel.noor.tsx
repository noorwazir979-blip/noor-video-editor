import React from "react";
import { AbsoluteFill, Easing, Freeze, Img, OffthreadVideo, Sequence, getInputProps, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import segSpec from "./reel-segments.json";
import wordsUrdu from "./reel-words.json";
// CAPTIONS: "urdu" (script), "roman" (Roman Urdu, needs reel-words.roman.json from subs.py) or
// "english" (English source). SECOND_LINE puts a translation under the main captions:
// "english" (reel-lines.en.json), "arabic" (reel-lines.ar.json, for UAE owners) or false.
// For an English recording use CAPTIONS "english" and SECOND_LINE false (or "arabic").
import wordsRoman from "./reel-words.roman.json";
import linesEn from "./reel-lines.en.json";
import linesAr from "./reel-lines.ar.json";
// the speaker cut-outs (matte.py writes fg.json + public/talk/fg_<frame>.webm per moment)
import fgMoments from "./fg.json";
import { Big, FONT, LogoRow, Shadow, Word } from "./overlays";
import { BigEmoji, CARD_X, Sfx, StrikeBig } from "./reel-overlays";
import { BehindText, BoldCaptions, Cutaway, EnglishLine, HeadlineCard, HookTitle, LOOKS, Line, MusicBed, ProgressBar, Vignette } from "./noor-overlays";
const CAPTIONS: "urdu" | "roman" | "english" = "roman";

// ---- VARIANTS (strategy: test, don't guess) ----
// Every render can be switched with --props, so ONE project makes the A/B
// versions for Instagram Trial Reels (scripts/variants.sh renders them all):
//   style: "heavy" = zoom snaps every ~2.4 s, emojis, sound hits (entertainment look)
//          "calm"  = snaps only at cuts, no emojis or hits; captions, cutaways and cards stay
//                    (trust look for 35-55 year old owners)
//   hook:  "A" = HOOK_A, "B" = HOOK_B (a second cover/headline for the same video)
//   line:  "english" | "arabic" | "none" = the second caption line
type Props = { style?: "heavy" | "calm"; hook?: "A" | "B"; line?: "english" | "arabic" | "none" };
const P = getInputProps() as Props;
const STYLE: "heavy" | "calm" = P.style ?? "heavy";
const SECOND_LINE: "english" | "arabic" | false = P.line ? (P.line === "none" ? false : P.line) : "english";
// MUSIC: the ducked bed (public/music/bed-soft.wav from make_sfx2.py, or a licensed track in public/music/).
// false when Noor will add a trending sound inside Instagram (better reach), and for videos aimed at
// conservative viewers (Afghanistan, the Pashto series): many dislike background music.
const MUSIC: string | false = "music/bed-soft.wav";
const MUSIC_UNDER = -28; // dB under speech: a quiet bed, never a song

// noor-reel TEMPLATE. Every time in this file is a second of the ORIGINAL
// recording; E() maps it through the (tightened) takes. Fill in the
// FRAMING constants from the contact sheet, then the HOOK, then the beats.
// Run scripts/check.py on this file before rendering.

// ---- FRAMING (measure on the contact sheet) ----
const ORIGIN = "50% 42%"; // the face: zoom origin
const TOP_Y = 270; // card band: above the head when the speaker sits low; use 990 (under the chin) when the head is high
const RX = 800; // reaction slot (emoji/logo) next to the head
const RY = 690;
const RS = 250;
const LOOK: keyof typeof LOOKS = "natural"; // natural | punchy | warm | none
const VIGNETTE = 0.22; // 0 = off
// SCENE: "studio" (default) or "street": filmed outside or while walking (run scripts/street.py
// first; it says which). street = smaller zoom snaps (a zoom also enlarges any shake that is
// left) and a soft dark band behind the captions so they read over moving cars and lights.
const SCENE: "studio" | "street" = "studio";
const SNAP_Z = SCENE === "street" ? 1.06 : 1.1;

// ---- CUT-OUT EFFECTS (run scripts/matte.py --ranges "A-B,C-D" covering every window below) ----
// BEHIND: huge words behind the head. BACKDROPS: replace the background
// (the speaker stays in front) with an image or video for a moment, e.g. a
// website screenshot or the Abu Dhabi skyline. Times are ORIGINAL seconds,
// each window inside ONE piece of the cut. Empty lists = fg.webm not needed.
const BEHIND: { from: number; to: number; text: string; highlight?: string; y?: number; size?: number }[] = [];
const BACKDROPS: { from: number; to: number; src: string; video?: boolean; focus?: string }[] = [];

// ---- HOOK (first frame = cover) ----
// Three layers say the SAME thing in the first 1-2 s: what they see (first shot), read (this
// headline) and hear (the first spoken line). Name the viewer or the costly moment; max ~5 words.
const HOOK_A = { text: "HOOK HEADLINE", highlight: "HEADLINE", sub: "", until: 2.4 }; // `until` is an ORIGINAL second inside the first take
// a second headline for the Trial Reel test, e.g. { text: "The 11 pm WhatsApp", highlight: "11 pm", sub: "", until: 2.4 }
const HOOK_B: typeof HOOK_A | null = null;
const HOOK = P.hook === "B" && HOOK_B ? HOOK_B : HOOK_A;
// OUTRO: end on the payoff, then stop. Keep segments.outro short (1-1.5 s), or 0 for no end
// card (a hard stop gets more rewatches). cta = ONE action, by goal: a send line (default),
// a follow WITH a reason, or "Comment CHECKUP". Roman Urdu send line:
// "Yeh video us dost ko bhejein jiski apni dukaan hai"
const OUTRO = { title: "Your Name", line: "What you do, in one line", cta: "Send this to a friend who needs it" };

const FPS = 30;
const SRC = "talk/ig1080.mp4";
type Seg = { a: number; b: number; frames: number; note?: string };
const SEGS = segSpec.segments as Seg[];
const SPEECH_FRAMES = SEGS.reduce((n, s) => n + s.frames, 0);
const OUTRO_FRAMES = Math.round(segSpec.outro * FPS);
export const REEL_DURATION = SPEECH_FRAMES + OUTRO_FRAMES;
const words = (CAPTIONS === "roman" ? wordsRoman : wordsUrdu) as Word[];
const segStart = (i: number) => SEGS.slice(0, i).reduce((n, s) => n + s.frames, 0);

// OFF: a beat whose time is not in this cut (a SHORT version drops whole
// takes); it is pushed far before frame 0 so it never shows or plays.
const OFF = -100000;
export const E = (t: number): number => {
  for (let i = 0; i < SEGS.length; i++) {
    const s = SEGS[i];
    if (t >= s.a - 1e-6 && t <= s.b + 1e-6) return segStart(i) + Math.round((t - s.a) * FPS);
  }
  // in a small pause tighten.py removed (<= 1.2 s): move to the next piece;
  // in a bigger gap (a take this version leaves out): OFF
  for (let i = 0; i < SEGS.length; i++)
    if (SEGS[i].a > t) return i > 0 && SEGS[i].a - SEGS[i - 1].b <= 1.2 && t > SEGS[i - 1].b ? segStart(i) : OFF;
  return OFF;
};
const rel = (t: number, from: number) => E(t) - E(from);
// a beat whose END falls outside this cut (short version) lasts to the end of its piece
const pieceEnd = (fr: number) => {
  for (let i = 0; i < SEGS.length; i++) if (fr < segStart(i) + SEGS[i].frames) return segStart(i) + SEGS[i].frames;
  return SPEECH_FRAMES;
};
const life = (from: number, to: number) => {
  const a = E(from);
  if (a === OFF) return 1;
  const b = E(to);
  return Math.max(8, (b === OFF ? pieceEnd(a) : b) - a);
};
void rel;

const At: React.FC<{ from: number; to: number; children: React.ReactNode; name?: string }> = ({ from, to, children, name }) => (
  <Sequence from={E(from)} durationInFrames={life(from, to)} name={name} layout="none">
    {children}
  </Sequence>
);
// Emoji reactions and hand-placed sound hits belong to the "heavy" style; the calm style drops them.
const Emoji: React.FC<{ from: number; to: number; e: string }> = ({ from, to, e }) =>
  STYLE === "calm" ? null : (
    <At from={from} to={to} name={e}>
      <BigEmoji life={life(from, to)} emoji={e} size={RS} x={RX} y={RY} />
    </At>
  );
// Hit: a sound effect at an ORIGINAL second; `keep` plays it in the calm style too (e.g. notify on a real WhatsApp demo)
const Hit: React.FC<{ t: number; src: string; vol?: number; keep?: boolean }> = ({ t, src, vol, keep }) =>
  STYLE === "calm" && !keep ? null : <Sfx at={E(t)} src={src} vol={vol} />;

// Zoom snaps: automatic at EVERY cut (after tighten.py that is every pause),
// alternating 1.0 / 1.1, skipping a cut that comes < 0.7 s after the last
// snap. Inside a piece, another snap lands on the next word start once
// 2.4 s have passed without one (MID_SNAP), so the frame never sits still.
// EXTRA_SNAPS adds hand-placed ones ([original second, zoom]).
const EXTRA_SNAPS: [number, number][] = [];
const SNAP_FRAMES: [number, number][] = (() => {
  const out: [number, number][] = [];
  let z = 1.0;
  let last = -999;
  const MID_SNAP = STYLE === "calm" ? 1e9 : 2.4 * FPS; // calm: snaps only at cuts
  SEGS.forEach((s, i) => {
    const fr = segStart(i);
    if (fr - last >= 0.7 * FPS) {
      out.push([fr, z]);
      z = z === 1.0 ? SNAP_Z : 1.0;
      last = fr;
    }
    for (const w of words) {
      const wf = Math.round(w.start * FPS);
      if (wf <= fr || wf >= fr + s.frames - 0.6 * FPS) continue;
      if (wf - last >= MID_SNAP) {
        out.push([wf, z]);
        z = z === 1.0 ? SNAP_Z : 1.0;
        last = wf;
      }
    }
  });
  for (const [t, zz] of EXTRA_SNAPS) out.push([E(t), zz]);
  return out.sort((p, q) => p[0] - q[0]);
})();

type Push = { at: number; z: number; up?: number; until: number | "end"; down?: number };
const PUSHES: Push[] = [];

const useZoom = () => {
  const f = useCurrentFrame();
  let base = 1;
  for (const [fr, z] of SNAP_FRAMES) if (f >= fr) base = z;
  let push = 1;
  for (const p of PUSHES) {
    const a = E(p.at);
    const b = p.until === "end" ? REEL_DURATION : E(p.until);
    const up = p.up ?? 12;
    const down = p.down ?? 0;
    if (f < a || f >= b + down) continue;
    const rise = interpolate(f, [a, a + up], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
    const fall = down > 0 ? interpolate(f, [b, b + down], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : f < b ? 1 : 0;
    push *= 1 + (p.z - 1) * rise * fall;
  }
  return base * push;
};

// The speaker's cut-out, only on the frames of a BEHIND/BACKDROPS window
// (elsewhere nothing is decoded, so fg.webm costs render time only there).
const FG_WINDOWS: [number, number][] = [...BEHIND, ...BACKDROPS].map((w) => [E(w.from), E(w.from) + life(w.from, w.to)] as [number, number]).filter(([a]) => a !== OFF);
type FgMoment = { f0: number; f1: number; src: string };
const FgPiece: React.FC<{ seg: Seg; index: number }> = ({ seg, index }) => {
  const f = useCurrentFrame();
  const abs = segStart(index) + f;
  if (!FG_WINDOWS.some(([a, b]) => abs >= a - 1 && abs < b + 1)) return null;
  const p0 = Math.round(seg.a * FPS); // original frame where this piece starts
  const m = (fgMoments as FgMoment[]).find((x) => p0 + f >= x.f0 && p0 + f < x.f1);
  if (!m) return null;
  // fg file frame k = original frame m.f0 + k; this piece shows original p0 + f
  // AbsoluteFill: positioned, so it paints ABOVE the (positioned) backdrop and words
  return (
    <AbsoluteFill>
      <Freeze frame={p0 + f - m.f0}>
        <OffthreadVideo src={staticFile(m.src)} transparent muted style={{ width: "100%", height: "100%" }} />
      </Freeze>
    </AbsoluteFill>
  );
};

const NoorEndCard: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 4, fps, config: { damping: 14, stiffness: 150, mass: 0.8 } });
  const dim = interpolate(f, [0, 12], [0, 0.55], { extrapolateRight: "clamp" });
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${dim})` }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 560, display: "flex", justifyContent: "center", fontFamily: FONT, opacity: s, transform: `translateY(${(1 - s) * 30}px)` }}>
        <div style={{ background: "rgba(255,255,255,0.97)", color: "#111", borderRadius: 30, padding: "44px 50px", boxShadow: Shadow, textAlign: "center", width: 900, boxSizing: "border-box" }}>
          <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -2 }}>{OUTRO.title}</div>
          <div style={{ fontSize: 40, marginTop: 24, lineHeight: 2.1, fontWeight: 700 }}>{OUTRO.line}</div>
          <div style={{ fontSize: 38, marginTop: 10, color: "#555", lineHeight: 2.1 }}>{OUTRO.cta}</div>
        </div>
      </div>
    </>
  );
};

export const TalkReel: React.FC = () => {
  const zoom = useZoom();
  const last = SEGS[SEGS.length - 1];
  return (
    <AbsoluteFill style={{ background: "#000", fontFamily: FONT }}>
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: ORIGIN, filter: LOOKS[LOOK] }}>
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

        {/* cut-out effects: background swap, then words, then the speaker on top */}
        {BACKDROPS.map((b, i) => (
          <At key={`bd-${i}`} from={b.from} to={b.to} name="backdrop">
            <AbsoluteFill style={{ background: "#000" }}>
              {b.video ? (
                <OffthreadVideo src={staticFile(b.src)} muted style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: b.focus ?? "50% 50%" }} />
              ) : (
                <Img src={staticFile(b.src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: b.focus ?? "50% 0%" }} />
              )}
            </AbsoluteFill>
          </At>
        ))}
        {BEHIND.map((b, i) => (
          <At key={`bh-${i}`} from={b.from} to={b.to} name="behind">
            <BehindText life={life(b.from, b.to)} text={b.text} highlight={b.highlight} y={b.y} size={b.size} />
          </At>
        ))}
        {FG_WINDOWS.length
          ? SEGS.map((s, i) => (
              <Sequence key={`fg-${i}`} from={segStart(i)} durationInFrames={s.frames} layout="none" name={`cut-out ${i + 1}`}>
                <FgPiece seg={s} index={i} />
              </Sequence>
            ))
          : null}
      </AbsoluteFill>
      {VIGNETTE ? <Vignette strength={VIGNETTE} /> : null}

      {STYLE === "heavy"
        ? SNAP_FRAMES.slice(1).map(([fr]) => <Sfx key={`snap-${fr}`} at={fr} src="tap.wav" vol={0.16} />)
        : null}

      {/* HOOK: on screen from frame 0, so the first frame is the cover */}
      <Sequence from={0} durationInFrames={E(HOOK.until)} layout="none" name="hook">
        <HookTitle life={E(HOOK.until)} text={HOOK.text} highlight={HOOK.highlight} sub={HOOK.sub || undefined} y={TOP_Y - 20} />
      </Sequence>

      {/* BEATS go here, e.g.
      <Emoji from={3.1} to={4.4} e="🚀" />
      <At from={5.0} to={7.2} name="number"><Big life={life(5.0, 7.2)} x={CARD_X} y={TOP_Y} text="AED 10-20" sub="per invoice" size={120} accent="#FFD166" /></At>
      <At from={8.0} to={10.4} name="site"><Cutaway life={life(8.0, 10.4)} src="cut/tamm.png" mode="top" focus="50% 0%" label="tamm.abudhabi" y={150} h={960} /></At>
      <At from={11.0} to={14.0} name="news"><HeadlineCard life={life(11.0, 14.0)} source="Axios" date="29 Sep 2026" headline="(the exact real headline)" highlight="(a phrase)" y={240} /></At>
      <Hit t={4.2} src="riser.wav" vol={0.22} />   riser ENDS on the reveal: start it ~1.1 s before
      <Hit t={9.3} src="notify.wav" vol={0.3} keep />   keep = also plays in the calm style
      */}

      {OUTRO_FRAMES > 0 ? (
        <Sequence from={SPEECH_FRAMES} durationInFrames={OUTRO_FRAMES} layout="none" name="end card">
          <NoorEndCard />
        </Sequence>
      ) : null}

      {SCENE === "street" ? (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 300, height: 600, pointerEvents: "none", background: "linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.4) 80%, rgba(0,0,0,0))" }} />
      ) : null}
      <BoldCaptions words={words} bottom={SECOND_LINE ? 575 : 470} latinGroup={CAPTIONS === "roman" ? 3 : 2} upper={CAPTIONS !== "roman"} />
      {SECOND_LINE === "english" ? <EnglishLine lines={linesEn as Line[]} bottom={420} /> : null}
      {SECOND_LINE === "arabic" ? <EnglishLine lines={linesAr as Line[]} bottom={410} rtl /> : null}
      <ProgressBar total={SPEECH_FRAMES} />
      {MUSIC ? <MusicBed words={words} total={REEL_DURATION} src={MUSIC} under={MUSIC_UNDER} /> : null}
      {STYLE === "heavy" ? <Sfx at={Math.max(0, E(HOOK.until) - 6)} src="boom.wav" vol={0.3} /> : null}
    </AbsoluteFill>
  );
};

// unused-import guards for the template
void Big; void LogoRow; void StrikeBig; void CARD_X; void Cutaway; void HeadlineCard; void Hit; void Emoji;
