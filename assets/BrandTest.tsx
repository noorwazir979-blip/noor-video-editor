import React from "react";
import { AbsoluteFill } from "remotion";
import { BrandIcon, BrandRow, BRANDS, BrandName } from "./brands";

// Contact sheet of every brand icon (check against the real apps before using).
export const BrandTest: React.FC = () => {
  const names = Object.keys(BRANDS) as BrandName[];
  return (
    <AbsoluteFill style={{ background: "linear-gradient(#3a3f47, #15171b)", padding: 60, display: "flex", flexWrap: "wrap", gap: 50, alignContent: "flex-start" }}>
      {names.map((n) => (
        <div key={n} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, width: 170, color: "#fff", fontFamily: "Geist", fontSize: 24 }}>
          <BrandIcon name={n} size={140} />
          {n}
        </div>
      ))}
      <div style={{ position: "relative", width: "100%", height: 260 }}>
        <BrandRow life={999} x={0} y={20} items={[{ name: "phone", at: 0 }, { name: "whatsapp", at: 0 }, { name: "email", at: 0 }, { name: "tiktok", at: 0 }, { name: "facebook", at: 0 }]} />
      </div>
    </AbsoluteFill>
  );
};
