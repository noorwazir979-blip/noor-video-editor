// BEST-TAKE REVEAL: "I recorded many takes, Claude kept the best one."
// The LIVE video shrinks into a card in a grid of real screenshots of the
// takes that were thrown away (scripts/takes.py), each bad one gets crossed
// out, the kept one is marked BEST, then it grows back to full screen. The
// card is the real video the whole time, so speech and movement never stop:
// the "picture" becomes the video at exactly the frame it is on.
//
// Usage in Reel.tsx (wrap the video layer; at/life in EDIT frames):
//   <TakeStage at={E(22.5)} life={life(22.5, 26.8)} shots={takesJson.shots}>
//     ...the zoom layer with the video...
//   </TakeStage>
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { AMBER, MONO, RED, SANS, bg, glow } from "./iron";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
type Shot = { src: string; t?: number };

// grid: 3 x 2 cards shaped like the video (9:16 on phones, 16:9 on YouTube),
// the kept take in the top middle
const GAP = 26;
const grid = (W: number, H: number) => {
  const s = W > H ? 0.26 : 0.25;
  const CW = W * s;
  const CH = H * s;
  const TOP = W > H ? (H - (2 * CH + GAP + 40)) / 2 : 240;
  const slot = (i: number) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const left = (W - (3 * CW + 2 * GAP)) / 2 + col * (CW + GAP);
    return { x: left + CW / 2, y: TOP + row * (CH + GAP + 40) + CH / 2 };
  };
  return { CW, CH, slot, s };
};
const BEST_SLOT = 1;

export const TakeStage: React.FC<{ at: number; life: number; shots: Shot[]; children: React.ReactNode; label?: string }> = ({ at, life, shots, children, label = "BEST TAKE" }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const { CW, CH, slot } = grid(W, H);
  const f = frame - at;
  if (f < 0 || f >= life) return <>{children}</>;

  const shrink = spring({ frame: f, fps, config: { damping: 18, stiffness: 120 } });
  const OUT = 16; // frames to grow back
  const grow = f >= life - OUT ? interpolate(f, [life - OUT, life], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) }) : 0;
  const k = shrink * (1 - grow); // 1 = in the grid, 0 = full screen
  const s = slot(BEST_SLOT);
  const sc = 1 - (1 - CW / W) * k;
  const tx = (s.x - W / 2) * k;
  const ty = (s.y - H / 2) * k;
  const bad = shots.slice(0, 5);
  const others = [0, 2, 3, 4, 5].slice(0, bad.length);
  const stampEvery = Math.max(4, Math.floor((life - OUT - 22) / Math.max(1, bad.length)));
  const bestOn = interpolate(f, [14 + stampEvery * bad.length, 20 + stampEvery * bad.length], [0, 1], clamp);

  return (
    <AbsoluteFill>
      {/* the stage behind: dark, with the thrown-away takes as screenshots */}
      <AbsoluteFill style={{ background: bg(0.96) }} />
      {bad.map((b, i) => {
        const p = slot(others[i]);
        const inK = spring({ frame: f - 3 - i * 2, fps, config: { damping: 16, stiffness: 140 } }) * (1 - grow);
        const stamp = interpolate(f, [12 + i * stampEvery, 16 + i * stampEvery], [0, 1], clamp);
        return (
          <div key={i} style={{ position: "absolute", left: p.x - CW / 2, top: p.y - CH / 2, width: CW, height: CH, opacity: inK * (1 - 0.45 * stamp), transform: `scale(${0.7 + 0.3 * inK}) translateY(${(1 - inK) * 60}px)`, borderRadius: 18, overflow: "hidden", border: `3px solid ${stamp > 0.5 ? RED : "rgba(255,255,255,0.5)"}`, filter: `grayscale(${0.8 * stamp})` }}>
            <Img src={staticFile(b.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 0", background: "rgba(0,0,0,0.6)", textAlign: "center", fontFamily: MONO, fontSize: 24, letterSpacing: 2, color: "#fff" }}>TAKE {i + (i >= BEST_SLOT ? 2 : 1)}</div>
            {stamp > 0 ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 900, fontSize: 170, color: RED, opacity: stamp, transform: `scale(${2 - stamp})`, textShadow: "0 4px 18px rgba(0,0,0,0.7)" }}>✕</div>
            ) : null}
          </div>
        );
      })}

      {/* the live video, shrunk into its card and grown back */}
      <AbsoluteFill style={{ transform: `translate(${tx}px, ${ty}px) scale(${sc})`, transformOrigin: "50% 50%", borderRadius: 18 / Math.max(sc, 0.25) * k, overflow: "hidden", boxShadow: k > 0.05 ? `0 0 0 ${10 / sc}px ${bestOn > 0 ? AMBER : "rgba(255,255,255,0.6)"}` : "none" }}>
        {children}
      </AbsoluteFill>
      {k > 0.05 ? (
        <div style={{ position: "absolute", left: s.x - CW / 2, top: s.y + CH / 2 + 10, width: CW, textAlign: "center", fontFamily: MONO, fontSize: 26, letterSpacing: 2, color: AMBER, opacity: bestOn * k, filter: glow(AMBER, 6) }}>{label} ✓</div>
      ) : null}
    </AbsoluteFill>
  );
};
