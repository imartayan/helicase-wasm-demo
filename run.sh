#!/bin/sh
# Builds the wasm module, serves the page and opens it. Ctrl-C to stop.
# Arguments go to cargo, e.g. `./run.sh --features zstd,bz2,xz`.
set -e
cd "$(dirname "$0")"
RUSTFLAGS="-C target-feature=+simd128" cargo build --release --target wasm32-unknown-unknown "$@"
cp target/wasm32-unknown-unknown/release/helicase_wasm_demo.wasm www/
PORT=${PORT:-8000}
python3 -m http.server "$PORT" --bind 127.0.0.1 -d www &
trap 'kill $!' EXIT INT TERM
sleep 0.5
URL="http://127.0.0.1:$PORT/"
if command -v open >/dev/null; then open "$URL"; else xdg-open "$URL"; fi
wait
