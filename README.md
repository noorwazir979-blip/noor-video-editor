# Noor Video Editor

A free Claude Code skill by **Noor Zaman** (Abu Dhabi) that turns a phone video of you talking to camera into a
finished vertical reel (TikTok / Instagram / YouTube Shorts) or a long-form 16:9 YouTube video, at the standard of
top short-form creators, on an ordinary laptop. Built on
[talking-head-reel](https://github.com/mariagorskikh/talking-head-reel) (MIT).

You record yourself (retakes and mistakes are fine), hand Claude the file, and
get back an `.mp4` with:

- **Clean voice**: AI noise removal (DeepFilterNet), voice EQ, loudness at -16 LUFS
- **Fast pace**: best take of each sentence, and every pause over 0.3 s cut (Silero VAD)
- **A hook that is also the cover**: a headline on frame 0
- **Bold word-by-word captions** (Hormozi style) in English, Urdu (Nastaliq),
  Roman Urdu or Pashto, plus an optional English subtitle line
- **Something new every ~2 s**: zoom snaps, emojis and callouts on the spoken word
- **Show, don't tell**: website screenshots, headline cards, your own screen recordings
- **Sound design**: risers, hits, swooshes, a "ka-ching" on prices, music that ducks under your voice
- **Cut-out effects**: big words behind your head, swap the background (AI matting or a green cloth)
- **Two posts from one recording**: the full reel and a 20-30 s reach cut
- **A retention check** before rendering: fails if nothing changes on screen for 3 s

## Made for low-RAM machines

No PyTorch, no OpenCV. Every step peaks at about 1.1-1.8 GB of RAM, so it runs
on an 8 GB laptop or in WSL with 4 GB:

| Step | Tool | Peak RAM (measured) |
|---|---|---|
| Speech to text | faster-whisper large-v3-turbo, int8 | ~1.7 GB (openai-whisper: 3-5 GB) |
| Pause detection | Silero VAD, ONNX (2 MB) | ~0.1 GB, 1 s per minute |
| Voice cleanup | DeepFilterNet prebuilt binary | ~0.3 GB |
| Cut-out | Robust Video Matting, ONNX, half-size + ffmpeg upscale | ~1.1 GB |
| Render | Remotion, tabs chosen from free RAM | ~0.9 GB per tab |

Disk: ~0.5 GB for the toolset, ~0.8 GB for the speech model (downloaded once).

## Install (Linux, macOS, or Windows with WSL)

Needs `ffmpeg`, Node 20+, `curl`, [uv](https://docs.astral.sh/uv/) and
[Claude Code](https://claude.com/claude-code).

```bash
git clone https://github.com/noorwazir979-blip/noor-video-editor ~/.claude/skills/noor-video-editor
bash ~/.claude/skills/noor-video-editor/scripts/setup-lite.sh
cd ~/.claude/skills/noor-video-editor/remotion && npm install
```

Then in Claude Code:

> Use noor-video-editor to edit ~/Downloads/IMG_1234.MOV for Instagram. Language: Urdu,
> captions in Roman Urdu with an English line. Make a short version too.

Paste the script you meant to say if you have one; it helps take selection.

## Credits

talking-head-reel (MIT) for the base pipeline and components; Remotion;
faster-whisper / CTranslate2; Silero VAD (MIT); Robust Video Matting (GPL-3.0,
model downloaded at setup, not redistributed); DeepFilterNet (MIT/Apache-2.0,
binary downloaded at setup); Geist and Noto fonts (SIL OFL). Check each
project's license before redistributing anything they ship.

## Long-form YouTube

Record in landscape and ask: *"Use noor-video-editor to make a long YouTube video from this, with chapters."*
`assets/LongForm.example.tsx` puts you on the left third, teaching graphics on the right, a chapter card
every 1-3 minutes (copy the times into the YouTube description) and a "save this" card at the end.

## Licence

MIT (see `LICENSE`): use it, change it, share it, keep the credit lines.
Rendering uses [Remotion](https://www.remotion.dev), which has its own licence: free for individuals, non-profits and
companies with up to 3 employees; bigger companies need a Remotion company licence (remotion.pro/license).
