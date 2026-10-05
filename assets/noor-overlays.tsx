import React from "react";
import { Audio, Easing, Img, OffthreadVideo, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { CAPTION_BREAK, FONT, FONT_PS, Word, isPashto, isRtl } from "./overlays";

// noor-reel additions (Round 1): bold word-by-word captions, a hook
// headline for the first seconds, and a thin progress bar. Copy into
// src/talk/ next to overlays.tsx and reel-overlays.tsx.

export const YELLOW = "#FFE14D";

// Thick black outline that works for Latin AND Urdu/Pashto (WebkitTextStroke
// eats into Nastaliq joins, so the outline is built from shadows instead).
const outline = (px: number) => {
  const s: string[] = [];
  for (let a = 0; a < 360; a += 30) {
    const r = (a * Math.PI) / 180;
    s.push(`${(Math.cos(r) * px).toFixed(1)}px ${(Math.sin(r) * px).toFixed(1)}px 0 #000`);
  }
  s.push(`0 ${px + 4}px ${px * 2}px rgba(0,0,0,0.6)`);
  return s.join(", ");
};

// Hormozi-style captions: no pill, big heavy words with a black outline,
// one to three words on screen, the spoken word yellow and popping in.
// Latin groups are short (2 words) for punch; Urdu/Pashto groups are 3
// because the words are short and the script needs context to read.
export const BoldCaptions: React.FC<{ words: Word[]; size?: number; bottom?: number; latinGroup?: number; rtlGroup?: number; upper?: boolean }> = ({
  words,
  size = 92,
  bottom = 520,
  latinGroup = 2,
  rtlGroup = 3,
  upper = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const anyRtl = words.some((w) => isRtl(w.word));
  const groupSize = anyRtl ? rtlGroup : latinGroup;
  const pashto = isPashto(words);
  const groups: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= groupSize || CAPTION_BREAK.test(w.word.trim())) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  const g = groups.find((gr) => t >= gr[0].start - 0.04 && t < gr[gr.length - 1].end + 0.15);
  if (!g) return null;
  const rtl = isRtl(g.map((w) => w.word).join(" "));
  const fontSize = rtl ? Math.round(size * 0.82) : size;
  return (
    <div
      style={{
        position: "absolute",
        left: 50,
        right: 50,
        bottom,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "flex-end",
        gap: "0 34px", // the spoken word pops to 1.06x: a smaller gap swallows the space
        direction: rtl ? "rtl" : "ltr",
        fontFamily: rtl ? (pashto ? FONT_PS : FONT) : FONT,
        fontSize,
        fontWeight: 900,
        lineHeight: rtl ? 1.9 : 1.05,
        letterSpacing: rtl ? 0 : -1,
        textTransform: upper && !rtl ? "uppercase" : "none",
      }}
    >
      {g.map((w, i) => {
        const on = t >= w.start - 0.02;
        const next = g[i + 1];
        const isCur = on && (!next || t < next.start - 0.02);
        const f0 = Math.round((w.start - 0.02) * fps);
        const pop = on ? spring({ frame: frame - f0, fps, config: { damping: 9, stiffness: 260, mass: 0.5 } }) : 0;
        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              color: isCur ? YELLOW : "#fff",
              opacity: on ? 1 : 0.0,
              transform: `scale(${on ? 0.7 + 0.3 * pop + (isCur ? 0.06 : 0) : 0.7})`,
              textShadow: outline(rtl ? 4 : 6),
            }}
          >
            {w.word.trim()}
          </span>
        );
      })}
    </div>
  );
};

