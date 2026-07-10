#!/bin/bash

# Exit on error
set -e

echo "Starting build process..."

# Keep the vendored ranui design-token layer in sync (the landing hero consumes
# its --ran-* variables via public/ran-tokens.css). Regenerate on every build so
# it never drifts from the installed ranui version, prepending a provenance header
# (the file is minified, so the header explains where it came from and not to edit).
RAN_TOKENS_SRC="node_modules/ranui/dist/ranui.css"
RAN_TOKENS_HEADER="/* VENDORED — DO NOT EDIT. Generated from ranui/dist/ranui.css (the ranui design-token :root layer) by bin/build.sh on every build, so it never drifts from the installed ranui version. Landing pages <link> this so the --ran-* tokens resolve at first paint; static pages under public/ have no bundler and cannot import from node_modules. Source of truth: ranui in https://github.com/chaxus/ran (package: ranui) — change tokens there, not here. */"
if [ -f "$RAN_TOKENS_SRC" ]; then
    { echo "$RAN_TOKENS_HEADER"; cat "$RAN_TOKENS_SRC"; } > public/ran-tokens.css
    echo "Synced ranui design tokens -> public/ran-tokens.css"
else
    echo "Warning: $RAN_TOKENS_SRC not found, using existing public/ran-tokens.css."
fi

# Keep the vendored ranui component bundles in sync (same idea as the token layer
# above: static pages under public/ have no bundler, so they <script defer> these
# to register <r-button>/<r-card>/<r-select>). ranui ships official standalone
# per-component IIFEs since 0.2.0-alpha.2; re-copy on every build so they never
# drift from the installed version. Registration is guarded upstream, so loading
# several files together is safe. The file list is derived from the pages'
# <script src="/ranui-iife/..."> tags, so the pages stay the single source of
# truth — adding a component to a page automatically adds it to the sync.
RAN_IIFE_SRC="node_modules/ranui/dist/iife"
if [ -d "$RAN_IIFE_SRC" ]; then
    mkdir -p public/ranui-iife
    grep -rhoE 'ranui-iife/[a-z-]+\.iife\.js' public --include='*.html' | sort -u | while read -r ref; do
        cp "$RAN_IIFE_SRC/$(basename "$ref")" public/ranui-iife/
    done
    echo "Synced ranui component bundles -> public/ranui-iife/"
else
    echo "Warning: $RAN_IIFE_SRC not found, using existing public/ranui-iife/."
fi

# Run Vite build
pnpm vite build

# Inject timestamp into sw.js for versioning
SW_PATH="dist/sw.js"
if [ -f "$SW_PATH" ]; then
    TIMESTAMP=$(date +%s)
    # Use sed to replace the placeholder with the actual timestamp
    # Handling cross-platform sed (macOS vs Linux)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/SW_VERSION_PLACEHOLDER/$TIMESTAMP/g" "$SW_PATH"
    else
        sed -i "s/SW_VERSION_PLACEHOLDER/$TIMESTAMP/g" "$SW_PATH"
    fi
    echo "Service Worker version updated with timestamp: $TIMESTAMP"
else
    echo "Warning: dist/sw.js not found, skipping version injection."
fi

echo "Build completed successfully!"
