// IRON MAN MODE, round 2 pieces: globe, laptop, gauge, check rows, live
// transcript, flying chips, holo browser window, real code scroll, behind-word.
// Same rules as iron.tsx: SVG + CSS 3D only, every piece shows the spoken line.
import React from "react";
import { Easing, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { AMBER, CYAN, CYAN_SOFT, MONO, RED, SANS, aa, bg, bgA, ca, glow, useOpen } from "./iron";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const project = (v: [number, number, number], ry: number, rx: number, s: number) => {
  const [x0, y0, z0] = v;
  const x1 = x0 * Math.cos(ry) + z0 * Math.sin(ry);
  const z1 = -x0 * Math.sin(ry) + z0 * Math.cos(ry);
  const y2 = y0 * Math.cos(rx) - z1 * Math.sin(rx);
  const z2 = y0 * Math.sin(rx) + z1 * Math.cos(rx);
  const p = 4 / (4 + z2);
  return { x: x1 * s * p, y: y2 * s * p, z: z2 };
};

// Wireframe globe (lat/long rings projected): "searching the web".
// ping = frame a result is found (amber ping on the globe).
export const Globe: React.FC<{ size: number; spin?: number; color?: string; ping?: number }> = ({ size, spin = 0.03, color = CYAN, ping = -1 }) => {
  const f = useCurrentFrame();
  const ry = f * spin;
  const rx = 0.35;
  const sph = (latD: number, loD: number): [number, number, number] => {
    const a = (latD * Math.PI) / 180;
    const b = (loD * Math.PI) / 180;
    return [Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)];
  };
  const paths: string[] = [];
  const draw = (pts: { x: number; y: number; z: number }[]) => {
    let d = "";
    pts.forEach((p, j) => {
      const prevBack = j > 0 && pts[j - 1].z > 0.15;
      d += `${j === 0 || prevBack || p.z > 0.15 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)} `;
    });
    paths.push(d);
  };
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts = [];
    for (let lo = 0; lo <= 360; lo += 10) pts.push(project(sph(lat, lo), ry, rx, size * 0.92));
    draw(pts);
  }
  for (let lo = 0; lo < 180; lo += 30) {
    const pts = [];
    for (let la = 0; la <= 360; la += 10) pts.push(project(sph(la, lo), ry, rx, size * 0.92));
    draw(pts);
  }
  const pk = ping >= 0 ? interpolate(f - ping, [0, 24], [0, 1], clamp) : 0;
  return (
    <svg width={size * 2} height={size * 2} viewBox={`${-size} ${-size} ${size * 2} ${size * 2}`} style={{ overflow: "visible", filter: glow(color, 6) }}>
      <circle r={size * 0.8} fill={`${ca(0.07)}`} stroke={color} strokeWidth={2} opacity={0.5} />
      {paths.map((d, i) => (
        <path key={i} d={d} stroke={color} strokeWidth={2.2} fill="none" />
      ))}
      <ellipse rx={size * 1.05} ry={size * 0.22} fill="none" stroke={color} strokeWidth={2} strokeDasharray="8 10" strokeDashoffset={-f * 3} opacity={0.6} />
      {ping >= 0 && f >= ping ? (
        <>
          {pk < 1 ? <circle cx={size * 0.22} cy={-size * 0.18} r={8 + pk * size * 0.7} fill="none" stroke={AMBER} strokeWidth={4} opacity={1 - pk} /> : null}
          <circle cx={size * 0.22} cy={-size * 0.18} r={10} fill={AMBER} />
        </>
      ) : null}
    </svg>
  );
};

// Laptop in CSS 3D: the lid opens, screen shows children, slow turn.
export const Laptop: React.FC<{ life: number; y: number; children?: React.ReactNode }> = ({ life, y, children }) => {
  const { fps } = useVideoConfig();
  const { f, k } = useOpen(life, 10, 8);
  const W = useVideoConfig().width;
  const open = spring({ frame: f - 2, fps, config: { damping: 16, stiffness: 90 } });
  const turn = -16 + Math.sin(f * 0.03) * 6;
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, height: 480, perspective: 1600, opacity: k }}>
      <div style={{ position: "absolute", left: W / 2 - 300, top: 0, width: 600, height: 480, transformStyle: "preserve-3d", transform: `rotateX(10deg) rotateY(${turn}deg)` }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 600, height: 360, transformOrigin: "50% 100%", transform: `rotateX(${(1 - open) * -95}deg)`, border: `3px solid ${CYAN}`, borderRadius: 14, background: `linear-gradient(160deg, ${bg(0.92)}, ${bg(0.88)})`, boxShadow: `0 0 24px ${ca(0.45)}`, padding: 26, boxSizing: "border-box", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: `repeating-linear-gradient(to bottom, ${ca(0.06)} 0 1px, transparent 1px 5px)` }} />
          <div style={{ position: "relative" }}>{children}</div>
        </div>
        <div style={{ position: "absolute", left: -30, top: 356, width: 660, height: 110, transformOrigin: "50% 0%", transform: "rotateX(72deg)", border: `3px solid ${CYAN}`, borderRadius: 12, background: `repeating-linear-gradient(90deg, ${ca(0.2)} 0 34px, transparent 34px 40px), ${bg(0.85)}`, boxShadow: `0 0 20px ${ca(0.4)}` }} />
      </div>
    </div>
  );
};

