// IRON MAN MODE for noor-reel: a futuristic HUD look whose every graphic
// SHOWS what Noor is saying, at the moment he says it. Light on purpose:
// SVG + CSS 3D only (no WebGL, no three.js), so it renders on an 8 GB laptop.
//
// Data it can use (all optional):
//   face.json  (street.py)  -> FaceLock reticle follows the face
//   hands.json (hand.py)    -> PalmHolo / FingerBeam follow the hand
// Positions in those files are in source px (the video size): put face/hand-locked
// pieces INSIDE the zoom layer so they move with the picture.
import React from "react";
import { Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// ---- LOOK: the same pieces in two looks ----
// "clean" = every normal reel (white lines, Noor yellow accent, dark glass, soft shadow)
// "iron"  = Iron Man mode only when Noor says "ironman" (cyan HUD, amber, neon glow)
// Call setLook() once at the top of Reel.tsx, before anything renders.
type Pal = { c: [number, number, number]; a: [number, number, number]; bg: [number, number, number]; bgA: [number, number, number]; neon: boolean };
const LOOKS_FX: Record<"iron" | "clean", Pal> = {
  iron: { c: [98, 230, 255], a: [255, 181, 71], bg: [6, 30, 46], bgA: [50, 32, 4], neon: true },
  clean: { c: [255, 255, 255], a: [255, 225, 77], bg: [12, 12, 16], bgA: [40, 34, 6], neon: false },
};
let P: Pal = LOOKS_FX.iron;
const hex = (v: [number, number, number]) => "#" + v.map((x) => x.toString(16).padStart(2, "0")).join("");
export let LOOK_FX: "iron" | "clean" = "iron";
export let CYAN = hex(P.c);
export let CYAN_SOFT = `rgba(${P.c.join(",")},0.35)`;
export let AMBER = hex(P.a);
export const RED = "#FF5C5C";
export const ca = (o: number) => `rgba(${P.c.join(",")},${o})`;
export const aa = (o: number) => `rgba(${P.a.join(",")},${o})`;
export const bg = (o: number) => `rgba(${P.bg.join(",")},${o})`;
export const bgA = (o: number) => `rgba(${P.bgA.join(",")},${o})`;
export const setLook = (l: "iron" | "clean") => {
  LOOK_FX = l;
  P = LOOKS_FX[l];
  CYAN = hex(P.c);
  CYAN_SOFT = `rgba(${P.c.join(",")},0.35)`;
  AMBER = hex(P.a);
};
export const MONO = "'Geist Mono', ui-monospace, monospace";
export const SANS = "Geist, ui-sans-serif, system-ui, sans-serif";
// neon glow in iron; a soft drop shadow in clean (glow on white looks cheap)
export const glow = (c?: string, r = 10) => (P.neon ? `drop-shadow(0 0 ${r}px ${c ?? CYAN}) drop-shadow(0 0 ${r / 3}px ${c ?? CYAN})` : `drop-shadow(0 ${r / 3}px ${r * 0.8}px rgba(0,0,0,0.55))`);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// ---------------------------------------------------------------- tracking
// samples every `step` frames in ORIGINAL frames; null = not seen
type HandS = { palm: [number, number]; tip: [number, number]; size: number; g: string; score: number; lm: [number, number][] };
export type HandData = { fps: number; step: number; frames: number[]; hands: (HandS | null)[] };
export type FaceData = { frames: number[]; speaker: ([number, number, number, number] | null)[] };
export type Hand = { x: number; y: number; tx: number; ty: number; size: number; g: string; vis: number };

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const idxAt = (frames: number[], f: number) => {
  let lo = 0;
  let hi = frames.length - 1;
  if (f < frames[0]) return -1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (frames[m] <= f) lo = m;
    else hi = m - 1;
  }
  return lo;
};

