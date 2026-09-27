#!/bin/sh
# Builds the app into a scratch folder and serves it with `vite preview` (stable: no HMR reloads).
# usage: tests/harness/shaders-view/serve.sh [outDir] [port]
OUT=${1:-/tmp/shaders-view-dist}
PORT=${2:-5734}
cd "$(dirname "$0")/../../.." || exit 1
node node_modules/.bin/vite build --outDir "$OUT" --emptyOutDir --logLevel warn || exit 1
exec node node_modules/.bin/vite preview --outDir "$OUT" --port "$PORT" --strictPort --host 127.0.0.1