// The hook headline: the first thing on screen, at frame 0, so the first
// frame doubles as the cover. Drops in from the top, holds, slides away.
// `highlight` is a word (or words) inside `text` painted in yellow.
export const HookTitle: React.FC<{ life: number; text: string; highlight?: string; sub?: string; y?: number; size?: number }> = ({
  life,
  text,
  highlight,
  sub,
  y = 250,
  size = 130,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // visible from frame 0 (cover frame); a small settle bounce instead of an entrance
  const settle = spring({ frame: f, fps, config: { damping: 12, stiffness: 200, mass: 0.6 } });
  const exit = interpolate(f, [life - 8, life], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const rtl = isRtl(text);
  const parts = highlight && text.includes(highlight) ? text.split(highlight) : [text];
  return (
    <div
      style={{
        position: "absolute",
        left: 50,
        right: 50,
        top: y,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        transform: `translateY(${-exit * 500}px) scale(${1.04 - 0.04 * settle})`,
        opacity: 1 - exit,
      }}
    >
      <div
        style={{
          background: "#fff",
          color: "#111",
          borderRadius: 26,
          padding: rtl ? "40px 40px 18px" : "26px 38px",
          fontFamily: FONT,
          fontSize: rtl ? Math.round(size * 0.85) : size,
          fontWeight: 900,
          lineHeight: rtl ? 1.9 : 1.08,
          letterSpacing: rtl ? 0 : -2,
          textAlign: "center",
          direction: rtl ? "rtl" : "ltr",
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
          maxWidth: 980,
        }}
      >
        {parts.length === 2 ? (
          <>
            {parts[0]}
            <span style={{ background: YELLOW, borderRadius: 12, padding: "0 10px" }}>{highlight}</span>
            {parts[1]}
          </>
        ) : (
          text
        )}
      </div>
      {sub ? (
        <div style={{ marginTop: 16, fontFamily: FONT, fontSize: size * 0.4, fontWeight: 800, color: "#fff", textShadow: outline(3), direction: isRtl(sub) ? "rtl" : "ltr", lineHeight: isRtl(sub) ? 2 : 1.2 }}>
          {sub}
        </div>
      ) : null}
      <Sequence from={Math.max(0, life - 8)} durationInFrames={20} layout="none">
        <Audio src={staticFile("sfx/whoosh.wav")} volume={0.35} />
      </Sequence>
    </div>
  );
};

// A thin bar along the top edge that fills over the speech: viewers stay
// when they can see the end coming. Sits above the IG title strip.
export const ProgressBar: React.FC<{ total: number; color?: string; y?: number }> = ({ total, color = YELLOW, y = 0 }) => {
  const f = useCurrentFrame();
  const p = Math.min(1, f / Math.max(1, total));
  return (
    <div style={{ position: "absolute", left: 0, top: y, height: 10, width: "100%", background: "rgba(255,255,255,0.18)" }}>
      <div style={{ height: "100%", width: `${p * 100}%`, background: color }} />
    </div>
  );
};

// English subtitle line under the main captions (subs.py makes
// reel-lines.en.json: natural sentences timed to the Urdu words). Designed,
// not the default app look: each sentence is split into chunks of at most
// `maxWords` (breaking at punctuation when it can), chunks share the
// sentence time by word count, words rise in one by one, bold white with a
// black outline, and words written *like this* in english.json land yellow.
export type Line = { text: string; start: number; end: number };
type Tok = { w: string; hot: boolean };
type Chunk = { words: Tok[]; start: number; end: number };
const chunkLine = (l: Line, maxWords: number): Chunk[] => {
  // *a few words* stay yellow across spaces and chunk breaks
  let inHot = false;
  const ws: Tok[] = l.text
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const opens = raw.startsWith("*");
      const closes = /\*[,.;:!?]?$/.test(raw) && raw !== "*";
      const hot = inHot || opens;
      inHot = hot && !closes;
      return { w: raw.replace(/\*/g, ""), hot };
    });
  const groups: Tok[][] = [];
  let cur: Tok[] = [];
  ws.forEach((tok, i) => {
    cur.push(tok);
    const left = ws.length - i - 1;
    const punct = /[,.;:!?]$/.test(tok.w);
    if (cur.length >= maxWords || (punct && cur.length >= 2 && left >= 2)) {
      groups.push(cur);
      cur = [];
    }
  });
  if (cur.length) {
    if (cur.length <= 2 && groups.length) groups[groups.length - 1].push(...cur);
    else groups.push(cur);
  }
  const dur = l.end - l.start;
  let t = l.start;
  return groups.map((g) => {
    const d = (dur * g.length) / ws.length;
    const c = { words: g, start: t, end: t + d };
    t += d;
    return c;
  });
};
// rtl: an Arabic second line (reel-lines.ar.json): right to left, Naskh script, a little taller.
export const EnglishLine: React.FC<{ lines: Line[]; bottom?: number; size?: number; maxWords?: number; rtl?: boolean }> = ({ lines, bottom = 420, size = 56, maxWords = 6, rtl = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const l = lines.find((x) => t >= x.start - 0.05 && t < x.end + 0.3);
  if (!l) return null;
  const chunks = chunkLine(l, maxWords);
  const c = chunks.find((x, i) => t < x.end || i === chunks.length - 1) as Chunk;
  const step = 0.06; // a quick wave: English word order differs from the Urdu, so the whole chunk lands at once
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        bottom,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "0 14px",
        direction: rtl ? "rtl" : "ltr",
        fontFamily: rtl ? FONT_PS : FONT,
        fontSize: rtl ? size * 0.92 : size,
        fontWeight: 800,
        lineHeight: rtl ? 1.6 : 1.15,
        letterSpacing: -0.5,
      }}
    >
      {c.words.map(({ w, hot }, i) => {
        const at = c.start + i * step;
        const p = spring({ frame: frame - Math.round(at * fps), fps, config: { damping: 14, stiffness: 220, mass: 0.5 } });
        const on = t >= at - 0.01;
        return (
          <span
            key={`${c.start}-${i}`}
            style={{
              display: "inline-block",
              color: hot ? YELLOW : "#fff",
              opacity: on ? Math.min(1, p * 1.4) : 0,
              transform: `translateY(${on ? (1 - p) * 18 : 18}px)`,
              textShadow: outline(4),
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
};

// ---------------- Round 2: cutaways, headline cards, music ----------------

// Show the thing being talked about, over the speaker (the voice carries on).
// mode "top":  image/video fills the top of the frame in a rounded box, the
//              speaker's face stays visible below (best default: keeps eye contact).
// mode "full": covers the whole frame for 1-2.5 s (a strong pattern interrupt).
// mode "card": a tilted rounded card in the card band, smaller.
// Images get a slow Ken Burns push; videos play muted from `start` seconds.
// `label` is a short source line under the media ("tamm.abudhabi", "Axios, 29 Sep").
export const Cutaway: React.FC<{
  life: number;
  src: string;
  video?: boolean;
  start?: number;
  mode?: "top" | "full" | "card";
  label?: string;
  focus?: string; // object-position, e.g. "50% 0%" to keep the top of a screenshot
  y?: number;
  h?: number;
  sfx?: boolean;
  w?: number; // card width (mode "card"); height follows at ~0.69
}> = ({ life, src, video, start = 0, mode = "top", label, focus = "50% 30%", y = 200, h = 1000, sfx = true, w = 900 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 16, stiffness: 170, mass: 0.7 } });
  const exit = interpolate(f, [life - 7, life], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const kb = 1.04 + 0.08 * (f / Math.max(1, life));
  const media = video ? (
    <OffthreadVideo src={staticFile(src)} startFrom={Math.round(start * fps)} muted style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focus }} />
  ) : (
    <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: focus, transform: `scale(${kb})`, transformOrigin: focus }} />
  );
  const box: React.CSSProperties =
    mode === "full"
      ? { left: 0, top: 0, width: 1080, height: 1920, borderRadius: 0 }
      : mode === "top"
        ? { left: 40, top: y, width: 1000, height: h, borderRadius: 34 }
        : { left: (1080 - w) / 2, top: y + 40, width: w, height: Math.round(w * 0.69), borderRadius: 28 };
  const slide = mode === "full" ? `scale(${1.08 - 0.08 * enter})` : `translateY(${(1 - enter) * -120}px) rotate(${mode === "card" ? -2 : 0}deg)`;
  return (
    <>
      <div
        style={{
          position: "absolute",
          ...box,
          overflow: "hidden",
          opacity: Math.min(enter * 1.3, 1) * (1 - exit),
          transform: `${slide} translateX(${exit * (mode === "full" ? 0 : -900)}px)`,
          boxShadow: mode === "full" ? "none" : "0 30px 80px rgba(0,0,0,0.5)",
          border: mode === "full" ? "none" : "6px solid #fff",
          background: "#111",
        }}
      >
        {media}
        {label ? (
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "40px 26px 18px", background: "linear-gradient(transparent, rgba(0,0,0,0.75))", color: "#fff", fontFamily: FONT, fontSize: 34, fontWeight: 700 }}>
            {label}
          </div>
        ) : null}
      </div>
      {sfx ? (
        <>
          <Sequence from={0} durationInFrames={15} layout="none">
            <Audio src={staticFile("sfx/swoosh.wav")} volume={0.35} />
          </Sequence>
          <Sequence from={Math.max(0, life - 8)} durationInFrames={15} layout="none">
            <Audio src={staticFile("sfx/swoosh.wav")} volume={0.2} />
          </Sequence>
        </>
      ) : null}
    </>
  );
};

