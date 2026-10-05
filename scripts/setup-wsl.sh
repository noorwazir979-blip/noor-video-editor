#!/usr/bin/env bash
# One-time setup of everything talking-head-reel needs on Ubuntu, meant for
# WSL on Windows (works on plain Ubuntu too). Safe to run again.
#
#   bash ~/.claude/skills/talking-head-reel/scripts/setup-wsl.sh
#
# Installs: ffmpeg, Node 20+, the whisper CLI (in its own Python 3.12 venv,
# made with uv, on the CPU build of PyTorch), the system libraries Remotion's headless Chrome needs, the
# Remotion project's npm packages and its Chrome. Asks for your Linux
# password once (sudo). Tested on Ubuntu 24.04; newer releases ship a
# Python whisper's dependencies may not support yet, which is why whisper
# gets its own pinned Python. Downloads about 1 GB; whisper's turbo model
# (another 1.5 GB) downloads the first time a recording is transcribed.
set -euo pipefail
skill="$(cd "$(dirname "$0")/.." && pwd)"
say() { printf '\n== %s\n' "$*"; }

say "system packages (ffmpeg, Chrome libraries)"
sudo apt-get update -q
sudo apt-get install -y -q ffmpeg git curl ca-certificates fonts-dejavu-core \
  libnss3 libdbus-1-3 libxrandr2 libxkbcommon0 libxfixes3 libxcomposite1 \
  libxdamage1 libgbm1 libcairo2 libpango-1.0-0
# Ubuntu 24.04 renamed these with a t64 suffix; 22.04 has the old names
for lib in libatk1.0-0 libatk-bridge2.0-0 libcups2 libasound2; do
  sudo apt-get install -y -q "${lib}t64" 2>/dev/null || sudo apt-get install -y -q "$lib"
done

node_major() { command -v node >/dev/null && node -p 'process.versions.node.split(".")[0]' || echo 0; }
if [ "$(node_major)" -lt 20 ]; then
  say "Node.js"
  # Ubuntu's own nodejs is new enough from 25.04 on; 24.04 and older get
  # Node 22 from NodeSource
  sudo apt-get install -y -q nodejs npm || true
  if [ "$(node_major)" -lt 20 ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
    sudo apt-get install -y -q nodejs
  fi
fi

if ! command -v whisper >/dev/null && [ ! -x "$HOME/.local/bin/whisper" ]; then
  say "whisper (CPU-only PyTorch, no 3 GB of NVIDIA libraries)"
  # uv fetches its own Python 3.12, so whisper (and numba under it) never
  # depends on which Python this Ubuntu release happens to ship
  if ! command -v uv >/dev/null && [ ! -x "$HOME/.local/bin/uv" ]; then
    curl -LsSf https://astral.sh/uv/install.sh | sh
  fi
  export PATH="$HOME/.local/bin:$PATH"
  venv="$HOME/.local/share/whisper-venv"
  uv venv --python 3.12 "$venv"
  # torch first, from the CPU-only index and nowhere else, so a network
  # problem fails here instead of quietly pulling the CUDA build from PyPI;
  # whisper then finds torch already installed and leaves it alone
  uv pip install --python "$venv/bin/python" torch --index-url https://download.pytorch.org/whl/cpu
  uv pip install --python "$venv/bin/python" openai-whisper
  mkdir -p "$HOME/.local/bin"
  ln -sf "$venv/bin/whisper" "$HOME/.local/bin/whisper"
fi
# Ubuntu's ~/.profile adds ~/.local/bin to PATH for new shells once it exists
export PATH="$HOME/.local/bin:$PATH"

say "Remotion project"
cd "$skill/remotion"
npm install --no-audit --no-fund
npx remotion browser ensure
chmod +x "$skill"/scripts/*.sh "$skill"/scripts/*.py

say "check"
ffmpeg -hide_banner -version | head -1
echo "node $(node -v)"
"$HOME/.local/share/whisper-venv/bin/python" -c "import torch; print('torch', torch.__version__)" 2>/dev/null || true
echo "whisper at $(command -v whisper)"
echo "memory WSL can use: $(free -g | awk '/^Mem:/ {print $2}') GB"
if [ "$(free -g | awk '/^Mem:/ {print $2}')" -lt 12 ]; then
  echo "  (tip: renders are safer with 12 GB; see the .wslconfig step in INSTALL-WINDOWS.md)"
fi
if ! command -v claude >/dev/null && [ ! -x "$HOME/.local/bin/claude" ]; then
  echo "Claude Code is not installed in WSL yet: curl -fsSL https://claude.ai/install.sh | bash"
fi
say "done. Open a new terminal (so PATH picks up whisper), then run: claude"