// Hand at an ORIGINAL frame: interpolated between samples, a short gap
// (<= `hold` frames) bridged, `vis` fades 1 -> 0 after the hand is gone.
export const handAt = (d: HandData, of: number, hold = 8): Hand | null => {
  const i = idxAt(d.frames, of);
  if (i < 0) return null;
  // last seen sample at or before `of`
  let j = i;
  while (j >= 0 && !d.hands[j]) j--;
  if (j < 0) return null;
  const a = d.hands[j]!;
  const since = of - d.frames[j];
  // next seen sample after `of` (to interpolate)
  let k = i + 1;
  while (k < d.hands.length && !d.hands[k] && d.frames[k] - d.frames[j] <= hold) k++;
  const b = k < d.hands.length && d.hands[k] && d.frames[k] - d.frames[j] <= hold + d.step ? d.hands[k]! : null;
  const t = b ? Math.min(1, since / (d.frames[k] - d.frames[j])) : 0;
  const B = b ?? a;
  const vis = b ? 1 : interpolate(since, [hold * 0.5, hold], [1, 0], clamp);
  if (vis <= 0) return null;
  return {
    x: lerp(a.palm[0], B.palm[0], t),
    y: lerp(a.palm[1], B.palm[1], t),
    tx: lerp(a.tip[0], B.tip[0], t),
    ty: lerp(a.tip[1], B.tip[1], t),
    size: lerp(a.size, B.size, t),
    g: a.g,
    vis,
  };
};

// Last place the hand was seen before ORIGINAL frame `of` (within `max` frames):
// a hologram launched from the palm keeps floating there after the hand drops.
export const lastHand = (d: HandData, of: number, max = 90): Hand | null => {
  for (let f = of; f >= of - max; f -= 1) {
    const h = handAt(d, f, 4);
    if (h && h.vis > 0.9) return h;
  }
  return null;
};

export const faceAt = (d: FaceData, of: number) => {
  const i = idxAt(d.frames, of);
  if (i < 0) return null;
  const a = d.speaker[i];
  const b = d.speaker[Math.min(i + 1, d.speaker.length - 1)];
  if (!a) return null;
  const B = b ?? a;
  const t = d.frames[i + 1] ? Math.min(1, (of - d.frames[i]) / (d.frames[i + 1] - d.frames[i])) : 0;
  return { x: lerp(a[0], B[0], t), y: lerp(a[1], B[1], t), w: lerp(a[2], B[2], t), h: lerp(a[3], B[3], t) };
};

// ---------------------------------------------------------------- pieces
// open/close envelope for a piece of `life` frames (hologram unfold)
export const useOpen = (life: number, inF = 9, outF = 7) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, inF], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const c = interpolate(f, [life - outF, life], [1, 0], { ...clamp, easing: Easing.in(Easing.cubic) });
  // a 2-frame flicker as it switches on, like a projector catching
  const flick = f === 2 || f === 4 ? 0.45 : 1;
  return { f, k: Math.min(o, c), flick };
};

// Thin scan lines + a cool edge glow over the whole frame (cheap CSS)
export const HudTint: React.FC<{ strength?: number }> = ({ strength = 1 }) => (
  <>
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `repeating-linear-gradient(to bottom, ${ca(0.035)} 0px, ${ca(0.035)} 1px, transparent 2px, transparent 4px)`, opacity: strength }} />
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(0,40,70,0.38) 100%)", opacity: strength }} />
  </>
);

