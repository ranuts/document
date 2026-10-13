# Product sharing artwork

The website uses `document-editor-v1.png` (1200 x 630). The repository social preview uses `document-editor-github-v1.png` (1280 x 640).

Both use the existing product mark. To regenerate the SVG sources and PNGs, install `@resvg/resvg-js@2.6.2` into a separate tools directory and run `node bin/build-social-image.mjs <tools-dir>/package.json`. No runtime dependency is added.

Upload the repository image in GitHub Settings > Social preview. This setting is separate from the website's Open Graph metadata.
