---
name: noor-video-editor
description: Noor Video Editor: turns a phone recording of you talking to camera (English, Urdu, Roman Urdu, Pashto, one take or many retakes) into a finished vertical reel for TikTok/Instagram/Shorts, or a 16:9 long-form YouTube video - AI voice cleanup, best take of each sentence, every pause over 0.3 s cut, a hook headline that doubles as the cover, bold word-by-word captions (Urdu script, Roman Urdu or English) with an English or Arabic subtitle line, zoom snaps, emojis and callouts on the spoken word, website/news cutaways, teaching graphics, hand-tracked holograms, ducked music and sound design, heavy vs calm and hook A/B versions, a results log, a retention check before rendering, street mode for outdoor/walking videos, and an Iron Man HUD look (code word "ironman"). Runs on low-RAM laptops (no PyTorch). Use for ANY video edit ("edit this", "make a reel", "edit my YouTube video", "use noor-video-editor").
---

# Noor Video Editor (noor-video-editor)

By Noor Zaman (Abu Dhabi). Built on talking-head-reel (MIT) by mariagorskikh.

This is talking-head-reel with upgrades from research on the best-performing
short-form edits (Oct 2026). Everything in the original instructions further
down still applies; this section changes the order and adds steps. The
original instructions are kept at the end of this file.

## Why (the numbers the upgrades chase)

Updated Oct 2026 from research on short-form scripts and edits.

- Meta: people spend ~1.7 s per feed item and recall content after 0.25 s.
  YouTube Shorts' key number is viewed-vs-swiped (good: 70 %+). So: a hook
  headline on frame 0 that matches the first spoken line, something moving
  in the first 1.5 s.
- Instagram's top 3 signals (Mosseri): watch time, likes per reach, sends per
  reach; sends matter most for reaching new people. So: end on the payoff
  (rewatches), and the end card asks for a SEND, not a follow.
- Clean, loud voice matters more than pretty video. So: `clean-audio.sh`.
- Polish is cheap now (Mosseri); lo-fi ads beat the average on likeability.
  No data says heavy zooms/emojis build trust with 35-55 year old owners. So:
  two styles, `heavy` and `calm`, and an A/B test instead of a guess.
- Length: 30-45 s for one idea, 60-90 s for a story; longer goes to YouTube.
- Quality jump cuts beat flashy glitch effects (Varun Mayya). No glitches.

## Round 4: fit the strategy (A/B variants, Arabic line, send close, log)

**Variants from one project.** Reel.tsx reads Remotion input props, so the
same project renders several versions without copying anything:
- `style`: `heavy` (default: mid-take zoom snaps every ~2.4 s, emojis, tap and
  boom sounds, hand `<Hit>` sounds) or `calm` (snaps only at cuts, no emojis,
  no hits except `<Hit ... keep />`; captions, cutaways, headline cards, logos
  and numbers stay). Calm is the trust look for owners.
- `hook`: `A` = `HOOK_A`, `B` = `HOOK_B` (a second headline and cover).
- `line`: `english` (default), `arabic` or `none` = the second caption line.
- `S/scripts/variants.sh heavy-A calm-A` renders `out/talk-reel-heavy-A.mp4`
  and `out/talk-reel-calm-A.mp4` one after another, detached and RAM-aware.
  Hook test: `variants.sh heavy-A heavy-B` (fill `HOOK_B` first). A UAE-owner
  cut: `variants.sh calm-A-arabic`.
- Default for every new reel until the log says otherwise: render BOTH
  `heavy-A` and `calm-A`; the creator posts one normally and the other as an
  Instagram Trial Reel (non-followers only), or both as Trial Reels. After 3
  pairs, `log.py review` decides which style stays the default.
- `check.py ... --style calm` checks the calm version (5 s still stretches
  allowed instead of 3; the cuts carry it).

**Three-layer hook.** `HOOK_A.text` must say the same thing as the first
spoken line and the first shot (what they see, read, hear). `check.py` prints
a note when the headline and the first ~10 spoken words share no word, and
that usually means the take starts with a greeting: cut "Hi / salaam" before
the hook, or start on the take where they say the hook line first.

**End on the payoff.** `segments.outro` 1-1.5 s, or 0 for no end card at all
(a hard stop on the payoff line gets rewatches). `OUTRO.cta` is ONE action:
the send line by default ("Send this to a friend who runs a shop", Roman Urdu
"Yeh video us dost ko bhejein jiski apni dukaan hai"), a follow WITH a reason,
or "Comment CHECKUP". `check.py` notes a long end card or a cta with none of
these. Use the line from the script's close; never "Follow for more".

**Arabic second line (UAE owners).** Write `arabic.json` like `english.json`
(`[[first_index, last_index, "simple Modern Standard Arabic"], ...]`, `*word*`
= yellow), then `subs.py src/talk/reel-words.json --arabic arabic.json` (with
`--roman`/`--english` as usual). It is drawn right to left in Noto Naskh
Arabic. Keep the Arabic short and plain; the creator cannot check it, so translate
carefully and tell them it is machine-written. Not for every reel: buyer reels
aimed at UAE owners.

**Music and conservative viewers.** `MUSIC_UNDER` is -28 dB (a bed, never a
song). `MUSIC = false` for the Pashto series and anything aimed at Afghanistan
or very conservative viewers, and when the creator adds a trending sound in the app.

**App and brand logos.** Every time a video shows TikTok, Facebook, Instagram,
WhatsApp, email, a phone call, YouTube, LinkedIn, X, Telegram, Snapchat, Messenger,
Google Maps, Claude, Gemini or ChatGPT, use `assets/brands.tsx` (copy it with
`brand-paths.ts` into src/talk/): `<BrandRow items={[{ name: "whatsapp", at }, ...]} />`
for a row on the spoken words, `<BigBrand name="tiktok" />` for one big icon,
`<BrandIcon />` inside any card. They draw the CURRENT logo (Simple Icons, latest
release) in the official colours, shaped like the phone app icon. Never emojis, text
letters ("f") or one-colour `public/icons/*.svg` for a brand: those render black-on-black
or odd. Before a new video: `python3 S/scripts/update-brands.py` refreshes the logos;
`assets/BrandTest.tsx` renders all of them on one sheet: look at it if a brand changed.
Show a logo only when that app is named (nominative use, no implied endorsement).

