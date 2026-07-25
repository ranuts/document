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

# Keep the vendored Geist faces in sync (same idea: ranui ships them as
# dist/fonts/ since 0.2.0-alpha.3 — fonts.css + variable woff2 + OFL license).
# Copied wholesale because fonts.css references the woff2 files relatively.
RAN_FONTS_SRC="node_modules/ranui/dist/fonts"
if [ -d "$RAN_FONTS_SRC" ]; then
    mkdir -p public/ran-fonts
    cp "$RAN_FONTS_SRC"/fonts.css "$RAN_FONTS_SRC"/*.woff2 "$RAN_FONTS_SRC"/OFL-LICENSE.txt public/ran-fonts/
    echo "Synced Geist faces -> public/ran-fonts/"
else
    echo "Warning: $RAN_FONTS_SRC not found, using existing public/ran-fonts/."
fi

# Run Vite build
pnpm vite build

# Fingerprint the vendored design tokens.
#
# The file's *name* was stable while its *content* changed every deploy — the one combination
# a cache cannot get right. A returning browser could hold it as fresh and never revalidate,
# and the service worker's background refresh would then be answered from that same disk
# cache and write the stale bytes back into its own cache: the old copy survived deploy after
# deploy, and only a manual cache clear fixed it. A content hash removes the category — a new
# build is a new URL, so there is nothing to invalidate.
#
# Only dist/ is rewritten. public/ keeps referencing /ran-tokens.css so `vite dev` still
# works, and no build artefact lands in a tracked source file.
TOKENS_DIST="dist/ran-tokens.css"
if [ -f "$TOKENS_DIST" ]; then
    if command -v shasum >/dev/null 2>&1; then
        TOKENS_HASH=$(shasum -a 256 "$TOKENS_DIST" | cut -c1-8)
    else
        TOKENS_HASH=$(sha256sum "$TOKENS_DIST" | cut -c1-8)
    fi
    TOKENS_NAME="ran-tokens.$TOKENS_HASH.css"
    mv "$TOKENS_DIST" "dist/$TOKENS_NAME"

    REWROTE=0
    for f in $(grep -rl '/ran-tokens\.css' dist --include='*.html' 2>/dev/null); do
        sed "s|/ran-tokens\.css|/$TOKENS_NAME|g" "$f" > "$f.tmp"
        mv "$f.tmp" "$f"
        REWROTE=$((REWROTE + 1))
    done

    # A missed reference 404s in production while dev still works off public/ — exactly the
    # kind of asymmetry that ships. Fail the build instead.
    LEFT=$(grep -rl '/ran-tokens\.css' dist --include='*.html' 2>/dev/null | wc -l | tr -d ' ')
    if [ "$LEFT" != "0" ]; then
        echo "[build] $LEFT page(s) still point at the unhashed /ran-tokens.css" >&2
        exit 1
    fi
    echo "Fingerprinted design tokens -> $TOKENS_NAME ($REWROTE pages rewritten)"
else
    echo "Warning: $TOKENS_DIST not found, skipping token fingerprint."
fi

# Inject timestamp into sw.js for versioning
SW_PATH="dist/sw.js"
if [ -f "$SW_PATH" ]; then
    TIMESTAMP=$(date +%s)
    # `sed -i` differs between BSD and GNU, so write to a temp file and move it back —
    # that works identically everywhere. The previous `[[ "$OSTYPE" == darwin* ]]` branch
    # was a bashism, and package.json runs this through `sh`, which ignores the shebang:
    # on Cloudflare's image /bin/sh is dash, where `[[` prints "not found". It survived only
    # because a failing *condition* is exempt from `set -e`, so it silently took the else
    # branch — which happens to be the right one on Linux. Luck, not design.
    sed "s/SW_VERSION_PLACEHOLDER/$TIMESTAMP/g" "$SW_PATH" > "$SW_PATH.tmp"
    mv "$SW_PATH.tmp" "$SW_PATH"
    echo "Service Worker version updated with timestamp: $TIMESTAMP"
else
    echo "Warning: dist/sw.js not found, skipping version injection."
fi

echo "Build completed successfully!"
