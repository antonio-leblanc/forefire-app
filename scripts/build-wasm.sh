#!/usr/bin/env bash
# Builda o motor ForeFire em WASM a partir de um commit fixo do fork e copia
# forefire.mjs + forefire.wasm pra dentro do app.
#
# Roda no Linux/WSL com emsdk. No Windows: wsl bash scripts/build-wasm.sh
set -euo pipefail

FOREFIRE_REPO="${FOREFIRE_REPO:-https://github.com/antonio-leblanc/forefire.git}"
# feat/wasm-binding
FOREFIRE_REF="${FOREFIRE_REF:-e750354cac6edfc832b1ea0401ee97228fbb1c6d}"
SRC="${FOREFIRE_SRC:-$HOME/gitrepos/forefire}"
EMSDK="${EMSDK:-$HOME/emsdk}"

APP="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$APP/src/renderer/public/engine"

if [ ! -d "$SRC/.git" ]; then
	git clone "$FOREFIRE_REPO" "$SRC"
fi
git -C "$SRC" fetch -q origin
git -C "$SRC" checkout -q "$FOREFIRE_REF"

# shellcheck disable=SC1091
source "$EMSDK/emsdk_env.sh" >/dev/null 2>&1
emcmake cmake -S "$SRC" -B "$SRC/build-wasm" -DCMAKE_BUILD_TYPE=Release >/dev/null
cmake --build "$SRC/build-wasm" -j"$(nproc)"

node "$SRC/bindings/wasm/smoke.mjs" "$SRC/bin/forefire.mjs"
node "$APP/scripts/check-isolation.mjs" "$SRC/bin/forefire.mjs"

mkdir -p "$OUT"
cp "$SRC/bin/forefire.mjs" "$SRC/bin/forefire.wasm" "$OUT/"
echo "$FOREFIRE_REF" > "$OUT/FOREFIRE_REF"
echo "engine -> $OUT ($FOREFIRE_REF)"