**Memes.** Imgflip memes read as a meme page, not as a business owner's
advisor. No memes in buyer reels (series 1, 2, 5, 7, 8); fan reels (tiny
tutorials, experiments) at most two.

**Consent (UAE law: up to AED 500,000 and jail for posting someone's image
without consent).** Never show another person's face, voice, WhatsApp
name/number or a shop name/sign without their written OK. Blur or crop them
in cutaways and screen recordings; in "11 pm test" reels show totals only, no
business names. Demo screens use the creator's own test numbers.

**Results log.** After delivering, add the reel to the log, and fill the
numbers 48 h after posting:
```
L S/scripts/log.py add --video <file> --script <social/scripts/x.md> --series <1-11> --hook <type> --lang en|roman|urdu|ps --style heavy|calm --hookv A|B --line english|arabic|none --length <s>
L S/scripts/log.py set <id> views=... watched=... vvs=... sends=... saves=... follows=... owner_dms=... checkups=...
L S/scripts/log.py review     # monthly: keep the top 2 series, drop the bottom 2, judge by owner_dms first
```
The log is `social/scripts/log.csv` (works from Windows with `uv run` too).

## Pipeline (run from the Remotion project root; S = this skill's dir)

```
# once per machine: bash S/scripts/setup-lite.sh   (light toolset, ~0.5 GB, no PyTorch)
# L = S/scripts/lpy  (runs a script with the light toolset)
S/scripts/prep.sh <video> public/talk                     # portrait 1080x1920 30 fps
L S/scripts/make_sfx2.py public                            # sounds + music bed, once per project
L S/scripts/street.py --analyze                          # EVERY recording: studio or street? (~30 s; see Street mode)
S/scripts/clean-audio.sh [public/talk/ig1080.mp4 street]  # voice cleanup + -16 LUFS (keeps ig1080.raw.mp4)
L S/scripts/transcribe_lite.py public/talk/ig1080.mp4 --out scratch/words_all.json --language ur|en|ps
  -> fix misheard words by start time (copy scripts/fixwords.example.py) -> scratch/words_fixed.whisper.json
  -> write src/talk/reel-segments.json by hand (best take per sentence)
L S/scripts/street.py                                     # street videos only: steady + blur strangers (the chosen takes)
L S/scripts/tighten.py src/talk/reel-segments.json public/talk/voice-clean.wav [--street]   # cut pauses > 0.3 s
python3 S/scripts/cut.py scratch/words_fixed.whisper.json src/talk/reel-segments.json --words-out src/talk/reel-words.json
python3 S/scripts/subs.py src/talk/reel-words.json --list   -> write roman.txt + english.json, then
python3 S/scripts/subs.py src/talk/reel-words.json --roman roman.txt --english english.json [--arabic arabic.json] --placeholders
   (English recording: only --placeholders)
cp S/assets/noor-overlays.tsx src/talk/ ; cp S/assets/Reel.noor.tsx src/talk/Reel.tsx
  -> fill FRAMING, LOOK, HOOK_A (+ HOOK_B), OUTRO (send line), CAPTIONS, MUSIC, beats, BEHIND/BACKDROPS
L S/scripts/matte.py --ranges "A-B,C-D"                    # only if BEHIND/BACKDROPS are used
python3 S/scripts/check.py src/talk/Reel.tsx src/talk/reel-segments.json [--style calm]   # must pass; read the notes
S/scripts/stills.sh TalkReel src/talk/reel-segments.json <secs>            # always include frame 0 (the cover)
S/scripts/variants.sh heavy-A calm-A                     # the A/B pair (Round 4); or render-lite.sh for one version
  -> copy to the user's Desktop (or the folder they name) + 720p preview, then log.py add (Round 4)
S/scripts/version.sh <project> short <short-hand.json>     # optional 20-30 s reach version, then render it
```

Light toolset in `~/.local/share/reel-lite/` (onnxruntime, numpy, faster-whisper;
models: Silero VAD ONNX, RVM ONNX; `bin/deep-filter`). Peak RAM per step is
~1.1-1.8 GB, so it runs on an 8 GB laptop or a 4 GB WSL. The old PyTorch
scripts (transcribe.py with openai-whisper, ~/.local/share/reel-tools) still
work but are not needed. Emoji font: any colour emoji font in fontconfig
(here `~/.local/share/fonts/seguiemj.ttf`; Segoe has NO flag emojis, avoid flags).

## The new pieces

**clean-audio.sh [src] [strength_db=30]** keeps the original as
`ig1080.raw.mp4`, writes `public/talk/voice-clean.wav`. 30 dB keeps a little
room tone; use 50-100 for loud traffic/AC. Re-running starts from the raw file.

**tighten.py** splits each hand-chosen take at every pause longer than
`--max-gap` (0.3 s) using Silero VAD (an ffmpeg dB threshold fails on outdoor
recordings: the noise floor sits within 5 dB of the voice). Keeps the hand cut
as `reel-segments.hand.json` and always re-reads it, so it can be re-run with
other settings. `--keep 40.1-41.0` protects a dramatic pause.

**Misheard words.** Whisper's Urdu is rough (it wrote "time invest" for
"typing center", "سوچھو" for both "social" and "socha"). Do not use global
`--fix` for words that appear with two meanings: copy the whisper json to
`scratch/words_fixed.whisper.json` and correct words BY START TIME
(`{start_time: "new word"}`, `None` deletes; start from `scripts/fixwords.example.py`). Read the whole transcript against
what the speaker obviously meant; English loanwords stay in Urdu script in Urdu
captions (they are converted in the Roman captions).

