#!/bin/bash

set -e

inject_sw_version() {
  local sw_path="$1"
  if [ -f "$sw_path" ]; then
    local timestamp
    timestamp=$(date +%s)
    if [[ "$OSTYPE" == "darwin"* ]]; then
      sed -i '' "s/SW_VERSION_PLACEHOLDER/$timestamp/g" "$sw_path"
    else
      sed -i "s/SW_VERSION_PLACEHOLDER/$timestamp/g" "$sw_path"
    fi
    echo "Service Worker versioned: $sw_path ($timestamp)"
  fi
}

echo "Building v7.5.0 (stable)..."
pnpm vite build --config vite.v7.config.ts
inject_sw_version "dist/sw.js"

echo "Building v9.3.0 (beta)..."
pnpm vite build
inject_sw_version "dist/9.3.0/sw.js"

echo "Build completed."
