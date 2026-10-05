// TEACHING PACK for noor-reel: graphics that make one idea easy to understand
// (based on research into educational short-form video graphics).
// Rules: each piece builds IN STEPS on the spoken words (pass `at` frames from
// the transcript), one piece on screen at a time, <= 6 words of text per item,
// yellow = the key thing, red = wrong. Same look switch as the rest of the kit
// (setLook "clean" | "iron"); sizes adapt to 9:16 (TikTok/Reels/Shorts) and
// 16:9 (YouTube). All frames are relative to the piece's own <Sequence>.
import React from "react";
import { Easing, Img, OffthreadVideo, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { AMBER, CYAN, MONO, RED, SANS, aa, bg, ca, glow, useOpen } from "./iron";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const ease = (f: number, a: number, d = 8) => interpolate(f, [a, a + d], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

// the band a teaching piece lives in: above the head on phones, the right
// side (or a given box) on widescreen. Override with x/y/w/h on any piece.
export const useBand = (o: { x?: number; y?: number; w?: number; h?: number } = {}) => {
  const { width: W, height: H } = useVideoConfig();
  const wide = W > H;
  const w = o.w ?? (wide ? W * 0.46 : Math.min(940, W - 120));
  const h = o.h ?? (wide ? H * 0.7 : 460);
  const x = o.x ?? (wide ? W - w - W * 0.05 : (W - w) / 2);
  const y = o.y ?? (wide ? (H - h) / 2 : 130);
  return { x, y, w, h, W, H, wide };
};
type Box = { x?: number; y?: number; w?: number; h?: number };

const glass = (accent = CYAN): React.CSSProperties => ({
  background: `linear-gradient(160deg, ${bg(0.88)}, ${bg(0.78)})`,
  border: `2px solid ${accent}`,
  borderRadius: 14,
  boxShadow: `0 10px 30px rgba(0,0,0,0.45)`,
});

// ---------------------------------------------------------------- 1. FLOW
// Steps that build one at a time on the words; the arrow draws in first, then
// the box. The newest step is yellow, earlier ones go white.
// steps: [{ text: "Customer messages", icon: "💬", at: 12 }, ...]
export const FlowSteps: React.FC<Box & { life: number; steps: { text: string; icon?: string; at: number }[]; title?: string }> = ({ life, steps, title, ...o }) => {
  const { f, k } = useOpen(life, 8, 8);
  const { fps } = useVideoConfig();
  const b = useBand(o);
  const n = steps.length;
  const cols = n <= 3 ? n : n === 4 ? 2 : 3;
  const rows = Math.ceil(n / cols);
  const gap = 56;
  const top = title ? 64 : 0;
  const bw = (b.w - gap * (cols - 1)) / cols;
  const bh = Math.min(170, (b.h - top - 40 * (rows - 1)) / rows);
  // snake order: left->right, then right->left on the next row, so arrows stay short
  const pos = (i: number) => {
    const r = Math.floor(i / cols);
    let c = i % cols;
    if (r % 2 === 1) c = cols - 1 - c;
    return { x: c * (bw + gap), y: top + r * (bh + 40) };
  };
  const last = steps.reduce((m, s, i) => (f >= s.at ? i : m), -1);
  return (
    <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, opacity: k }}>
      {title ? <div style={{ fontFamily: MONO, fontSize: 28, letterSpacing: 4, color: CYAN, textTransform: "uppercase", filter: glow(CYAN, 4) }}>{title}</div> : null}
      <svg width={b.w} height={b.h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {steps.slice(1).map((s, j) => {
          const i = j + 1;
          const p0 = pos(i - 1);
          const p1 = pos(i);
          const sameRow = Math.abs(p0.y - p1.y) < 1;
          const x0 = sameRow ? (p1.x > p0.x ? p0.x + bw : p0.x) : p0.x + bw / 2;
          const y0 = sameRow ? p0.y + bh / 2 : p0.y + bh;
          const x1 = sameRow ? (p1.x > p0.x ? p1.x : p1.x + bw) : p1.x + bw / 2;
          const y1 = sameRow ? p1.y + bh / 2 : p1.y;
          const d = Math.hypot(x1 - x0, y1 - y0);
          const t = ease(f, s.at - 6, 7);
          const ang = Math.atan2(y1 - y0, x1 - x0);
          return (
            <g key={i} opacity={t > 0 ? 1 : 0} style={{ filter: glow(AMBER, 4) }}>
              <line x1={x0} y1={y0} x2={x1} y2={y1} stroke={AMBER} strokeWidth={5} strokeDasharray={d} strokeDashoffset={d * (1 - t)} strokeLinecap="round" />
              {t > 0.95 ? <polygon points="0,-11 18,0 0,11" fill={AMBER} transform={`translate(${x1} ${y1}) rotate(${(ang * 180) / Math.PI}) translate(-16 0)`} /> : null}
            </g>
          );
        })}
      </svg>
      {steps.map((s, i) => {
        const p = pos(i);
        const sp = spring({ frame: f - s.at, fps, config: { damping: 14, stiffness: 150 } });
        const hot = i === last;
        return (
          <div key={i} style={{ position: "absolute", left: p.x, top: p.y, width: bw, height: bh, ...glass(hot ? AMBER : ca(0.6)), opacity: f >= s.at ? 1 : 0, transform: `scale(${0.6 + 0.4 * sp})`, display: "flex", flexDirection: bw < 360 ? "column" : "row", justifyContent: "center", alignItems: "center", textAlign: bw < 360 ? "center" : "left", gap: bw < 360 ? 6 : 16, padding: "0 16px", boxSizing: "border-box" }}>
            {s.icon ? <div style={{ fontSize: Math.min(64, bh * (bw < 360 ? 0.32 : 0.45)) }}>{s.icon}</div> : <div style={{ fontFamily: MONO, fontSize: 30, color: hot ? AMBER : CYAN }}>{i + 1}</div>}
            <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: Math.min(40, bw / 7.5), lineHeight: 1.12, color: hot ? "#fff" : "rgba(255,255,255,0.85)" }}>{s.text}</div>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- 2. COMPARE
// Before vs after / wrong vs right. The left side shows first; at `revealAt`
// a divider sweeps across and the right side lands. Lines are <= 6 words.
export const SplitCompare: React.FC<Box & {
  life: number;
  left: { label: string; lines: string[]; img?: string };
  right: { label: string; lines: string[]; img?: string };
  revealAt: number;
}> = ({ life, left, right, revealAt, ...o }) => {
  const { f, k } = useOpen(life, 8, 8);
  const b = useBand(o);
  const sweep = ease(f, revealAt, 12);
  const half = (b.w - 20) / 2;
  const side = (s: typeof left, good: boolean, show: number) => (
    <div style={{ width: half, minHeight: 200, ...glass(good ? AMBER : RED), padding: 22, boxSizing: "border-box", opacity: show, transform: `translateY(${(1 - show) * 30}px)`, display: "flex", flexDirection: "column", gap: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: MONO, fontSize: 26, letterSpacing: 3, color: good ? AMBER : RED }}>
        <span>{s.label}</span>
        <span style={{ fontSize: 40, fontWeight: 700 }}>{good ? "✓" : "✕"}</span>
      </div>
      {s.img ? <Img src={staticFile(s.img)} style={{ width: "100%", height: Math.min(300, b.h * 0.42), objectFit: "cover", borderRadius: 8, filter: good ? "none" : "grayscale(0.6)" }} /> : null}
      {s.lines.map((l, i) => (
        <div key={i} style={{ fontFamily: SANS, fontWeight: 700, fontSize: Math.min(38, half / 9), color: "#fff", lineHeight: 1.2, opacity: ease(f, (good ? revealAt : 6) + 4 + i * 5, 6) }}>{l}</div>
      ))}
    </div>
  );
  return (
    <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, opacity: k, display: "flex", alignItems: "stretch", gap: 20 }}>
      {side(left, false, ease(f, 0, 8))}
      {side(right, true, sweep)}
      <div style={{ position: "absolute", top: -14, bottom: -14, left: half + 10 - 2 + (1 - sweep) * -half, width: 4, background: AMBER, boxShadow: `0 0 18px ${AMBER}`, opacity: sweep > 0 && sweep < 1 ? 1 : 0 }} />
    </div>
  );
};

// ---------------------------------------------------------------- 3. NEXT WORD
// How a chatbot writes: the sentence appears as word chips (tokens), then the
// model's top guesses for the next word as bars, the winner flies into the
// sentence. Probabilities are ILLUSTRATIVE: the piece always says "example".
export const NextWord: React.FC<Box & {
  life: number;
  words: [string, number][]; // [chip, at]
  guesses: [string, number][]; // [word, percent]; first = the one picked
  barsAt: number;
  pickAt: number;
}> = ({ life, words, guesses, barsAt, pickAt, ...o }) => {
  const { f, k } = useOpen(life, 8, 8);
  const { fps } = useVideoConfig();
  const b = useBand(o);
  const pick = spring({ frame: f - pickAt, fps, config: { damping: 15, stiffness: 120 } });
  const fs = Math.min(40, b.w / 16);
  return (
    <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, opacity: k, ...glass(), padding: 24, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 22, letterSpacing: 3, color: CYAN }}>
        <span>HOW AI WRITES</span>
        <span style={{ opacity: 0.7 }}>example numbers</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 20, minHeight: fs * 1.8 }}>
        {words.map(([w, at], i) => {
          const s = spring({ frame: f - at, fps, config: { damping: 14, stiffness: 160 } });
          return (
            <span key={i} style={{ fontFamily: SANS, fontWeight: 800, fontSize: fs, color: "#fff", padding: "4px 14px", borderRadius: 10, background: ca(0.12), border: `2px solid ${ca(0.5)}`, opacity: f >= at ? 1 : 0, transform: `scale(${0.6 + 0.4 * s})` }}>{w}</span>
          );
        })}
        {f >= pickAt ? (
          <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: fs, color: "#111", padding: "4px 14px", borderRadius: 10, background: AMBER, transform: `translateY(${(1 - pick) * 160}px) scale(${0.7 + 0.3 * pick})`, boxShadow: `0 0 20px ${aa(0.6)}` }}>{guesses[0][0]}</span>
        ) : (
          <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: fs, color: AMBER, opacity: f >= barsAt && Math.floor(f / 8) % 2 ? 1 : 0.2 }}>?</span>
        )}
      </div>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        {guesses.map(([w, p], i) => {
          const g = ease(f, barsAt + i * 4, 14);
          const win = i === 0;
          return (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, opacity: g * (win || f < pickAt ? 1 : 0.45) }}>
              <div style={{ width: b.w * 0.22, fontFamily: SANS, fontWeight: 700, fontSize: fs * 0.8, color: win ? AMBER : "#fff", textAlign: "right" }}>{w}</div>
              <div style={{ flex: 1, height: fs * 0.75, background: ca(0.1), borderRadius: 6, overflow: "hidden" }}>
                <div style={{ width: `${p * g}%`, height: "100%", background: win ? AMBER : ca(0.7) }} />
              </div>
              <div style={{ width: 80, fontFamily: MONO, fontSize: fs * 0.65, color: win ? AMBER : CYAN, fontVariantNumeric: "tabular-nums" }}>{Math.round(p * g)}%</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- 4. NEURAL NET
// Simple network: nodes in layers, a signal travels layer by layer from
// `startAt` (one layer per `step` frames). Labels for what goes in and out.
export const NeuralNet: React.FC<Box & { life: number; layers?: number[]; startAt: number; step?: number; input?: string; output?: string }> = ({ life, layers = [3, 5, 5, 2], startAt, step = 8, input, output, ...o }) => {
  const { f, k } = useOpen(life, 8, 8);
  const b = useBand(o);
  const padX = input ? b.w * 0.17 : 40;
  const padR = output ? b.w * 0.17 : 40;
  const lx = (l: number) => padX + (l * (b.w - padX - padR)) / (layers.length - 1);
  const ny = (l: number, i: number) => {
    const n = layers[l];
    const span = Math.min(b.h - 80, n * 110);
    return b.h / 2 - span / 2 + (n === 1 ? span / 2 : (i * span) / (n - 1));
  };
  const lit = (l: number) => ease(f, startAt + l * step, step);
  const R = Math.min(26, b.h / 20);
  const fs = Math.min(36, b.w / 14);
  return (
    <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, opacity: k }}>
      <svg width={b.w} height={b.h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {layers.slice(1).map((n, l1) =>
          Array.from({ length: layers[l1] }, (_, i) =>
            Array.from({ length: n }, (_, j) => {
              const on = lit(l1 + 1);
              return <line key={`${l1}-${i}-${j}`} x1={lx(l1)} y1={ny(l1, i)} x2={lx(l1 + 1)} y2={ny(l1 + 1, j)} stroke={on > 0.5 ? AMBER : ca(0.25)} strokeWidth={on > 0.5 ? 2.5 : 1.5} opacity={0.35 + 0.5 * on} />;
            }),
          ),
        )}
        {layers.map((n, l) =>
          Array.from({ length: n }, (_, i) => {
            const on = lit(l);
            return <circle key={`${l}-${i}`} cx={lx(l)} cy={ny(l, i)} r={R * (1 + 0.25 * on)} fill={on > 0.5 ? AMBER : bg(0.9)} stroke={on > 0.5 ? AMBER : CYAN} strokeWidth={3} style={{ filter: on > 0.5 ? glow(AMBER, 8) : undefined }} />;
          }),
        )}
      </svg>
      {input ? <div style={{ position: "absolute", left: 0, width: padX - 20, top: b.h / 2 - fs, textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: fs, color: "#fff", lineHeight: 1.1, opacity: ease(f, startAt - 10, 8) }}>{input}</div> : null}
      {output ? <div style={{ position: "absolute", right: 0, width: padR - 20, top: b.h / 2 - fs, textAlign: "center", fontFamily: SANS, fontWeight: 800, fontSize: fs, color: AMBER, lineHeight: 1.1, opacity: lit(layers.length - 1) }}>{output}</div> : null}
    </div>
  );
};

// ---------------------------------------------------------------- 5. TERM CARD
// A new word: the word big, a one-line meaning typing in, optional icon.
export const TermCard: React.FC<Box & { life: number; term: string; meaning: string; icon?: string; meaningAt?: number }> = ({ life, term, meaning, icon, meaningAt = 10, ...o }) => {
  const { f, k, flick } = useOpen(life, 8, 8);
  const b = useBand({ h: 300, ...o });
  const chars = Math.floor(Math.max(0, f - meaningAt) * 1.8);
  return (
    <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, opacity: k * flick, ...glass(AMBER), padding: "22px 30px 28px", boxSizing: "border-box", transform: `translateY(${(1 - k) * 20}px)` }}>
      <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: 4, color: AMBER }}>NEW WORD</div>
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginTop: 6 }}>
        {icon ? <span style={{ fontSize: 80 }}>{icon}</span> : null}
        <span style={{ fontFamily: SANS, fontWeight: 900, fontSize: Math.min(96, b.w / 7), color: "#fff", letterSpacing: -2 }}>{term}</span>
      </div>
      <div style={{ fontFamily: SANS, fontWeight: 600, fontSize: Math.min(40, b.w / 22), color: "rgba(255,255,255,0.9)", marginTop: 8, minHeight: 50 }}>
        {meaning.slice(0, chars)}
        {chars < meaning.length && f >= meaningAt ? <span style={{ color: AMBER }}>▌</span> : null}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- 6. SCREEN ZOOM
