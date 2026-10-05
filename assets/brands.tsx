// BRAND ICONS for noor-video-editor: real, current app logos in their official colours,
// drawn like the app icon people know from their phone. Use these for EVERY
// app/company logo (TikTok, Facebook, Instagram, WhatsApp, email, YouTube, ...).
// Never emojis and never the old one-colour icons/*.svg for brand logos (they
// often render black-on-black or odd).
// Glyphs: Simple Icons (CC0), updated from the latest release by scripts/update-brands.sh.
// Logos are trademarks of their owners: show them only when the app is named
// (nominative use), never as if the brand endorses the video.
import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BRAND_PATHS } from "./brand-paths";

type Look = { bg: string; glyph: string; ring?: string; tiktok?: boolean };
// bg = icon background, glyph = logo colour (official colours, Simple Icons hex data)
export const BRANDS: Record<string, Look> = {
  tiktok: { bg: "#000000", glyph: "#FFFFFF", tiktok: true },
  facebook: { bg: "#FFFFFF", glyph: "#0866FF" },
  instagram: { bg: "radial-gradient(circle at 30% 107%, #FDF497 0%, #FDF497 5%, #FD5949 45%, #D6249F 60%, #285AEB 90%)", glyph: "#FFFFFF" },
  whatsapp: { bg: "#25D366", glyph: "#FFFFFF" },
  gmail: { bg: "#FFFFFF", glyph: "#EA4335" },
  email: { bg: "#1A73E8", glyph: "#FFFFFF" },
  phone: { bg: "#34C759", glyph: "#FFFFFF" },
  youtube: { bg: "#FFFFFF", glyph: "#FF0000" },
  linkedin: { bg: "#FFFFFF", glyph: "#0A66C2" },
  x: { bg: "#000000", glyph: "#FFFFFF", ring: "rgba(255,255,255,0.25)" },
  telegram: { bg: "#FFFFFF", glyph: "#26A5E4" },
  snapchat: { bg: "#FFFC00", glyph: "#FFFFFF" },
  messenger: { bg: "#FFFFFF", glyph: "#0866FF" },
  googlemaps: { bg: "#FFFFFF", glyph: "#4285F4" },
  claude: { bg: "#D97757", glyph: "#FFFFFF" },
  googlegemini: { bg: "#FFFFFF", glyph: "#8E75B2" },
  openai: { bg: "#000000", glyph: "#FFFFFF", ring: "rgba(255,255,255,0.25)" },
};
export type BrandName = keyof typeof BRANDS;
export const BRAND_LABEL: Record<string, string> = {
  tiktok: "TikTok", facebook: "Facebook", instagram: "Instagram", whatsapp: "WhatsApp", gmail: "Gmail", email: "Email",
  phone: "Call", youtube: "YouTube", linkedin: "LinkedIn", x: "X", telegram: "Telegram", snapchat: "Snapchat",
  messenger: "Messenger", googlemaps: "Google Maps", claude: "Claude", googlegemini: "Gemini", openai: "ChatGPT",
};

const Glyph: React.FC<{ name: string; size: number; color: string; dx?: number; dy?: number }> = ({ name, size, color, dx = 0, dy = 0 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} style={{ position: "absolute", left: dx, top: dy, overflow: "visible" }}>
    <path d={BRAND_PATHS[name]} fill={color} />
  </svg>
);

// One app icon (rounded square), like on a phone home screen.
export const BrandIcon: React.FC<{ name: BrandName; size?: number }> = ({ name, size = 140 }) => {
  const b = BRANDS[name];
  const g = Math.round(size * (name === "snapchat" ? 0.62 : 0.58));
  const off = (size - g) / 2;
  const t = Math.max(2, Math.round(size * 0.025)); // TikTok's cyan/red offset
  return (
    <div style={{ position: "relative", width: size, height: size, borderRadius: size * 0.23, background: b.bg, boxShadow: `0 ${size * 0.06}px ${size * 0.18}px rgba(0,0,0,0.45)${b.ring ? `, inset 0 0 0 2px ${b.ring}` : ""}`, overflow: "hidden", flexShrink: 0 }}>
      <div style={{ position: "absolute", left: off, top: off, width: g, height: g, filter: name === "snapchat" ? "drop-shadow(0 0 1.5px #000) drop-shadow(0 0 1px #000)" : undefined }}>
        {b.tiktok ? (
          <>
            <Glyph name={name} size={g} color="#25F4EE" dx={-t} dy={-t} />
            <Glyph name={name} size={g} color="#FE2C55" dx={t} dy={t} />
          </>
        ) : null}
        <Glyph name={name} size={g} color={b.glyph} />
      </div>
    </div>
  );
};

// A row of app icons that pop in one by one on the spoken word (frames relative
// to the row's <Sequence>), each with its name under it. Replaces LogoRow for brands.
export const BrandRow: React.FC<{ life: number; x: number; y: number; items: { name: BrandName; at: number; label?: string }[]; size?: number; gap?: number; labelColor?: string }> = ({ life, x, y, items, size = 130, gap = 34, labelColor = "#fff" }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const out = Math.min(1, Math.max(0, (life - f) / 7));
  return (
    <div style={{ position: "absolute", left: x, top: y, display: "flex", gap, opacity: out }}>
      {items.map((it, i) => {
        const s = spring({ frame: f - it.at, fps, config: { damping: 11, stiffness: 190, mass: 0.6 } });
        return (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, opacity: f >= it.at ? 1 : 0, transform: `scale(${0.4 + 0.6 * s}) translateY(${(1 - s) * 30}px)` }}>
            <BrandIcon name={it.name} size={size} />
            <div style={{ fontFamily: "Geist, 'Noto Nastaliq Urdu', sans-serif", fontWeight: 800, fontSize: Math.round(size * 0.24), color: labelColor, textShadow: "0 2px 8px rgba(0,0,0,0.8)", whiteSpace: "nowrap" }}>{it.label ?? BRAND_LABEL[it.name]}</div>
          </div>
        );
      })}
    </div>
  );
};

// A single big app icon in the reaction slot (replaces BigLogo for brands).
export const BigBrand: React.FC<{ life: number; name: BrandName; x: number; y: number; size?: number }> = ({ life, name, x, y, size = 220 }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 10, stiffness: 170, mass: 0.7 } });
  const out = Math.min(1, Math.max(0, (life - f) / 6));
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: out, transform: `scale(${0.3 + 0.7 * s}) rotate(${(1 - s) * -12}deg)` }}>
      <BrandIcon name={name} size={size} />
    </div>
  );
};