**Captions (noor-overlays.tsx).** `CAPTIONS` in Reel.tsx: `"urdu"` (Nastaliq
script), `"roman"` (Roman Urdu, default for Urdu speech: more viewers read it)
or `"english"`. The second line under the main captions is the English
sentence by default (render prop `line`: `english`, `arabic` or `none`; see
Round 4). `BoldCaptions`: no pill, heavy words with a black outline, the spoken
word yellow and popping; Latin 2 words per group (3 for Roman Urdu, lowercase),
Urdu 3. Write roman.txt the way Pakistanis text (main, nahi, toh, kyun, hai,
mauqa), loanwords in English spelling (business, invoice, WhatsApp, AI), `_`
merges a word into the previous one ("اے" "آئی" -> `AI _`), `~` is a space
inside one token (`de~ke`). English lines: natural sentences, not word for word.

**Hook (`HookTitle`).** On screen from frame 0, so frame 0 is the cover: big
white card, one highlighted word in yellow, optional sub line; slides out with a
whoosh at `HOOK.until`. Max ~5 words. It should make a promise or a surprise
("Video #1", "AED 20 for ONE invoice?", "America copied Abu Dhabi").

**Zoom snaps** are automatic: at every cut (>= 0.7 s apart) and on the next
word start whenever 2.4 s pass inside a piece, alternating 1.0/1.1. Add
`PUSHES` (slow push-ins) by hand on the 3-5 lines that matter.

**Beats.** One reaction (emoji/logo) at a time in the slot next to the head,
one card at a time in the card band, on the spoken word. A beat that lands in a
pause tighten.py removed moves to the next piece automatically.

**ProgressBar** along the top edge fills over the speech.

**check.py** lists every visual change in edit seconds and fails (exit 1) on:
no hook, nothing in the first 1.5 s, any still stretch > 3 s, length outside
15-60 s (the length flag is advice; the others must be fixed).

## Round 2: show it, and sound like a finished video

Run once per project: `S/scripts/make_sfx2.py public` (adds riser, boom,
swoosh, cash, shutter, typing, notify to `public/sfx/` and a 60 s ambient bed
`public/music/bed-soft.wav`; synthesized, nothing to license).

**Cutaways: show what is being talked about.** When the speaker names a
website, an app, a news story, a place or a screen, put it on screen.
- Website: `S/scripts/shot.sh <url> public/cut/<name>.png phone` (Remotion's
  headless Chrome, iPhone-sized). LOOK at the PNG: cookie banners, login
  walls and pop-ups happen; pick another page or `focus` past them.
- The creator's own phone screen recordings (WhatsApp, TAMM app, ChatGPT): copy the
  .mp4 into `public/cut/` and use `<Cutaway video start={s} />`.
- The creator's face is the asset ("you on camera is the asset"), so
  `<Cutaway mode="card" w={760}>` is the default: a tilted card above or
  beside the head while the face stays visible (pick `y` from the framing).
  Hide the face only for a real demo screen that IS the proof, and then
  1.5-2.5 s at most; check.py notes a longer one.
- `<Cutaway mode="top">` covers the top of the frame (and the face) in a
  white-bordered rounded box with a slow push: keep it 1.5-2.5 s, the voice
  carries on. `mode="full"` for a 1-2 s full-screen interrupt, `mode="card"`
  for a smaller tilted card. `label` = the source ("tamm.abudhabi").
- News: `<HeadlineCard source date headline highlight>`: the EXACT real
  headline and the real outlet name and date, never the outlet's logo or a
  copy of its page design. Pair with a shot.sh screenshot of the article
  when it is useful.
- No stock footage yet (needs a Pexels API key; ask the user before signing up).

**Sound design.** Every visual change gets a sound, quietly: `tap` on snaps
(automatic), `pop` on emojis (automatic), `swoosh` on cutaways (automatic),
`shutter` on headline cards (automatic), plus by hand: `riser` ending ON a
reveal (start ~1.1 s before), `cash` on money/AED, `boom` on the hook drop
(automatic) and the big claim, `notify` on WhatsApp/message moments,
`typing` under a prompt. Keep sfx at 0.2-0.45 volume; the voice is king.

**Music.** `MUSIC` in Reel.tsx: `"music/bed-soft.wav"` (default) or any
licensed track the creator drops in `public/music/`; `MusicBed` ducks it to -26 dB
under speech and -17 dB in pauses, with fades. Set `MUSIC = false` when the creator
will add a trending Instagram sound inside the app (more reach); tell them to
set it to ~10 % volume there.

## Round 3: cut-outs, looks, versions

**Text behind the head (`BEHIND`) and background swaps (`BACKDROPS`).** Both
need the speaker cut out: `L S/scripts/matte.py --ranges "A-B,C-D"` covering
every window (ORIGINAL seconds, a little wider than the windows). It writes
one small `public/talk/fg_<frame>.webm` per moment plus `src/talk/fg.json`;
the template draws the cut-out on top only during the windows, so the render
pays only for those frames. `--method ai` (default, Robust Video Matting ONNX,
no cloth needed, ~6 s of compute per 1 s of video) or `--method green` when
the creator filmed in front of a green cloth (seconds, cleanest edges).
- BEHIND: 1-3 huge words ("NOT\nREADY", highlight a line in yellow), 1.5-3 s,
  on the line that matters most; one or two per reel. Position `y` so the
  bottom line tucks behind the top of the head.
- BACKDROPS: swap the wall for a screenshot (shot.sh), a skyline photo or a
  clip for 2-3 s while they talk about it. Image `focus` picks the visible part.
- Green screen tips for the creator: evenly lit cloth, no wrinkles, sit ~1 m in
  front of it, no green clothes.

**LOOK** (`natural` default, `punchy` for flat outdoor footage, `warm` for
evening/indoor, `none`) and `VIGNETTE` (0.22, 0 = off) in the template: CSS
filters on the speaker layer, no extra processing.

**Versions.** One recording, two posts: the full reel (30-80 s, to teach) and a
20-30 s reach cut (hook + the strongest 2-3 sentences + the offer). Write the
short version's takes (ORIGINAL seconds) to a json and run
`S/scripts/version.sh <project> short short.json`: it shares node_modules
and public/ by symlink, re-tightens, re-cuts, rebuilds the Roman/English
subtitles from the full version's `reel-subs.master.json`, and checks. Beats
outside the short cut switch themselves off; beats running past the end of a
kept take end with it. Check `HOOK.until` lands in the first take, render.