// Ring gauge that fills to `value` % (a real, cited number only).
export const Gauge: React.FC<{ life: number; x: number; y: number; r: number; value: number; label: string; sub?: string }> = ({ life, x, y, r, value, label, sub }) => {
  const { f, k, flick } = useOpen(life, 8, 8);
  const p = interpolate(f, [4, 28], [0, value / 100], { ...clamp, easing: Easing.out(Easing.cubic) });
  const C = 2 * Math.PI * r;
  const S = (r + 34) * 2;
  return (
    <div style={{ position: "absolute", left: x - S / 2, top: y - S / 2, width: S, height: S, opacity: k * flick, transform: `scale(${0.85 + 0.15 * k})` }}>
      <svg width={S} height={S} viewBox={`${-S / 2} ${-S / 2} ${S} ${S}`} style={{ position: "absolute", inset: 0, filter: glow(CYAN, 8) }}>
        <circle r={r} fill={`${bg(0.7)}`} stroke={`${ca(0.22)}`} strokeWidth={24} />
        <circle r={r} fill="none" stroke={AMBER} strokeWidth={24} strokeDasharray={`${C * p} ${C}`} transform="rotate(-90)" />
        <circle r={r + 26} fill="none" stroke={CYAN} strokeWidth={2} strokeDasharray="4 12" transform={`rotate(${f * 1.2})`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: r * 0.6, color: "#fff", lineHeight: 1, textShadow: `0 0 18px ${aa(0.7)}, 0 3px 6px #000` }}>{Math.round(p * 100)}%</div>
        <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: 3, color: CYAN, marginTop: 12, textShadow: `0 0 8px ${CYAN}` }}>{label}</div>
        {sub ? <div style={{ fontFamily: MONO, fontSize: 17, letterSpacing: 1, color: CYAN, opacity: 0.8, marginTop: 6 }}>{sub}</div> : null}
      </div>
    </div>
  );
};

// Rows that land one by one with ✓ (cyan) or ✕ (red). at = piece-relative frame.
export const CheckRows: React.FC<{ rows: { text: string; at: number; ok: boolean }[]; size?: number }> = ({ rows, size = 40 }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((r, i) => {
        const k = interpolate(f, [r.at, r.at + 6], [0, 1], clamp);
        const c = r.ok ? CYAN : RED;
        return (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", opacity: k, transform: `translateX(${(1 - k) * -30}px)`, fontFamily: MONO, fontSize: size, color: "#fff", textShadow: `0 0 10px ${c}` }}>
            <span>{r.text}</span>
            <span style={{ color: c, fontWeight: 700, display: "inline-block", transform: `scale(${1 + (1 - k) * 0.8})` }}>{r.ok ? "✓" : "✕"}</span>
          </div>
        );
      })}
    </div>
  );
};

// Live transcript: the actual spoken words typing in as they are said.
export const Transcript: React.FC<{ words: [string, number][]; size?: number; highlight?: string[] }> = ({ words, size = 40, highlight = [] }) => {
  const f = useCurrentFrame();
  const shown = words.filter(([, at]) => f >= at);
  const caret = Math.floor(f / 8) % 2 === 0;
  return (
    <div style={{ fontFamily: MONO, fontSize: size, lineHeight: 1.35, color: "#fff", textShadow: `0 0 10px ${CYAN}` }}>
      {shown.map(([w], i) => (
        <span key={i} style={{ color: highlight.includes(w.toLowerCase().replace(/[.,]/g, "")) ? AMBER : "#fff" }}>{w} </span>
      ))}
      <span style={{ opacity: caret ? 1 : 0, color: CYAN }}>▌</span>
    </div>
  );
};