// A news headline as a clean card (source + date + headline, one phrase in
// yellow). For "X just launched Y" reels. Quote the real headline and name the
// real source; never use an outlet's logo or make it look like their website.
export const HeadlineCard: React.FC<{ life: number; source: string; date?: string; headline: string; highlight?: string; y?: number }> = ({
  life,
  source,
  date,
  headline,
  highlight,
  y = 260,
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 15, stiffness: 180, mass: 0.7 } });
  const exit = interpolate(f, [life - 7, life], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const parts = highlight && headline.includes(highlight) ? headline.split(highlight) : [headline];
  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        width: 960,
        top: y,
        boxSizing: "border-box",
        background: "#fff",
        borderRadius: 26,
        padding: "30px 38px 34px",
        fontFamily: FONT,
        boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
        opacity: Math.min(1, enter * 1.3) * (1 - exit),
        transform: `translateY(${(1 - enter) * -80 - exit * 60}px) rotate(${(1 - enter) * -3}deg)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 800, color: "#d32f2f", letterSpacing: 1 }}>
        <span style={{ width: 14, height: 14, borderRadius: 7, background: "#d32f2f", display: "inline-block" }} />
        {source.toUpperCase()}
        {date ? <span style={{ color: "#888", fontWeight: 600, letterSpacing: 0 }}>{date}</span> : null}
      </div>
      <div style={{ marginTop: 16, fontSize: 56, fontWeight: 900, lineHeight: 1.12, color: "#111", letterSpacing: -1 }}>
        {parts.length === 2 ? (
          <>
            {parts[0]}
            <span style={{ background: YELLOW, padding: "0 8px", borderRadius: 8 }}>{highlight}</span>
            {parts[1]}
          </>
        ) : (
          headline
        )}
      </div>
      <Sequence from={0} durationInFrames={10} layout="none">
        <Audio src={staticFile("sfx/shutter.wav")} volume={0.35} />
      </Sequence>
    </div>
  );
};

// Music under the voice, ducked automatically: `under` dB while someone is
// speaking, `gap` dB in pauses and the outro, fading at both ends. Speech
// spans come from the caption words (edit seconds). Loops a short track.
// Default track public/music/bed-soft.wav (make_sfx2.py). For Instagram, a
// trending sound added IN THE APP usually reaches more people: then set
// MUSIC false and add the sound in the app at ~10 % volume.
export const MusicBed: React.FC<{ words: Word[]; total: number; src?: string; under?: number; gap?: number; loopFrames?: number }> = ({
  words,
  total,
  src = "music/bed-soft.wav",
  under = -26,
  gap = -17,
  loopFrames = 1800,
}) => {
  const { fps } = useVideoConfig();
  const spans: [number, number][] = [];
  for (const w of words) {
    const s = w.start - 0.15;
    const e = w.end + 0.25;
    if (spans.length && s - spans[spans.length - 1][1] < 0.5) spans[spans.length - 1][1] = e;
    else spans.push([s, e]);
  }
  const db = (d: number) => Math.pow(10, d / 20);
  const vol = (absFrame: number) => {
    const t = absFrame / fps;
    const talking = spans.some(([s, e]) => t >= s && t <= e);
    const near = spans.some(([s, e]) => t >= s - 0.25 && t <= e + 0.25);
    const level = talking ? db(under) : near ? (db(under) + db(gap)) / 2 : db(gap);
    const fadeIn = Math.min(1, t / 1.0);
    const fadeOut = Math.min(1, (total / fps - t) / 1.5);
    return Math.max(0, level * fadeIn * fadeOut);
  };
  const loops = Math.ceil(total / loopFrames);
  return (
    <>
      {Array.from({ length: loops }).map((_, k) => (
        <Sequence key={k} from={k * loopFrames} durationInFrames={Math.min(loopFrames, total - k * loopFrames)} layout="none">
          <Audio src={staticFile(src)} volume={(f) => vol(k * loopFrames + f)} />
        </Sequence>
      ))}
    </>
  );
};

// ---------------- Round 3: text behind the head, colour look ----------------

// Huge words BEHIND the speaker (the speaker's cut-out, fg.webm from
// matte.py, is drawn on top by the template). Lines split on "\n";
// `highlight` (a whole line) is yellow. Keep it to 1-3 short words.
export const BehindText: React.FC<{ life: number; text: string; highlight?: string; y?: number; size?: number }> = ({ life, text, highlight, y = 330, size = 250 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: f, fps, config: { damping: 13, stiffness: 150, mass: 0.8 } });
  const exit = interpolate(f, [life - 8, life], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic) });
  const drift = interpolate(f, [0, life], [0, -24]);
  const rtl = isRtl(text);
  return (
    <div
      style={{
        position: "absolute",
        left: -40,
        right: -40,
        top: y,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        fontFamily: FONT,
        fontSize: rtl ? size * 0.75 : size,
        fontWeight: 900,
        lineHeight: rtl ? 1.6 : 0.88,
        letterSpacing: rtl ? 0 : -size * 0.05,
        textTransform: rtl ? "none" : "uppercase",
        direction: rtl ? "rtl" : "ltr",
        opacity: Math.min(1, enter * 1.4) * (1 - exit),
        transform: `translateY(${drift + (1 - enter) * 60}px) scale(${0.9 + 0.1 * enter})`,
      }}
    >
      {text.split("\n").map((line, i) => (
        <div key={i} style={{ color: line === highlight ? YELLOW : "#fff", textShadow: "0 10px 40px rgba(0,0,0,0.35)", whiteSpace: "nowrap" }}>
          {line}
        </div>
      ))}
      <Sequence from={0} durationInFrames={20} layout="none">
        <Audio src={staticFile("sfx/boom.wav")} volume={0.3} />
      </Sequence>
    </div>
  );
};

// Colour looks applied to the speaker layer (CSS filters, no extra render
// cost worth mentioning). "natural" = a light lift most phone footage
// needs; "punchy" = more contrast/colour for bright outdoor shots; "warm" =
// evening/indoor skin tones; "none" = untouched.
export const LOOKS: Record<string, string> = {
  none: "none",
  natural: "brightness(1.03) contrast(1.06) saturate(1.08)",
  punchy: "brightness(1.02) contrast(1.14) saturate(1.2)",
  warm: "sepia(0.08) brightness(1.03) contrast(1.07) saturate(1.1)",
};
export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.28 }) => (
  <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse at 50% 42%, transparent 55%, rgba(0,0,0,${strength}) 100%)`, pointerEvents: "none" }} />
);