**Light mode is the default** (made for people with low-RAM PCs): faster-whisper int8 instead of openai-whisper, Silero and
RVM as ONNX, ffmpeg pipes instead of OpenCV, render-lite.sh picks the number of
browser tabs from free RAM. Do not add PyTorch, OpenCV or MediaPipe back; if
something new needs a model, look for an ONNX version first.

## Effects kit (EVERY reel, not only Iron Man)

The hand tracking, 3D, animation and graphics built for Iron
Man mode are for ALL videos; every reel gets the best edit. Iron Man is
only a LOOK, used when they say "ironman". The kit is `assets/iron.tsx` +
`assets/iron2.tsx` (+ `assets/takes.tsx`); (+ `assets/teach.tsx`) copy them into src/talk/ for every
reel and put `setLook("clean")` (normal reels) or `setLook("iron")` at the top
of Reel.tsx. clean = white lines, yellow accent, dark glass, soft shadow,
no HUD frame/scan lines/face reticle, normal sound kit; iron = cyan HUD, neon,
film sounds (make_sfx_iron.py) and the drone bed.

Use pieces when they SHOW the line (rule zero below): hand.py on every
recording with the free hand in shot; HoloPanel/CheckRows/Transcript/Gauge/
Globe/Laptop/Chip/HoloWindow/CodeScroll/TakeStack/WaveCut/SendFile/AICore.

### Best-take reveal (whenever the creator says they recorded many takes and Claude kept the best)
`L S/scripts/takes.py` grabs real screenshots from the parts of the recording
that were left out (public/takes/, src/talk/takes.json). Wrap the video layer:
`<TakeStage at={E(from)} life={life(from, to)} shots={takesJson.shots}>...zoom layer...</TakeStage>`
from = the line "I recorded a long video / many takes", to = ~1 s after "best".
The LIVE video shrinks into the top-middle card among the bad takes, each bad
one is crossed out, the kept one turns yellow "BEST TAKE ✓" on the word best,
then it grows back to full screen. The card is the real video the whole time,
so speech never pauses and the picture becomes the video at the exact frame.
Remove any emoji in that window.

### Teaching pack (assets/teach.tsx) for educational videos (TikTok / YouTube personal track)
Pick the graphic
by the KIND of idea; build it in steps on the words (`at` = frame of the word inside the piece);
one piece at a time; <= 6 words per item; yellow = key thing, red = wrong; give the full answer.
- `FlowSteps` steps/process (boxes + arrows draw in on each word, snake layout, newest = yellow)
- `SplitCompare` before/after, wrong/right (left first, divider sweeps, right lands at revealAt)
- `NextWord` how a chatbot writes (word chips, guess bars, winner flies in; always labelled "example numbers")
- `NeuralNet` layers light up one by one (input label -> output label)
- `TermCard` a new word + one-line meaning typing in
- `ScreenZoom` screen recording (mp4) or screenshot: camera moves to each region, yellow box, click ring, label (regions in source px)
- `SaveCard` end card: SAVE THIS + 3 points (+ handle)
- `ChapterCard` "PART 2 · title" lower third for long videos
All take optional x/y/w/h; by default `useBand` puts them above the head on 9:16 and on the right half on 16:9.
Preview any piece by adding a short composition that renders it at 9:16 or 16:9.

### Long form (YouTube 16:9)
`assets/LongForm.example.tsx`: 1920x1080 from a landscape recording; the creator on the left third, teaching
pieces on the right half; CHAPTERS of 1-3 min each opened by ChapterCard (copy the times into the YouTube
description); one slow push per chapter, no snaps/emoji pops; one clean English line at the bottom; SaveCard
at the end. The whole kit (iron.tsx, iron2.tsx, takes.tsx, teach.tsx) sizes itself to the composition.

## Iron Man mode (code word "ironman")

When the creator says **ironman** (or "edit it Iron Man style / futuristic"), the reel
gets a HUD look where every graphic SHOWS what they are saying, on the word they
say it, so the video looks like nobody
else's. Example: `assets/IronReel.example.tsx` (composition
`IronReel`).

Rule zero: **meaning, not decoration.** One main hologram at a time, each tied
to a spoken word, captions always readable, nothing that does not explain the
line. If a line has no visual idea, it gets no graphic.

Setup per project: `cp S/assets/iron.tsx S/assets/iron2.tsx src/talk/`, `L S/scripts/make_sfx_iron.py public`,
`L S/scripts/hand.py --ranges "A-B,..." --sheet` (ORIGINAL seconds of the chosen
takes; ~20 s per 30 s of video). hand.py prints "hand up" spans and the gesture
(open / point / pinch / fist): plan the hand beats on those. Add a composition
like IronReel (copy assets/IronReel.example.tsx to src/talk/IronReel.tsx as the template).

