#!/bin/bash

# Exit on error
set -e

echo "Starting build process..."

# Keep the vendored ranui design-token layer in sync (the landing hero consumes
# its --ran-* variables via public/ran-tokens.css). Re-copy on every build so it
# never drifts from the installed ranui version.
RAN_TOKENS_SRC="node_modules/ranui/dist/ranui.css"
if [ -f "$RAN_TOKENS_SRC" ]; then
    cp "$RAN_TOKENS_SRC" public/ran-tokens.css
    echo "Synced ranui design tokens -> public/ran-tokens.css"
else
    echo "Warning: $RAN_TOKENS_SRC not found, using existing public/ran-tokens.css."
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