// HUD corner brackets + a top status line. Drawn in over `boot` frames,
// a scan line sweeps down once at the start; `off` = frame it powers down.
export const HudFrame: React.FC<{ boot?: number; off?: number; label?: string }> = ({ boot = 14, off = 1e9, label = "NOOR AI CONCIERGE" }) => {
  const f = useCurrentFrame();
  const draw = interpolate(f, [0, boot], [0.35, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const down = interpolate(f, [off, off + 12], [1, 0], clamp);
  const { width: W, height: H } = useVideoConfig();
  const scanY = interpolate(f, [0, 22], [-40, H + 40], clamp);
  const M = 46;
  const L = 120 * draw;
  const c = (x: number, y: number, sx: number, sy: number) => `M ${x} ${y + sy * L} L ${x} ${y} L ${x + sx * L} ${y}`;
  const blink = Math.floor(f / 15) % 2 === 0;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: down, transform: `scaleY(${interpolate(down, [0, 1], [0.01, 1])})` }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, filter: glow(CYAN, 6) }}>
        {[c(M, M, 1, 1), c(W - M, M, -1, 1), c(M, H - M, 1, -1), c(W - M, H - M, -1, -1)].map((d, i) => (
          <path key={i} d={d} stroke={CYAN} strokeWidth={4} fill="none" strokeLinecap="square" />
        ))}
      </svg>
      <div style={{ position: "absolute", top: M + 10, left: M + 34, right: M + 34, display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 24, letterSpacing: 3, color: CYAN, opacity: draw, textShadow: `0 0 8px ${CYAN}, 0 2px 4px #000` }}>
        <span>{label}</span>
        <span>
          <span style={{ color: RED, opacity: blink ? 1 : 0.25 }}>●</span> AI EDIT
        </span>
      </div>
      {f < 24 ? <div style={{ position: "absolute", left: 0, right: 0, top: scanY, height: 3, background: CYAN, boxShadow: `0 0 24px 6px ${CYAN_SOFT}` }} /> : null}
    </div>
  );
};

// Headline in HUD style (the cover). The highlight word in amber.
export const HoloHook: React.FC<{ life: number; text: string; highlight?: string; y?: number; size?: number; tag?: string }> = ({ life, text, highlight, y = 170, size = 92, tag }) => {
  const f = useCurrentFrame();
  const k = interpolate(f, [life - 8, life], [1, 0], clamp);
  const parts = highlight ? text.split(highlight) : [text];
  return (
    <div style={{ position: "absolute", top: y, left: 60, right: 60, textAlign: "center", opacity: k, transform: `scale(${0.96 + 0.04 * k})` }}>
      {tag ? <div style={{ fontFamily: MONO, fontSize: 26, letterSpacing: 6, color: CYAN, marginBottom: 14, textShadow: `0 0 10px ${CYAN}, 0 2px 4px #000` }}>{tag}</div> : null}
      <div style={{ display: "inline-block", padding: "18px 34px 24px", background: `linear-gradient(180deg, ${bg(0.78)}, ${bg(0.55)})`, border: `2px solid ${CYAN_SOFT}`, borderRadius: 6, boxShadow: `0 0 30px ${ca(0.25)}, inset 0 0 24px ${ca(0.12)}` }}>
        <span style={{ fontFamily: SANS, fontWeight: 800, fontSize: size, lineHeight: 1.05, letterSpacing: -2, color: "#fff", textShadow: `0 0 18px ${ca(0.55)}, 0 3px 6px #000` }}>
          {parts[0]}
          {highlight ? <span style={{ color: AMBER, textShadow: `0 0 18px ${aa(0.7)}, 0 3px 6px #000` }}>{highlight}</span> : null}
          {parts[1] ?? ""}
        </span>
      </div>
    </div>
  );
};

