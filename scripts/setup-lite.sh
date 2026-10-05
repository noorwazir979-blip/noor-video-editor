#!/usr/bin/env bash
# One-time setup of the LIGHT toolset noor-reel needs (Linux / WSL / macOS).
# ~0.5 GB on disk instead of ~3+ GB for a PyTorch stack, and every step runs
# in about 1.5 GB of RAM. Needs: ffmpeg, Node 20+, curl, and uv
# (https://docs.astral.sh/uv/, installs Python for you).
#
#   bash setup-lite.sh            # installs into ~/.local/share/reel-lite
#   REEL_LITE=/path bash setup-lite.sh
#
# Installs: onnxruntime, numpy, faster-whisper (speech to text, int8),
# Silero VAD (ONNX, pause detection), Robust Video Matting (ONNX, cut-out),
# UltraFace (ONNX, 1.5 MB, faces for street mode), DeepFilterNet (prebuilt binary, voice cleanup). Then run once per reel
# project: (cd remotion && npm install).
set -euo pipefail
L="${REEL_LITE:-$HOME/.local/share/reel-lite}"
command -v uv >/dev/null || { echo "install uv first: curl -LsSf https://astral.sh/uv/install.sh | sh"; exit 1; }
command -v ffmpeg >/dev/null || { echo "install ffmpeg first (apt install ffmpeg / brew install ffmpeg)"; exit 1; }
[ -d "$L" ] || uv venv -q --python 3.12 "$L"
VIRTUAL_ENV="$L" uv pip install -q onnxruntime numpy faster-whisper
mkdir -p "$L/models" "$L/bin"
cd "$L/models"
[ -f rvm_mobilenetv3_fp32.onnx ] || curl -sSLf -o rvm_mobilenetv3_fp32.onnx https://github.com/PeterL1n/RobustVideoMatting/releases/download/v1.0.0/rvm_mobilenetv3_fp32.onnx
[ -f version-RFB-640.onnx ] || curl -sSLf -o version-RFB-640.onnx https://github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB/raw/master/models/onnx/version-RFB-640.onnx
[ -f palm_detection_mediapipe_2023feb.onnx ] || curl -sSLf -o palm_detection_mediapipe_2023feb.onnx https://huggingface.co/opencv/palm_detection_mediapipe/resolve/main/palm_detection_mediapipe_2023feb.onnx
[ -f handpose_estimation_mediapipe_2023feb.onnx ] || curl -sSLf -o handpose_estimation_mediapipe_2023feb.onnx https://huggingface.co/opencv/handpose_estimation_mediapipe/resolve/main/handpose_estimation_mediapipe_2023feb.onnx
[ -f silero_vad.onnx ] || curl -sSLf -o silero_vad.onnx https://raw.githubusercontent.com/snakers4/silero-vad/master/src/silero_vad/data/silero_vad.onnx
cd "$L/bin"
if [ ! -x deep-filter ]; then
  case "$(uname -s)-$(uname -m)" in
    Linux-x86_64) asset=deep-filter-0.5.6-x86_64-unknown-linux-musl ;;
    Linux-aarch64) asset=deep-filter-0.5.6-aarch64-unknown-linux-gnu ;;
    Darwin-arm64) asset=deep-filter-0.5.6-aarch64-apple-darwin ;;
    Darwin-x86_64) asset=deep-filter-0.5.6-x86_64-apple-darwin ;;
    *) echo "no DeepFilterNet binary for this platform; voice cleanup will be skipped"; asset="" ;;
  esac
  [ -n "$asset" ] && curl -sSLf -o deep-filter "https://github.com/Rikorose/DeepFilterNet/releases/download/v0.5.6/$asset" && chmod +x deep-filter
fi
# emoji font for headless Chrome (Linux): Twemoji (COLR, 1.5 MB) if none is installed
if [ "$(uname -s)" = Linux ] && ! fc-list 2>/dev/null | grep -qi emoji; then
  mkdir -p "$HOME/.local/share/fonts"
  curl -sSLf -o "$HOME/.local/share/fonts/Twemoji.Mozilla.ttf" "https://github.com/mozilla/twemoji-colr/releases/download/v0.7.0/Twemoji.Mozilla.ttf" || echo "emoji font download failed: install fonts-noto-color-emoji"
  fc-cache -f >/dev/null 2>&1 || true
fi
du -sh "$L"
echo "reel-lite ready in $L"