The kit (assets/iron.tsx, SVG + CSS 3D only, no WebGL, renders in 8 GB):
- `HudFrame` corner brackets + status line, scan line at frame 0, powers down at the end. `HudTint` scan lines + cool edge glow.
- `HoloHook` the cover headline in HUD style (amber highlight word).
- `FaceLock` reticle that shrinks onto the face (face.json) + type-on tag lines. Hook only.
- `HoloPanel` glass hologram that unfolds (or flies out of the palm with `from`), mono header that types on. Children = any content.
- `HoloProgress`, `Readout` (big number/word), `CommandLine` (prompt typed word-synced, then "EXECUTING").
- `WaveCut` recording waveform, bad parts marked red on the words that name them, then cut out and closed up.
- `TakeStack` 3D stack of take cards, scan passes, best one comes forward in amber.
- `AICore` spinning wireframe icosahedron (projected 3D) + `PalmBeam` light cone from the palm + `Beam` laser between two points (fingertip -> card, core -> cut).
- `handAt / lastHand / faceAt` read the tracking at an ORIGINAL frame (origOf(editFrame)).
- `iron2.tsx`: Globe (web search), Laptop (install), Gauge (a cited %), CheckRows, Transcript (live speech to text), Chip (flies out of a pinch), HoloWindow (website, pinched shut), CodeScroll (the real code), HoloBehind (word behind the speaker, with the fg cut-out), SendFile.
- Sounds (make_sfx_iron.py v3 "film"): NO musical notes. v1 sine sweeps = cartoon, v2 bells/chimes = "Candy Crush". Only sub-bass thumps, air whooshes, muted mechanical clicks, dark reverb: holo (every panel), hud_on, lock, hit (big moments only), scan, slice, data (rows, vol 0.1), power_off; music bed `music/iron-bed.wav` (dark drone, no beat) at -26 dB. Few sounds: big moments only.
- Full example (92 s): `assets/IronReel.example.tsx`. Render long reels in 700-frame chunks (`--frames=a-b --muted`), then `--codec aac` for the sound and join with ffmpeg concat; a detached setsid render died silently.
Face- and hand-locked pieces go INSIDE the zoom layer (they must move with the picture);
HUD frame, hook, captions outside. Colours: cyan #62E6FF, amber #FFB547 for the one
thing that matters, red #FF5C5C only for mistakes.

Hand tracking (scripts/hand.py): MediaPipe palm + landmark models as ONNX (OpenCV
Zoo, 8 MB, in setup-lite.sh), numpy crops, tracks frame to frame. Works at night.
It sees the hand only when it is in frame and open-ish: tell the creator to raise the
free hand to chest height, palm to the camera, for 1-2 s on the lines that
should get a hologram, and to point at the top of the screen for "this one".
A hologram launched from the palm keeps floating where the hand was (lastHand)
and slides beside the head so it never covers the face.

Not in this mode (honest limits): movie-real 3D, hands "grabbing" holograms
frame-perfectly, outfit/shirt changes (needs cloud AI video; kept out on purpose: no AI
video), glitch transitions (house rule).

## Street mode (filmed outside or while walking)

Studio is the default and nothing below changes a studio reel. The creator also films
outside (cars, people walking past, hand-held, at night), on purpose: it looks
real. Run `L S/scripts/street.py --analyze` on EVERY recording right after
prep.sh; it looks at 6 short stretches and prints STUDIO or STREET with what
to fix (writes src/talk/scene.json):
- **Face wobble** (the face moving around the frame; desk ~23 px, hand-held
  outside ~48 px; over 35 = steady it). In a selfie the phone moves WITH the
  face, so the background-motion number stays near 0; the wobble is what counts.
- **Other people's faces** -> blur them (UAE consent law, see Rules).
- **Voice above background** (under 10 dB = noisy) -> `clean-audio.sh
  public/talk/ig1080.mp4 street` (stronger cleanup + wind/engine rumble cut).

Phone on a stand (camera moves ~0 px/s) = STUDIO, even when the face wobble is high:
that is the creator leaning while they talk. Do NOT run the steadying then (it makes a desk video look
"like a car on a rough road"). Steady only real hand-held footage.

When it says STREET:
1. After choosing the takes, `L S/scripts/street.py` (no flags) fixes ONLY the
   chosen takes (+1 s each side): steadies the picture by following the face
   (zooms in 3-12 %, removes 75 % of the wobble so natural head movement stays;
   `--strength 1` locks the face, `--no-steady` / `--no-blur` turn parts off)
   and blurs every other face with a soft oval that follows it. Never blurs the
   speaker (a face as big as his, or on top of his, is skipped). Keeps
   `ig1080.unsteady.mp4`, writes `src/talk/face.json`. Number plates are NOT
   blurred: tell the creator not to film them close.
2. `tighten.py ... --street`: stricter speech detector, and voices much quieter
   than the creator's (people passing, a shop radio) count as pauses and get cut.
3. Whisper may write a passer-by's words into the transcript: delete them in
   the word fixes (`None`) and never put them in a caption.
4. Reel.tsx: `SCENE = "street"` (zoom snaps 1.06 instead of 1.1, since a zoom
   also enlarges leftover shake, and a soft dark band behind the captions so
   they read over car lights). `LOOK = "punchy"` for flat daylight; night
   footage: `natural`, check the stills for noise.
5. BEHIND text works: `matte.py` keeps only the speaker (a column around his
   face from face.json) so people walking behind are not cut out with him.
   Avoid BACKDROPS: a still picture behind a walking speaker looks fake.
6. `check.py` notes an emoji that would land on their face when they move into
   the reaction slot, and a missing `SCENE = "street"`.

Filming tips to give the creator for street videos: walk slowly or stand still for
the key lines, phone at arm's length at eye level, wind on the mic ruins
everything (turn away from the wind, or a cheap clip-on mic), face the light
(at night: stand near a street lamp or shop window), avoid filming strangers'
faces, children and number plates close up.

## Framing (measure on the contact sheet before writing beats)

Phone videos are often shot with the phone low, so the speaker sits low in the frame (eyes ~43 %, chin
~1230 px). Then: `ORIGIN "50% 42%"`, cards ABOVE the head (`TOP_Y` 270), the
reaction slot right of the head (`RX` 800, `RY` 690), captions around y 1350.
If the face is high (eyes ~29 %), use the original under-chin band (`CARD_Y` 990).

## Running from Windows and rendering

From a Windows Claude Code session, drive this through `wsl.exe -d Ubuntu -- bash <script>` with
`MSYS_NO_PATHCONV=1`. A process started that way dies when wsl.exe exits unless
started with `setsid nohup ... &`; render like this:

```bash
setsid nohup npx remotion render src/index.ts TalkReel out/talk-reel.mp4 --codec h264 --crf 18 --concurrency 4 --log=error > out/reel/render.log 2>&1 < /dev/null & disown
```

WSL has 8 GB: concurrency 4, ~20 min for 75 s. Whisper turbo on the CPU takes
~13 min for 2 min of speech. Deliver to the user's Desktop (or the folder they name)
plus a 720p preview for the phone.

## Rules

- Never claim clients or results the creator does not have; numbers on screen only
  when they said them or they come from a cited source.
