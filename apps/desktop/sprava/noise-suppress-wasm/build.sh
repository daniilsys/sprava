#!/bin/bash
set -e
cd "$(dirname "$0")"
cargo build --target wasm32-unknown-unknown --release
cp target/wasm32-unknown-unknown/release/noise_suppress_wasm.wasm ../public/noise_suppress.wasm
echo "WASM built: $(wc -c < ../public/noise_suppress.wasm) bytes → public/noise_suppress.wasm"
