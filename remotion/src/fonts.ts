import { continueRender, delayRender, staticFile } from "remotion";

const handle = delayRender("Loading Geist, Urdu and Pashto fonts");

const geist = new FontFace(
  "Geist",
  `url('${staticFile("fonts/geist-latin.woff2")}') format('woff2')`
);
const geistMono = new FontFace(
  "Geist Mono",
  `url('${staticFile("fonts/geist-mono-latin.woff2")}') format('woff2')`
);
// Geist has no Arabic-script glyphs, so Urdu text falls through the FONT
// stack to Noto Nastaliq Urdu. Only 400 and 700 exist; heavier weights
// (the captions ask for 800) are matched to 700.
const nastaliq = new FontFace(
  "Noto Nastaliq Urdu",
  `url('${staticFile("fonts/noto-nastaliq-urdu-400.woff2")}') format('woff2')`,
  { weight: "400" }
);
const nastaliqBold = new FontFace(
  "Noto Nastaliq Urdu",
  `url('${staticFile("fonts/noto-nastaliq-urdu-700.woff2")}') format('woff2')`,
  { weight: "700" }
);

// Pashto is set in Naskh, the style it is printed in; the caption and
// FONT_PS pick it when the transcript has Pashto-only letters.
const naskh = new FontFace(
  "Noto Naskh Arabic",
  `url('${staticFile("fonts/noto-naskh-arabic-400.woff2")}') format('woff2')`,
  { weight: "400" }
);
const naskhBold = new FontFace(
  "Noto Naskh Arabic",
  `url('${staticFile("fonts/noto-naskh-arabic-700.woff2")}') format('woff2')`,
  { weight: "700" }
);

Promise.all([geist.load(), geistMono.load(), nastaliq.load(), nastaliqBold.load(), naskh.load(), naskhBold.load()])
  .then((faces) => {
    faces.forEach((f) => document.fonts.add(f));
    continueRender(handle);
  })
  .catch((err) => {
    // Render with fallback fonts rather than hanging the render
    console.error("Font loading failed", err);
    continueRender(handle);
  });