// A screen recording (mp4) or screenshot (png/jpg) in a device frame; the
// camera moves to each focus region and a highlight box (plus a click ring)
// lands on it. Regions are in the SOURCE's own pixels.
export const ScreenZoom: React.FC<Box & {
  life: number;
  src: string;
  srcW: number;
  srcH: number;
  focus: { at: number; x: number; y: number; w: number; h: number; click?: boolean; label?: string }[];
  startFrom?: number; // video: source frame to start at
}> = ({ life, src, srcW, srcH, focus, startFrom = 0, ...o }) => {
  const { f, k } = useOpen(life, 8, 8);
  const b = useBand(o);
  const video = /\.(mp4|webm|mov)$/i.test(src);
  // current and previous focus -> camera
  let cur = -1;
  focus.forEach((z, i) => {
    if (f >= z.at) cur = i;
  });
  const full = { x: 0, y: 0, w: srcW, h: srcH };
  const from = cur > 0 ? focus[cur - 1] : full;
  const to = cur >= 0 ? focus[cur] : full;
  const t = cur >= 0 ? ease(f, focus[cur].at, 14) : 0;
  const A = cur >= 0 ? from : full;
  const B = to;
  const pad = 1.6; // show some context around the region
  const lerp = (p: number, q: number) => p + (q - p) * t;
  const cw = Math.min(srcW, lerp(A === full ? srcW : A.w * pad, B === full ? srcW : B.w * pad));
  const ch = Math.min(srcH, lerp(A === full ? srcH : A.h * pad, B === full ? srcH : B.h * pad));
  const cx = lerp(A.x + A.w / 2, B.x + B.w / 2);
  const cy = lerp(A.y + A.h / 2, B.y + B.h / 2);
  const viewW = b.w - 16;
  const viewH = b.h - 16;
  // whole screen fits at rest (contain); zoom so the region (with context) fills the view
  const scale = Math.max(Math.min(viewW / srcW, viewH / srcH), Math.min(viewW / cw, viewH / ch));
  const mw = srcW * scale;
  const mh = srcH * scale;
  const ox = mw <= viewW ? (viewW - mw) / 2 : Math.min(0, Math.max(viewW - mw, viewW / 2 - cx * scale));
  const oy = mh <= viewH ? (viewH - mh) / 2 : Math.min(0, Math.max(viewH - mh, viewH / 2 - cy * scale));
  const z = cur >= 0 ? focus[cur] : null;
  const boxK = z ? ease(f, z.at + 12, 6) : 0;
  const ring = z?.click ? interpolate(f, [z.at + 16, z.at + 34], [0, 1], clamp) : 0;
  const media: React.CSSProperties = { position: "absolute", left: ox, top: oy, width: srcW * scale, height: srcH * scale };
  return (
    <div style={{ position: "absolute", left: b.x, top: b.y, width: b.w, height: b.h, opacity: k, ...glass(ca(0.7)), padding: 8, boxSizing: "border-box" }}>
      <div style={{ position: "relative", width: viewW, height: viewH, overflow: "hidden", borderRadius: 8, background: "#000" }}>
        {video ? <OffthreadVideo src={staticFile(src)} startFrom={startFrom} muted style={media} /> : <Img src={staticFile(src)} style={media} />}
        {z ? (
          <>
            <div style={{ position: "absolute", left: ox + z.x * scale - 8, top: oy + z.y * scale - 8, width: z.w * scale + 16, height: z.h * scale + 16, border: `5px solid ${AMBER}`, borderRadius: 10, opacity: boxK, boxShadow: `0 0 0 9999px rgba(0,0,0,${0.45 * boxK}), 0 0 20px ${AMBER}` }} />
            {z.click && ring > 0 && ring < 1 ? <div style={{ position: "absolute", left: ox + (z.x + z.w / 2) * scale - 60 * ring, top: oy + (z.y + z.h / 2) * scale - 60 * ring, width: 120 * ring, height: 120 * ring, borderRadius: "50%", border: `4px solid ${AMBER}`, opacity: 1 - ring }} /> : null}
            {z.label ? <div style={{ position: "absolute", left: Math.max(8, Math.min(viewW - 360, ox + z.x * scale)), top: Math.min(viewH - 70, oy + (z.y + z.h) * scale + 18), padding: "8px 16px", background: AMBER, color: "#111", fontFamily: SANS, fontWeight: 800, fontSize: 32, borderRadius: 8, opacity: boxK }}>{z.label}</div> : null}
          </>
        ) : null}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- 7. SAVE THIS
// End card for teaching videos: "save this" + the 3 things to remember.
export const SaveCard: React.FC<{ life: number; title: string; points: string[]; handle?: string }> = ({ life, title, points, handle }) => {
  const { f, k } = useOpen(life, 10, 6);
  const { fps, width: W, height: H } = useVideoConfig();
  const wide = W > H;
  const w = wide ? W * 0.5 : W - 120;
  const pulse = 1 + 0.08 * Math.sin(f * 0.3);
  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${0.55 * k})` }} />
      <div style={{ position: "absolute", left: (W - w) / 2, top: wide ? H * 0.16 : H * 0.22, width: w, opacity: k, ...glass(AMBER), padding: "30px 36px 34px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: MONO, fontSize: 26, letterSpacing: 4, color: AMBER }}>
          <svg width={34} height={40} viewBox="0 0 24 28" style={{ transform: `scale(${pulse})` }}>
            <path d="M3 2h18v24l-9-6-9 6z" fill={AMBER} />
          </svg>
          SAVE THIS
        </div>
        <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: Math.min(64, w / 12), color: "#fff", marginTop: 14, lineHeight: 1.1 }}>{title}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 24 }}>
          {points.map((p, i) => {
            const s = spring({ frame: f - 8 - i * 6, fps, config: { damping: 15, stiffness: 150 } });
            return (
              <div key={i} style={{ display: "flex", gap: 16, alignItems: "baseline", opacity: s, transform: `translateX(${(1 - s) * -30}px)` }}>
                <span style={{ fontFamily: MONO, fontSize: 30, color: AMBER }}>{i + 1}</span>
                <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: Math.min(40, w / 20), color: "#fff", lineHeight: 1.2 }}>{p}</span>
              </div>
            );
          })}
        </div>
        {handle ? <div style={{ marginTop: 26, fontFamily: MONO, fontSize: 24, color: CYAN, opacity: ease(f, 30, 8) }}>Follow {handle} for one AI idea a day</div> : null}
      </div>
    </>
  );
};
void RED;

// ---------------------------------------------------------------- 8. CHAPTER (YouTube long form)
// "PART 2 · How AI writes": a lower-third that opens each chapter of a long
// video (research: engagement drops after ~6 min, so long videos are built as
// short chapters, each with its own small hook). Also add the same chapter
// times to the YouTube description (00:00 Intro, 01:40 How AI writes, ...).
export const ChapterCard: React.FC<{ life: number; n: number; title: string }> = ({ life, n, title }) => {
  const { f, k } = useOpen(life, 10, 10);
  const { width: W, height: H } = useVideoConfig();
  const wide = W > H;
  const bar = ease(f, 0, 12);
  return (
    <div style={{ position: "absolute", left: wide ? W * 0.05 : 60, top: wide ? H * 0.72 : H * 0.1, opacity: k }}>
      <div style={{ fontFamily: MONO, fontSize: wide ? 30 : 28, letterSpacing: 6, color: AMBER }}>PART {n}</div>
      <div style={{ height: 5, width: 160 * bar, background: AMBER, margin: "10px 0 14px", boxShadow: `0 0 12px ${aa(0.6)}` }} />
      <div style={{ fontFamily: SANS, fontWeight: 900, fontSize: wide ? 76 : 70, color: "#fff", letterSpacing: -2, textShadow: "0 4px 16px rgba(0,0,0,0.7)", transform: `translateX(${(1 - k) * -40}px)` }}>{title}</div>
    </div>
  );
};