- No em dashes in on-screen text. No glitch transitions.
- The BIGVU free watermark sits bottom-right; Instagram's caption strip covers
  most of it. Suggest recording with CapCut or the normal camera next time.

---

# Original talking-head-reel instructions


# Talking-head reel

The raw material is one person on a phone, portrait, talking to camera for
five minutes to get ninety seconds of usable speech: every sentence is said
two or three times, the best version is usually the last, and the file ends
with an outtake. The deliverable is a 1080x1920 reel of the best take of
each sentence, cut on word boundaries, with framing snaps on every cut so
the jump cuts read as a style, and overlays that land on the word they
illustrate. Nothing on screen says anything the speaker did not say; it
makes what they said visible.

`assets/Reel.example.tsx` and `assets/reel-segments.example.json` are a
placeholder timeline built on the timings of a fictional recording, so
they compile and show the wiring, the pacing and the density; read them
once before planning a new reel. `overlays.tsx` holds the shared `Card`,
`Big`, `LogoRow` and `Word`; `reel-overlays.tsx` holds the vertical
grammar.

The Remotion project is `remotion/` next to this file (`cd remotion &&
npm install` once). Every path below that says `src/`, `public/` or
`out/` is inside it, and the scripts are run from inside it.

## Windows (WSL)

On Windows the skill runs inside WSL (Ubuntu), with Claude Code started
from the WSL shell, not from PowerShell; `scripts/setup-wsl.sh` installs
everything once. `grep -qi microsoft /proc/version` tells you you are
there. What changes:

- Files the user names like `C:\Users\you\Downloads\IMG_1234.MOV` are
  `/mnt/c/Users/you/Downloads/IMG_1234.MOV` (`wslpath 'C:\...'`
  converts). Copy the recording into the WSL home before `prep.sh`;
  reading video from `/mnt/c` is several times slower.
- "The Desktop" is the Windows Desktop, which OneDrive may have moved:
  `desk=$(wslpath "$(powershell.exe -NoProfile -Command "[Environment]::GetFolderPath('Desktop')" | tr -d '\r')")`.
- No GPU: whisper runs on the CPU (a five-minute recording takes several
  minutes) and `prep.sh` encodes with libx264. Run long steps detached
  like `render.sh` does.
- Memory is what WSL was given (half the PC's RAM unless `.wslconfig`
  says otherwise; check `free -g`). Under 12 GB, render with
  concurrency 4 (`scripts/render.sh TalkReel out/talk-reel.mp4 4`); if
  the render dies with no error in the log, it was killed for memory:
  use `render-chunked.sh`. `sysctl vm.swapusage` below is macOS; on WSL
  use `free -g`.

## What "good" looks like

The speaker is centred and fills the width. Under the chin, a band of dark
cards that change every few seconds: a row of logo chips popping one per
spoken name, a big number, a numbered list that fills in as things are
listed and then gets a red stamp slammed across it when they are
dismissed, a quote card whose last line lands in the accent colour, a
claim struck through, a terminal typing a prompt, three polaroids of the
other takes, two big logos bouncing at the close. Next to the head,
top-right on the wall, a "reaction slot": a logo that appears big and
alone on its name and is gone a second later, a big background-free emoji
on a feeling, a meme popping in on a punchline. Under the band, three-word
captions with the spoken word in the accent colour. The framing snaps
between 1.0 and 1.1 at every cut and at most sentence starts, and pushes
in slowly on the line that matters. The last frame freezes under an end
card with the thing the speaker wants people to click. All of it above
the Instagram UI.

## The pipeline

```
prep.sh       -> public/talk/ig1080.mp4           (portrait 1080x1920, 30 fps, cheap to seek)
transcribe.py -> words.whisper.json + segment table   (the WHOLE recording, all takes)
choose takes  -> reel-segments.json                 (original seconds, best take per sentence)
cut.py        -> reel-words.json + edit timeline    (captions in edit time, frames per take)
plan          -> beats: original second -> overlay
Reel.tsx      -> Remotion composition (copy assets/reel-overlays.tsx)
stills.sh     -> tiled portrait grids at the key seconds, fix layout
render.sh     -> detached render (~10 min for 80 s)
QA            -> probe, contact sheet, audio check, copy to Desktop, hand over
```

The scripts do the boring steps the same way every time. The creative
work is choosing takes and planning beats.

### 1. Ingest

Probe first, with per-stream (never per-frame) side data: `ffprobe -v
error -select_streams v:0 -show_entries stream_side_data=rotation -of
csv=p=0 <mov> | head -1`. A portrait phone file is a 1920x1080 HEVC stream
with `rotation=90`; ffmpeg rotates before the filter graph, so the scale
target is `1080:1920`. Asking ffprobe for `side_data=rotation` on the
stream entries prints one line per frame forever.

```bash
scripts/prep.sh <IMG_xxxx.MOV> public/talk
```

While it runs, make a contact sheet (`scripts/sheet.sh <mov> 10`) and look
at it for the geometry: where the face sits (the zoom origin), where the
chin is (the top of the card band), where the hands reach (they will be
covered, that is fine), and how bright the wall is (dark cards on a bright
wall). The reel is portrait, so `sheet.sh`'s 5-column tiling is fine at
10 s per tile.

### 2. Transcribe everything

```bash
scripts/transcribe.py <IMG_xxxx.MOV> --out <scratch>/words_all.json \
  --fix "Cloud=Claude" --fix "cloud=Claude"
```

Transcribe the whole file, not a cut of it; the segment table it prints
is the take map. Its suggested cut/end are meaningless here (they assume
one take), ignore them. The raw whisper json it keeps next to the output
is what `cut.py` reads. Whisper mangles product names; fix words with
`--fix` and phrases later with `cut.py --phrase "Claude code=Claude Code"`.