// Reticle that locks onto the face: shrinks onto it, two arcs counter-rotate,
// a tag types on to the right. Inside the zoom layer. `of` = ORIGINAL frame now.
export const FaceLock: React.FC<{ life: number; face: { x: number; y: number; w: number; h: number } | null; lines: string[] }> = ({ life, face, lines }) => {
  const { f, k } = useOpen(life, 10, 8);
  const { width: W } = useVideoConfig();
  if (!face) return null;
  const r0 = Math.max(face.w, face.h * 0.7) * 0.62;
  const r = r0 * interpolate(f, [0, 10], [1.7, 1], { ...clamp, easing: Easing.out(Easing.back(1.4)) });
  const rot = f * 2.2;
  const tagX = face.x + r + 44;
  const tagY = face.y - r * 0.7;
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: k }}>
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, filter: glow(CYAN, 6), overflow: "visible" }}>
        <g transform={`translate(${face.x} ${face.y})`}>
          <circle r={r} fill="none" stroke={CYAN} strokeWidth={2} strokeDasharray="6 10" opacity={0.6} />
          <g transform={`rotate(${rot})`}>
            <path d={arc(r + 14, 20, 110)} stroke={CYAN} strokeWidth={5} fill="none" />
            <path d={arc(r + 14, 200, 290)} stroke={CYAN} strokeWidth={5} fill="none" />
          </g>
          <g transform={`rotate(${-rot * 1.4})`}>
            <path d={arc(r + 30, 130, 170)} stroke={AMBER} strokeWidth={3} fill="none" />
            <path d={arc(r + 30, 310, 350)} stroke={AMBER} strokeWidth={3} fill="none" />
          </g>
          {[0, 90, 180, 270].map((a) => (
            <line key={a} x1={0} y1={-r - 4} x2={0} y2={-r + 16} stroke={CYAN} strokeWidth={4} transform={`rotate(${a})`} />
          ))}
          <line x1={r * 0.72} y1={-r * 0.72} x2={tagX - face.x - 6} y2={tagY - face.y + 22} stroke={CYAN} strokeWidth={2} />
        </g>
      </svg>
      <div style={{ position: "absolute", left: Math.min(tagX, W - 330), top: tagY, fontFamily: MONO, fontSize: 25, lineHeight: 1.5, color: CYAN, textShadow: `0 0 8px ${CYAN}, 0 2px 4px #000`, whiteSpace: "pre" }}>
        {lines.map((l, i) => (
          <div key={i} style={{ color: l.includes("0") && i === lines.length - 1 ? AMBER : CYAN }}>{typeOn(l, f - 4 - i * 5, 2.6)}</div>
        ))}
      </div>
    </div>
  );
};

const arc = (r: number, a0: number, a1: number) => {
  const p = (a: number) => [r * Math.cos((a * Math.PI) / 180), r * Math.sin((a * Math.PI) / 180)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1} ${y1}`;
};
export const typeOn = (s: string, f: number, cpf = 1.4) => (f <= 0 ? "" : s.slice(0, Math.floor(f * cpf)));

// Glass hologram panel: unfolds from a bright line, header strip in mono,
// notched corners. `from` = a point (source px) it flies out of (e.g. the palm).
export const HoloPanel: React.FC<{
  life: number;
  x?: number;
  y: number;
  w?: number;
  h: number;
  title: string;
  from?: { x: number; y: number } | null;
  accent?: string;
  children?: React.ReactNode;
}> = ({ life, x, y, w = 900, h, title, from, accent = CYAN, children }) => {
  const { fps } = useVideoConfig();
  const { f, k, flick } = useOpen(life, 10, 8);
  const { width: W } = useVideoConfig();
  const left = x ?? (W - w) / 2;
  const fly = from ? spring({ frame: f, fps, config: { damping: 18, stiffness: 120, mass: 0.9 } }) : 1;
  const tx = from ? (from.x - (left + w / 2)) * (1 - fly) : 0;
  const ty = from ? (from.y - (y + h / 2)) * (1 - fly) : 0;
  const sc = from ? 0.08 + 0.92 * fly : 1;
  const unfold = interpolate(f, [0, 9], [0.02, 1], { ...clamp, easing: Easing.out(Easing.cubic) });
  const n = 22;
  const clip = `polygon(${n}px 0, 100% 0, 100% calc(100% - ${n}px), calc(100% - ${n}px) 100%, 0 100%, 0 ${n}px)`;
  return (
    <div style={{ position: "absolute", left, top: y, width: w, height: h, opacity: k * flick, transform: `translate(${tx}px, ${ty}px) scale(${sc}) scaleY(${from ? 1 : unfold})`, transformOrigin: "50% 50%", filter: `drop-shadow(0 0 16px ${ca(0.35)})` }}>
      <div style={{ position: "absolute", inset: 0, clipPath: clip, background: `linear-gradient(160deg, ${bg(0.82)}, ${bg(0.72)})`, border: `2px solid ${accent}` }}>
        <div style={{ position: "absolute", inset: 0, background: `repeating-linear-gradient(to bottom, ${ca(0.06)} 0 1px, transparent 1px 5px)` }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 52, borderBottom: `1px solid ${CYAN_SOFT}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 30px", fontFamily: MONO, fontSize: 24, letterSpacing: 4, color: accent, textShadow: `0 0 8px ${accent}` }}>
          <span>{typeOn(title, f - 4, 2)}</span>
          <span style={{ opacity: Math.floor(f / 10) % 2 ? 1 : 0.3 }}>◆</span>
        </div>
        <div style={{ position: "absolute", left: 30, right: 30, top: 70, bottom: 22 }}>{children}</div>
      </div>
      <svg width={w} height={h} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <path d={`M 0 ${n + 40} L 0 ${n} L ${n} 0 L ${n + 60} 0`} stroke={accent} strokeWidth={5} fill="none" />
        <path d={`M ${w} ${h - n - 40} L ${w} ${h - n} L ${w - n} ${h} L ${w - n - 60} ${h}`} stroke={accent} strokeWidth={5} fill="none" />
      </svg>
    </div>
  );
};

