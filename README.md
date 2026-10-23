# Helicase in the browser

A small web page computing length statistics (records, bases, min/max length, N50) of a FASTA or FASTQ file with [Helicase](https://github.com/imartayan/helicase) compiled to WebAssembly. The file is processed locally and never leaves the page.

## Run locally

```sh
./run.sh
```

This builds the module, serves `www/` on http://127.0.0.1:8000 and opens it (`PORT=9000 ./run.sh` to change the port). It needs the `wasm32-unknown-unknown` target (`rustup target add wasm32-unknown-unknown`) and Python 3 for the local server.

## Compression formats

Plain and gzip files are supported by default. Other formats are opt-in:

```sh
./run.sh --features zstd,bz2,xz
```

`zstd` and `xz` compile C code to wasm, so they need a clang with the wasm32 target.
