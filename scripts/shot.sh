#!/usr/bin/env bash
# Screenshot a web page for a cutaway, using the headless Chrome that
# Remotion already downloaded (no extra install).
#
#   shot.sh <url> public/cut/<name>.png [phone|desktop] [wait_ms=4000]
#
# phone   = 430x932 CSS px at 3x (1290x2796), how most viewers know the site
# desktop = 1440x900 at 2x, for dashboards and articles
# Run from the Remotion project root. Check the PNG before using it: cookie
# banners and login walls happen; crop or pick another page if so.
set -euo pipefail
url="$1"; out="$2"; kind="${3:-phone}"; wait="${4:-4000}"
chrome=$(find node_modules/.remotion -name chrome-headless-shell -type f 2>/dev/null | head -1)
[ -n "$chrome" ] || { echo "no chrome-headless-shell under node_modules/.remotion (render once first)"; exit 1; }
mkdir -p "$(dirname "$out")"
if [ "$kind" = desktop ]; then size="1440,900"; scale=2; ua=""; else size="430,932"; scale=3
  ua="--user-agent=Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"; fi
"$chrome" --headless --disable-gpu --hide-scrollbars --no-sandbox --window-size="$size" \
  --force-device-scale-factor=$scale --virtual-time-budget="$wait" ${ua:+"$ua"} \
  --screenshot="$(realpath -m "$out")" "$url" >/dev/null 2>&1
ls -la "$out"
