#!/bin/sh
# Rebuilds and restarts the stable preview server used by the screenshot scripts.
S=${SCRATCH:-/tmp/shaders-view}
PORT=${1:-5734}
[ -f "$S/vite-shaders-preview.pid" ] && kill "$(cat "$S/vite-shaders-preview.pid")" 2>/dev/null
pkill -f "vite preview --outDir $S/shaders-dist" 2>/dev/null
sleep 1
cd "$(dirname "$0")/../../.." || exit 1
nohup "$(pwd)/tests/harness/shaders-view/serve.sh" "$S/shaders-dist" "$PORT" > "$S/vite-shaders-preview.log" 2>&1 &
echo $! > "$S/vite-shaders-preview.pid"
for i in $(seq 1 60); do grep -q "Local:" "$S/vite-shaders-preview.log" && break; sleep 1; done
tail -2 "$S/vite-shaders-preview.log"