// Segmented progress bar with a counting percentage.
export const HoloProgress: React.FC<{ start: number; end: number; label: string; color?: string }> = ({ start, end, label, color = CYAN }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [start, end], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const N = 24;
  return (
    <div style={{ fontFamily: MONO, color }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, letterSpacing: 3, marginBottom: 12, textShadow: `0 0 8px ${color}` }}>
        <span>{label}</span>
        <span>{Math.round(p * 100)}%</span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {Array.from({ length: N }, (_, i) => (
          <div key={i} style={{ flex: 1, height: 26, background: i / N < p ? color : `${ca(0.12)}`, boxShadow: i / N < p ? `0 0 10px ${color}` : "none" }} />
        ))}
      </div>
    </div>
  );
};

// A recording's waveform with bad parts marked in red, then cut out.
// marks: bar ranges + label + the frame (piece-relative) the mark appears.
// cutAt: frame the red parts collapse and the good parts close the gaps.
export const WaveCut: React.FC<{ width: number; height: number; bars?: number; marks: { a: number; b: number; label: string; at: number }[]; cutAt: number; playFrom?: number; playTo?: number }> = ({ width, height, bars = 64, marks, cutAt, playFrom = 0, playTo = 200 }) => {
  const f = useCurrentFrame();
  const amp = (i: number) => 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.43) + 0.3 * Math.sin(i * 5.1));
  const bad = (i: number) => marks.findIndex((m) => i >= m.a && i < m.b && f >= m.at);
  const cut = interpolate(f, [cutAt, cutAt + 14], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  // widths: bad bars shrink to 0 after the cut
  const ws = Array.from({ length: bars }, (_, i) => (bad(i) >= 0 ? 1 - cut : 1));
  const total = ws.reduce((s, v) => s + v, 0);
  const unit = width / total;
  let x = 0;
  const play = interpolate(f, [playFrom, playTo], [0, 1], clamp);
  return (
    <div style={{ position: "relative", width, height }}>
      <svg width={width} height={height} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        {ws.map((w, i) => {
          const bi = bad(i);
          const bx = x;
          x += w * unit;
          if (w < 0.02) return null;
          const hgt = amp(i) * height * 0.8 * (bi >= 0 ? 0.55 : 1);
          const col = bi >= 0 ? RED : CYAN;
          return <rect key={i} x={bx + unit * 0.18} y={(height - hgt) / 2} width={Math.max(1, w * unit * 0.64)} height={hgt} fill={col} opacity={bi >= 0 ? 0.9 : 0.85} style={{ filter: `drop-shadow(0 0 4px ${col})` }} />;
        })}
        {cut < 1 ? <line x1={play * width} x2={play * width} y1={-8} y2={height + 8} stroke="#fff" strokeWidth={3} style={{ filter: glow("#fff", 6) }} /> : null}
      </svg>
      {marks.map((m, i) => {
        if (f < m.at || cut > 0.6) return null;
        const pre = Array.from({ length: m.a }, (_, j) => ws[j]).reduce((s, v) => s + v, 0) * unit;
        const k = interpolate(f, [m.at, m.at + 6], [0, 1], clamp);
        return (
          <div key={i} style={{ position: "absolute", left: Math.min(pre, width - 220), top: i % 2 ? height + 10 : -54, fontFamily: MONO, fontSize: 26, letterSpacing: 2, color: RED, opacity: k * (1 - cut), transform: `translateY(${(1 - k) * 10}px)`, textShadow: `0 0 8px ${RED}, 0 2px 3px #000`, whiteSpace: "nowrap" }}>
            ✕ {m.label}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------- 3D (SVG projection)
// Wireframe solids projected with a simple perspective camera: no WebGL needed.
const PHI = (1 + Math.sqrt(5)) / 2;
const ICO_V: [number, number, number][] = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0],
  [0, -1, PHI], [0, 1, PHI], [0, -1, -PHI], [0, 1, -PHI],
  [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
];
const ICO_E: [number, number][] = (() => {
  const e: [number, number][] = [];
  for (let i = 0; i < 12; i++)
    for (let j = i + 1; j < 12; j++) {
      const d = Math.hypot(ICO_V[i][0] - ICO_V[j][0], ICO_V[i][1] - ICO_V[j][1], ICO_V[i][2] - ICO_V[j][2]);
      if (Math.abs(d - 2) < 0.01) e.push([i, j]);
    }
  return e;
})();
const project = (v: [number, number, number], ry: number, rx: number, s: number) => {
  const [x0, y0, z0] = v;
  const x1 = x0 * Math.cos(ry) + z0 * Math.sin(ry);
  const z1 = -x0 * Math.sin(ry) + z0 * Math.cos(ry);
  const y2 = y0 * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = y0 * Math.sin(rx) + z1 * Math.cos(rx);
  const p = 4 / (4 + z2);
  return { x: x1 * s * p, y: y2 * s * p, z: z2 };
};

// "AI core": spinning wireframe icosahedron with an inner pulse and orbit rings.
export const AICore: React.FC<{ size: number; spin?: number; color?: string; pulse?: number }> = ({ size, spin = 0.045, color = CYAN, pulse = 0 }) => {
  const f = useCurrentFrame();
  const ry = f * spin;
  const rx = 0.45 + Math.sin(f * 0.03) * 0.2;
  const s = size / 4;
  const pts = ICO_V.map((v) => project(v, ry, rx, s));
  const beat = 1 + 0.08 * Math.sin(f * 0.35) + pulse * 0.25;
  return (
    <svg width={size * 2} height={size * 2} viewBox={`${-size} ${-size} ${size * 2} ${size * 2}`} style={{ overflow: "visible", filter: glow(color, 8) }}>
      <ellipse rx={size * 0.95} ry={size * 0.28} fill="none" stroke={color} strokeWidth={2} opacity={0.5} transform={`rotate(${f * 1.5 % 360 * 0 + 12})`} strokeDasharray="10 8" strokeDashoffset={-f * 3} />
      <circle r={size * 0.22 * beat} fill={color} opacity={0.35 + pulse * 0.4} />
      <circle r={size * 0.1 * beat} fill="#fff" opacity={0.9} />
      {ICO_E.map(([i, j], n) => {
        const a = pts[i];
        const b = pts[j];
        const back = (a.z + b.z) / 2 > 0;
        return <line key={n} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={back ? 1.5 : 3} opacity={back ? 0.35 : 1} />;
      })}
      {pts.map((p, n) => (
        <circle key={`v${n}`} cx={p.x} cy={p.y} r={p.z > 0 ? 2.5 : 4.5} fill="#fff" opacity={p.z > 0 ? 0.4 : 1} />
      ))}
    </svg>
  );
};

// A light cone from the palm up to a hologram (inside the zoom layer).
export const PalmBeam: React.FC<{ x: number; y: number; topX?: number; topY: number; width: number; vis: number; color?: string }> = ({ x, y, topX, topY, width, vis, color = CYAN }) => (
  <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: vis * 0.8 }}>
    <defs>
      <linearGradient id="pb" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor={color} stopOpacity={0.55} />
        <stop offset="1" stopColor={color} stopOpacity={0} />
      </linearGradient>
    </defs>
    <polygon points={`${x - 26},${y} ${x + 26},${y} ${(topX ?? x) + width / 2},${topY} ${(topX ?? x) - width / 2},${topY}`} fill="url(#pb)" />
    <ellipse cx={x} cy={y} rx={46} ry={14} fill="none" stroke={color} strokeWidth={3} style={{ filter: glow(color, 6) }} />
  </svg>
);

// A beam between two points (fingertip -> card, core -> cut).
export const Beam: React.FC<{ x1: number; y1: number; x2: number; y2: number; k: number; color?: string; width?: number }> = ({ x1, y1, x2, y2, k, color = CYAN, width = 5 }) => {
  if (k <= 0) return null;
  const ex = x1 + (x2 - x1) * Math.min(1, k);
  const ey = y1 + (y2 - y1) * Math.min(1, k);
  return (
    <svg width="100%" height="100%" style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}>
      <line x1={x1} y1={y1} x2={ex} y2={ey} stroke={color} strokeWidth={width * 3} opacity={0.25} strokeLinecap="round" />
      <line x1={x1} y1={y1} x2={ex} y2={ey} stroke="#fff" strokeWidth={width} strokeLinecap="round" style={{ filter: glow(color, 10) }} />
      <circle cx={ex} cy={ey} r={width * 2.2} fill="#fff" style={{ filter: glow(color, 12) }} />
    </svg>
  );
};

// Take cards in a 3D stack (CSS perspective): a scan passes, then the best
// one comes forward in amber and the rest fall back. Frames are piece-relative.
export const TakeStack: React.FC<{ n: number; best: number; scanAt: number; pickAt: number; life: number; y: number }> = ({ n, best, scanAt, pickAt, life, y }) => {
  const { fps, width: W } = useVideoConfig();
  const { f, k } = useOpen(life, 10, 8);
  const pick = spring({ frame: f - pickAt, fps, config: { damping: 15, stiffness: 140 } });
  const scan = interpolate(f, [scanAt, scanAt + 24], [-0.1, 1.1], clamp);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, height: 430, perspective: 1400, opacity: k }}>
      <div style={{ position: "absolute", inset: 0, transformStyle: "preserve-3d", transform: `rotateX(14deg) rotateY(${-22 + 22 * pick}deg)` }}>
        {Array.from({ length: n }, (_, i) => {
          const appear = spring({ frame: f - 2 - i * 3, fps, config: { damping: 16, stiffness: 160 } });
          const isBest = i === best;
          const lit = scan > i / n && scan < (i + 1.4) / n;
          const z = (i - (n - 1) / 2) * -70;
          const xx = (i - (n - 1) / 2) * 92;
          const forward = isBest ? pick : 0;
          const dim = !isBest ? 1 - 0.75 * pick : 1;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: W / 2 - 170 + xx * (1 - forward),
                top: 40 + 50 * forward,
                width: 340,
                height: 200,
                transform: `translateZ(${z * (1 - forward) + 150 * forward}px) translateY(${(1 - appear) * 80 + (isBest ? 0 : 60 * pick)}px)`,
                opacity: appear * dim,
                background: isBest && pick > 0.2 ? `linear-gradient(160deg, ${bgA(0.9)}, ${bgA(0.85)})` : `linear-gradient(160deg, ${bg(0.85)}, ${bg(0.8)})`,
                border: `2px solid ${isBest && pick > 0.2 ? AMBER : lit ? "#fff" : CYAN}`,
                boxShadow: `0 0 ${lit || (isBest && pick > 0.2) ? 30 : 12}px ${isBest && pick > 0.2 ? `${aa(0.7)}` : `${ca(0.45)}`}`,
                fontFamily: MONO,
                color: isBest && pick > 0.2 ? AMBER : CYAN,
                padding: "16px 20px",
                boxSizing: "border-box",
              }}
            >
              <div style={{ fontSize: 26, letterSpacing: 3 }}>TAKE {String(i + 1).padStart(2, "0")}</div>
              <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 70, marginTop: 14 }}>
                {Array.from({ length: 22 }, (_, j) => (
                  <div key={j} style={{ flex: 1, height: 10 + 58 * Math.abs(Math.sin((j + 1) * (i + 2) * 0.7)), background: "currentColor", opacity: 0.8 }} />
                ))}
              </div>
              {isBest && pick > 0.2 ? <div style={{ position: "absolute", right: 16, top: 12, fontSize: 30, fontWeight: 700, color: AMBER, textShadow: `0 0 10px ${AMBER}` }}>BEST ✓</div> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Terminal line: the prompt typed word by word in sync with speech
// (words: [text, piece-relative frame]), then a status line.
export const CommandLine: React.FC<{ life: number; y: number; words: [string, number][]; runAt: number; run?: string }> = ({ life, y, words, runAt, run = "EXECUTING" }) => {
  const f = useCurrentFrame();
  const shown = words.filter(([, at]) => f >= at).map(([w]) => w).join(" ");
  const caret = Math.floor(f / 8) % 2 === 0;
  const dots = ".".repeat(1 + (Math.floor(Math.max(0, f - runAt) / 6) % 3));
  return (
    <HoloPanel life={life} y={y} h={250} title="COMMAND // CLAUDE">
      <div style={{ fontFamily: MONO, fontSize: 46, color: "#fff", textShadow: `0 0 12px ${CYAN}`, whiteSpace: "nowrap" }}>
        <span style={{ color: CYAN }}>&gt; </span>
        {shown}
        <span style={{ opacity: caret ? 1 : 0, color: CYAN }}>▌</span>
      </div>
      {f >= runAt ? (
        <div style={{ marginTop: 22, fontFamily: MONO, fontSize: 30, letterSpacing: 4, color: AMBER, textShadow: `0 0 10px ${AMBER}` }}>
          ▶ {run}
          {dots}
        </div>
      ) : null}
    </HoloPanel>
  );
};

// Big HUD readout: label + value (e.g. HUMAN EDITS: 0)
export const Readout: React.FC<{ life: number; y: number; label: string; value: string; from?: number; to?: number }> = ({ life, y, label, value, from, to }) => {
  const { f, k, flick } = useOpen(life, 8, 8);
  const num = from !== undefined && to !== undefined ? Math.round(interpolate(f, [4, 22], [from, to], { ...clamp, easing: Easing.out(Easing.cubic) })) : null;
  return (
    <div style={{ position: "absolute", top: y, left: 0, right: 0, textAlign: "center", opacity: k * flick }}>
      <div style={{ fontFamily: MONO, fontSize: 30, letterSpacing: 6, color: CYAN, textShadow: `0 0 10px ${CYAN}, 0 2px 4px #000` }}>{typeOn(label, f, 2)}</div>
      <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 150, lineHeight: 1.05, color: AMBER, textShadow: `0 0 24px ${aa(0.7)}, 0 4px 8px #000` }}>{num !== null ? `${num}${value}` : value}</div>
    </div>
  );
};
