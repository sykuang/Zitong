#!/usr/bin/env bash
# Wrapper around `npx tauri` that auto-detects Apple code signing identity
# and fixes PATH issues (Python xattr shim).
# Usage: ./tools/tauri.sh build [args...]   or   npm run tauri -- build
set -euo pipefail

# Ensure macOS system xattr is found before any Python shims
if [[ -x /usr/bin/xattr ]]; then
  export PATH="/usr/bin:$PATH"
fi

# Auto-detect signing identity if not already set
if [[ -z "${APPLE_SIGNING_IDENTITY:-}" ]] && command -v security &>/dev/null; then
  # Prefer Developer ID (paid account) over Apple Development (free account)
  for pattern in "Developer ID Application:" "Apple Development:"; do
    IDENTITY=$(
      security find-identity -v -p codesigning 2>/dev/null \
        | grep "\"$pattern" \
        | head -1 \
        | sed 's/.*"\([^"]*\)".*/\1/'
    ) || true
    if [[ -n "$IDENTITY" ]]; then
      echo "🔏 Auto-detected signing identity: $IDENTITY"
      export APPLE_SIGNING_IDENTITY="$IDENTITY"
      break
    fi
  done

  if [[ -z "${APPLE_SIGNING_IDENTITY:-}" ]]; then
    echo "⚠️  No signing identity found — building unsigned."
  fi
fi

exec npx tauri "$@"