**Urdu recordings.** Add `--language ur` (or `--language auto` when the
speaker mixes Urdu and English and you are not sure which dominates).
Without it whisper assumes English and returns garbage or Hindi
(Devanagari) script. With `ur` it writes Urdu script, and English words
the speaker drops in ("AI", "Claude") usually come back spelled in Urdu
script too; turn them back into Latin with `--fix`, e.g.
`--fix "کلاڈ=Claude"`. Nothing else changes: the take-selection
heuristics already know the common Urdu retake phrases (دوبارہ,
ایک بار پھر, پھر سے, شروع سے), greetings (السلام علیکم, سلام, ہیلو) and
Urdu punctuation (۔ ، ؟). The captions detect Urdu script and render it
right to left in Noto Nastaliq Urdu with a taller pill; keep caption
groups at three words, Nastaliq runs wide. Write callouts, chips and the
end card in Urdu too when the reel is in Urdu; any component using `FONT`
picks up the Urdu font, but components with a fixed `direction` or
`textTransform: "uppercase"` label were designed for Latin, so check them
in the stills.

**Pashto recordings.** Same as Urdu with `--language ps`. Whisper's
Pashto is far weaker than its Urdu or English: expect wrong words, some
Urdu or Persian spellings, and word timestamps that drift. Read the
segment table against the script before choosing takes, fix words with
`--fix`, and check every cut in the stills. Pashto retake phrases
(یو ځل بیا, له سره, غلط شو) and greetings (ستړي مه شئ, ښه راغلاست) are
recognised. The captions switch the whole reel to Noto Naskh Arabic, the
style Pashto is printed in, when the transcript contains Pashto-only
letters (ټ ډ ړ ږ ښ ګ ڼ ې ۍ ځ څ); for Pashto callouts and cards use
`FONT_PS` from `overlays.tsx` instead of `FONT`.

### 3. Choose the takes

Read `references/take-selection.md` the first time. The short version:

- Walk the segment table against the script the speaker meant to say (ask
  for it; people usually have one). Group the lines by sentence; each
  sentence appears two to four times.
- Prefer the take that matches the script, is fluent, and comes later;
  people warm up. A later take with a small stumble loses to an earlier
  clean one only if the stumble is inside the sentence.
- A stretch where several sentences are said in a row without a restart
  is one segment; keep the natural pauses inside it. Only cut where the
  speaker restarted.
- One-liners from an earlier take can be spliced in (a joke that landed
  only once) when the framing matches; check in stills.
- Cut points come from word times: start 0.10 to 0.15 s before the first
  word, end 0.20 to 0.30 s after the last word. A whisper word that spans
  a pause (a "but" that lasts three seconds) hides where the sound is; run
  `silencedetect` on that window and start the take just before the sound.
- Lines the speaker did not say in any take do not go in, not even as
  text.
- Aim for 60 to 90 s. Instagram allows more; attention does not.

Write them into `src/talk/reel-segments.json` (`a`, `b`, `note` per take,
`outro` seconds for the frozen end card), then:

```bash
scripts/cut.py <scratch>/words_all.whisper.json src/talk/reel-segments.json \
  --words-out src/talk/reel-words.json --fix "cloud=Claude" --phrase "Claude code=Claude Code"
```

It prints the edit timeline (edit start, original a-b, duration, text per
take), rewrites segments.json with frame counts, and writes the captions in
edit seconds. Read the caption text at the bottom; a missing word means a
cut point is inside it.

### 4. Plan the beats

Walk the transcript one sentence at a time and ask what the speaker just
made the viewer imagine, then show that thing, on the word:

| the speaker says | you show |
|---|---|
| a product, company or platform name | its logo chip (`LogoRow`), on the word; a list of names is a row, one chip per word with its own `at` |
| a number or a duration | `Big`, on the number or up to 0.2 s after, with a two-word sub |
| a claim they would put on a website | `Big` with a short sub |
| a list they then dismiss | `StampList`: lines in on each item, stamp and strikes on the dismissal |
| what someone told them | `QuoteCard`: small header (who), lines on each clause, the last one `big` in the accent |
| "not about X" | `StrikeBig`: X pops, then a red line and a ✗ |
| a file, a skill, a repo path | `TreeCard`: mono lines in one by one |
| the prompt or message they typed | `PromptCard`: typed at ~44 cps with key ticks, an `after` line for the punchline |
| "recording", "filming" | `RecBadge`: blinking REC with a timer, top corner |
| "a few tries", "many takes" | `Takes`: three polaroids from the other takes (`ffmpeg -ss` stills, cropped to the face) |
| a name that should land alone | `BigLogo` in the reaction slot, about a second, then gone |
| a feeling | `BigEmoji`: one emoji, no background, big, with a wobble; push in on the speaker at the same time |
| a punchline, a reaction, a wait | `Meme` in the reaction slot: a template from `https://api.imgflip.com/get_memes` (top 100, names and image URLs), downloaded into `public/memes/` (gitignored, never redistributed), 240 to 300 px wide, 1.3 to 2 s, five or six per reel at most |
| "link below", a repo being published | `GitHubCard`; put the real repo name in `repo` once it exists |
| the close, a company and its badge | `HeroChips`: two 220 px chips that bounce in and keep floating |
| the close | `EndCard` over the frozen last frame, held 3 to 3.5 s, with the repo or URL as text |

If a sentence answers none of these, leave it alone; silence in the band
is what makes the next overlay land. Every beat time is an
ORIGINAL-recording second. `E(t)` in `Reel.tsx` maps it to an edit frame
through the takes and throws if `t` was cut, so a beat can never point at
material that is not in the video. A card may span a cut (`from` in one
take, `to` in the next) as long as the takes are in edit order.

### 5. Zoom grammar

Two layers multiplied together, both in `useZoom`:

- `SNAPS`: an instant base framing change, alternating 1.0 and 1.1
  (1.12 for a punchline), at every cut and at most sentence starts inside
  a long take. It turns jump cuts into a rhythm and keeps the frame alive
  in a 25 s continuous take. About one every three to four seconds; a
  soft `tap.wav` on each.
- `PUSHES`: slow push-ins (1.10 to 1.15 over 8 to 16 frames) on the line
  that matters, held to the end of its take or released over 8 frames.
  Four to six per reel.