// A labelled chip that flies from a point (e.g. the pinch) to its place.
export const Chip: React.FC<{ at: number; from: { x: number; y: number }; to: { x: number; y: number }; text: string; color: string; w?: number }> = ({ at, from, to, text, color, w = 360 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (f < at) return null;
  const s = spring({ frame: f - at, fps, config: { damping: 15, stiffness: 120 } });
  const x = from.x + (to.x - from.x) * s;
  const y = from.y + (to.y - from.y) * s;
  return (
    <div style={{ position: "absolute", left: x - w / 2, top: y - 52, width: w, height: 104, transform: `scale(${0.2 + 0.8 * s})`, border: `3px solid ${color}`, background: `${bg(0.85)}`, boxShadow: `0 0 26px ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 800, fontSize: 54, color: "#fff", textShadow: `0 0 14px ${color}`, clipPath: "polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)" }}>
      {text}
    </div>
  );
};

// A website screenshot as a tilted holographic browser window; can shrink
// into a point (closeTo, at closeAt) like being pinched shut.
export const HoloWindow: React.FC<{ life: number; y: number; src: string; label: string; h?: number; focus?: string; closeTo?: { x: number; y: number } | null; closeAt?: number }> = ({ life, y, src, label, h = 560, focus = "50% 0%", closeTo, closeAt = 1e9 }) => {
  const { fps } = useVideoConfig();
  const { f, k, flick } = useOpen(life, 10, 6);
  const open = spring({ frame: f, fps, config: { damping: 16, stiffness: 110 } });
  const c = closeTo ? spring({ frame: f - closeAt, fps, config: { damping: 18, stiffness: 140 } }) : 0;
  const W = useVideoConfig().width;
  const tx = closeTo ? (closeTo.x - W / 2) * c : 0;
  const ty = closeTo ? (closeTo.y - (y + h / 2)) * c : 0;
  return (
    <div style={{ position: "absolute", left: (W - 900) / 2, top: y, width: 900, height: h, perspective: 1500, opacity: k * flick * (1 - 0.6 * c) }}>
      <div style={{ position: "absolute", inset: 0, transform: `translate(${tx}px, ${ty}px) scale(${1 - 0.93 * c}) rotateY(${(1 - open) * 50 - 8 * open}deg) rotateX(5deg)`, border: `3px solid ${CYAN}`, boxShadow: `0 0 30px ${ca(0.5)}`, background: "#041420", overflow: "hidden" }}>
        <div style={{ height: 50, display: "flex", alignItems: "center", gap: 12, padding: "0 20px", borderBottom: `2px solid ${CYAN_SOFT}`, fontFamily: MONO, fontSize: 24, color: CYAN }}>
          <span style={{ color: RED }}>●</span>
          <span style={{ color: AMBER }}>●</span>
          <span style={{ color: CYAN }}>●</span>
          <span style={{ marginLeft: 16, letterSpacing: 2 }}>{label}</span>
        </div>
        <Img src={src} style={{ width: "100%", height: h - 50, objectFit: "cover", objectPosition: focus, opacity: 0.93, filter: "saturate(0.75) contrast(1.05)" }} />
        <div style={{ position: "absolute", inset: 0, background: `repeating-linear-gradient(to bottom, ${ca(0.07)} 0 1px, transparent 1px 4px)` }} />
        <div style={{ position: "absolute", left: 0, right: 0, top: interpolate(f % 60, [0, 60], [50, h]), height: 3, background: CYAN, boxShadow: `0 0 18px 4px ${CYAN_SOFT}` }} />
      </div>
    </div>
  );
};

// Real code scrolling in a holo editor (the actual code that made this video).
export const CodeScroll: React.FC<{ code: string[]; speed?: number; size?: number; h: number }> = ({ code, speed = 1.2, size = 26, h }) => {
  const f = useCurrentFrame();
  const lh = size * 1.45;
  const off = (f * speed) % (code.length * lh);
  const kw = /(\bconst\b|\breturn\b|<\/?[A-Za-z]+|\/>)/g;
  return (
    <div style={{ position: "relative", height: h, overflow: "hidden", fontFamily: MONO, fontSize: size, lineHeight: `${lh}px`, whiteSpace: "pre" }}>
      <div style={{ transform: `translateY(${-off}px)` }}>
        {[...code, ...code].map((l, i) => (
          <div key={i} style={{ color: "#d6f6ff" }}>
            <span style={{ color: `${ca(0.45)}`, marginRight: 18 }}>{String((i % code.length) + 1).padStart(2, " ")}</span>
            {l.split(kw).map((p, j) => (j % 2 ? <span key={j} style={{ color: AMBER }}>{p}</span> : <span key={j}>{p}</span>))}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 36, background: `linear-gradient(${bg(1)}, ${bg(0)})` }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 36, background: `linear-gradient(${bg(0)}, ${bg(1)})` }} />
    </div>
  );
};

// Big hollow HUD word for BEHIND the speaker (the cut-out layer goes on top).
export const HoloBehind: React.FC<{ life: number; text: string; y: number; size?: number }> = ({ life, text, y, size = 260 }) => {
  const { f, k } = useOpen(life, 10, 8);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: y, textAlign: "center", opacity: k, transform: `scale(${0.9 + 0.1 * k})` }}>
      <span style={{ fontFamily: SANS, fontWeight: 900, fontSize: size, letterSpacing: -6, color: `${ca(0.14)}`, WebkitTextStroke: `4px ${CYAN}`, filter: glow(CYAN, 12) }}>{text}</span>
      <div style={{ position: "absolute", left: 80, right: 80, top: size * 0.6 + interpolate(f % 40, [0, 40], [-size * 0.4, size * 0.4]), height: 3, background: CYAN, opacity: 0.6 }} />
    </div>
  );
};

// File chip sending to a contact: the file flies along an arc into a phone-like card.
export const SendFile: React.FC<{ life: number; y: number; file: string; to: string; sendAt: number; attachAt?: number; extra?: string }> = ({ life, y, file, to, sendAt, attachAt, extra }) => {
  const { fps } = useVideoConfig();
  const { f, k, flick } = useOpen(life, 10, 8);
  const s = spring({ frame: f - sendAt, fps, config: { damping: 16, stiffness: 90 } });
  const att = attachAt !== undefined ? spring({ frame: f - attachAt, fps, config: { damping: 14, stiffness: 140 } }) : 0;
  const x0 = 210;
  const x1 = 760;
  const fx = x0 + (x1 - x0) * s;
  const fy = 150 - Math.sin(Math.PI * s) * 120;
  const sent = s > 0.95;
  return (
    <div style={{ position: "absolute", left: (useVideoConfig().width - 1080) / 2, width: 1080, top: y, height: 330, opacity: k * flick }}>
      <div style={{ position: "absolute", left: 90, top: 70, width: 240, height: 170, border: `2px solid ${CYAN}`, background: `${bg(0.8)}`, boxShadow: `0 0 18px ${CYAN_SOFT}`, fontFamily: MONO, fontSize: 24, color: CYAN, padding: 18, boxSizing: "border-box" }}>
        <div style={{ letterSpacing: 3 }}>YOU</div>
        <div style={{ color: "#fff", fontSize: 30, marginTop: 14 }}>this video</div>
      </div>
      <div style={{ position: "absolute", left: 640, top: 50, width: 350, height: 210, border: `2px solid ${sent ? AMBER : CYAN}`, background: `${bg(0.8)}`, boxShadow: `0 0 ${sent ? 30 : 18}px ${sent ? `${aa(0.6)}` : CYAN_SOFT}`, fontFamily: MONO, fontSize: 24, color: sent ? AMBER : CYAN, padding: 18, boxSizing: "border-box" }}>
        <div style={{ letterSpacing: 3 }}>{to}</div>
        <div style={{ color: "#fff", fontSize: 28, marginTop: 14 }}>{sent ? "received ✓" : "..."}</div>
        {extra && att > 0.05 ? (
          <div style={{ marginTop: 12, display: "inline-block", padding: "4px 12px", border: `2px solid ${AMBER}`, color: AMBER, fontSize: 24, transform: `scale(${att})`, transformOrigin: "0 50%" }}>📎 {extra}</div>
        ) : null}
      </div>
      <svg width={1080} height={330} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <path d={`M ${x0 + 120} 150 Q ${(x0 + x1) / 2} 0 ${x1 - 120} 150`} stroke={CYAN} strokeWidth={2} strokeDasharray="8 10" fill="none" opacity={0.6} strokeDashoffset={-f * 4} />
      </svg>
      {f >= sendAt && !sent ? (
        <div style={{ position: "absolute", left: fx - 110, top: fy - 34, width: 220, height: 68, border: `2px solid ${AMBER}`, background: `${bgA(0.9)}`, color: AMBER, fontFamily: MONO, fontSize: 24, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 24px ${aa(0.7)}` }}>▶ {file}</div>
      ) : null}
    </div>
  );
};
