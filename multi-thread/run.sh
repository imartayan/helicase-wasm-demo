#!/bin/sh
# Builds the wasm module, serves the page and opens it. Ctrl-C to stop.
# Arguments go to cargo, e.g. `./run.sh --features zstd,bz2,xz`.
set -e
cd "$(dirname "$0")"
cargo build --release --target wasm32-unknown-unknown "$@"
cp target/wasm32-unknown-unknown/release/helicase_wasm_demo.wasm www/
PORT=${PORT:-8000}
# http.server has no flag to disable caching, which serves stale worker.js and wasm after a rebuild.
python3 -c '
import functools, http.server, sys
class NoStore(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
http.server.test(functools.partial(NoStore, directory="www"), port=int(sys.argv[1]), bind="127.0.0.1")
' "$PORT" &
trap 'kill $!' EXIT INT TERM
sleep 0.5
URL="http://127.0.0.1:$PORT/"
if command -v open >/dev/null; then open "$URL"; else xdg-open "$URL"; fi
wait