`transformOrigin` is the face (`50% 29%` for a centred phone take); at
1.15 the chin drops from y 900 to about 950, which is why the card band
starts at `CARD_Y` 990.

### 6. Layout (1080x1920)

Instagram covers the top ~250 px (title), the bottom ~450 px (caption,
audio) and the right ~130 px from y 1000 down (like/comment/share). So:

- Card band: x 60 to 930, y 990 to about 1330. One card or one row at a
  time. Chips at size 130, labels 30 px.
- Reaction slot: x 720 to 1040, y 240 to 600, the wall next to the head.
  One thing at a time: a `BigLogo` (280 px, x 720; a 300 px one overshoots
  the frame edge on its spring), a `BigEmoji` (400 px box, x 690, it may
  brush the hair, that is fine without a background), a `Meme` (240 to
  300 px wide). The REC badge moves to the top-left (x 60) when the slot is
  taken.
- Captions: `ReelCaptions`, three words or up to punctuation, 66 px,
  bottom edge at y 1470 (`CAP_BOTTOM` 450), wrapped inside 900 px.
- End card centred at y 640 over a 55 percent dim; a repo line in mono at
  28 px with `whiteSpace: nowrap`, or it wraps at the hyphen.

Details and the measured geometry are in `references/layout.md`.

### 7. Check stills, then render

```bash
scripts/stills.sh TalkReel src/talk/reel-segments.json 12.7 14.8 22.6 25.9 58.3
```

One original second per beat (its landing moment), plus one per cut
(first frame of the new take) to see the framing change, plus
`npx remotion still src/index.ts TalkReel out/reel/f_outro.png
--frame=<last-10>` for the end card. Look for: a card on the chin, a row
wider than 870 px, a caption group colliding with the polaroids, a badge
wrapping to two lines, a chip label that should be empty, a beat that
lands after the sentence.

```bash
scripts/render.sh TalkReel out/talk-reel.mp4
```

Detached, log in `out/reel/render.log`; 2500 portrait frames with one
OffthreadVideo source render at about 4 fps, 10 minutes. Watch the log
for `Rendered N/M`, any `error`, and the process going away
(`pgrep -f "[r]emotion render"`, the bracket keeps the pattern from
matching itself).

If the log says `ENOSPC: no space left on device` in
`/var/folders/.../react-motion-render*`, the disk is not full of frames:
the machine is swapping (check `sysctl vm.swapusage`) and eight headless
Chromes push the swap files onto the last gigabyte. Check `df -h /` before
every render; under 2 GB free, use

```bash
scripts/render-chunked.sh TalkReel out/talk-reel.mp4 420 2
```

which renders muted 420-frame chunks with two browser tabs, renders the
audio on its own, and joins them with ffmpeg (same log). Your own
leftovers to clear first: `out/reel/f_*.png`, whisper's `thead-*` temp
dirs, and headless Chrome processes older than the session
(`pgrep -fl chrome-headless-shell`). Anything else on the disk belongs to
the user; ask, with sizes, before removing it.

### 8. QA and deliver

Probe (duration = speech + outro, aac stream present), measure loudness
(`ebur128`; speech from a phone lands around -27 LUFS, lift it to about
-16 LUFS with `volume` plus `alimiter`, video stream copied), a contact
sheet at 4 s tiles, and a `silencedetect` pass over the whole output: a
silence longer than 0.8 s inside the speech means a pause that should have
been cut. Copy to `~/Desktop/<name>-reel.mp4` (on WSL, the Windows Desktop; see
"Windows (WSL)" above), plus a 720p preview under
30 MB for phones. In the handover, list the takes chosen (original
seconds and why), the beats in plain words, the constants the user might
move, and the obvious follow-ups: music (the platform's own audio library
is the safe choice; a local bed needs a licence check), a different
closing take, the repo name for the GitHub card once it exists.

## Rules that came from getting it wrong

- The whole recording gets transcribed. The takes are chosen from the
  table, never by scrubbing.
- Cut on word times, never on whisper segment times; segments absorb the
  pause before a sentence.
- A word is kept when at least 0.1 s of it (or half of a short word) is
  inside the take. Keeping only words that start inside the take drops
  every "one", "of", "to" near a cut.
- Capitalise the first word of a take only when the previous kept word
  ended a sentence; a sentence can continue across a cut.
- Snap zooms replace crossfades. A crossfade between two takes of the same
  sentence reads as a mistake; a framing change reads as an edit.
- One thing in the card band and one thing in the reaction slot at a
  time, nothing in the first half second of a sentence, everything gone
  0.3 s after the sentence. A meme is a reaction, so it lands on the
  punchline word, never before it.
- When the user asks to cut a line, cut the line and the one that only
  made sense after it; what the line carried moves to the end card as
  text.
- Real numbers, real quotes, the speaker's words. The prompt card shows
  what they actually typed, shortened, not a better prompt.
- No em dashes anywhere in on-screen text.
- `public/talk/` and `public/memes/` are gitignored; the reel needs the
  transcoded recording, the `take_*.png` polaroids and the meme images
  regenerated or re-downloaded to render again.

## Files

- `scripts/prep.sh` portrait transcode for Remotion
- `scripts/sheet.sh` timestamped contact sheet of any video
- `scripts/transcribe.py` whisper turbo to words json, with word fixes
- `scripts/cut.py` takes + whisper json to captions and the edit timeline
- `scripts/stills.sh` render and tile portrait check frames at original seconds, through the takes
- `scripts/render.sh` detached render with log
- `scripts/render-chunked.sh` the same in frame-range chunks with two browser tabs, for a swapping machine
- `assets/reel-overlays.tsx` the vertical components (captions, stamp list, quote card, strike, tree, prompt, REC, polaroids, GitHub card, end card, big logo, big emoji, meme, hero chips), copy into `src/talk/`
- `assets/Reel.example.tsx` a placeholder timeline on fictional timings, the reference for the wiring and pacing
- `assets/reel-segments.example.json` its placeholder cut
- `references/take-selection.md` how to choose takes, with a worked example on a fictional recording
- `references/layout.md` the vertical geometry, the Instagram safe zones, the zoom grammar
