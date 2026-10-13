# Social cards implementation plan

**Goal:** Give every public generated page an image-backed sharing card, with concise localized product copy on homepages.

**Approved direction:** Reuse one product image, use large-image cards, preserve page-specific titles and canonical URLs, and give the editor a generic card without document content. The user approved implementation and requested coverage across the site's pages.

**Evidence:** The live homepage returns existing OG text and `twitter:card=summary`, without image tags, for both a browser and Twitterbot user agent. The editor has no social metadata. `generate({ outDir: null })` currently produces 177 pages in seven locales.

**Scope:** The two page templates, a shared image-tag helper, seven homepage JSON files, editor and history HTML, the public iframe demo, a product SVG/PNG and render script, generated root index, social-card tests and an exploration record. Keep the error page as an HTTP 404. Preserve page routes, canonical/hreflang, editor query handling, noindex and local-document privacy. No runtime editor, vendor, dependencies or hosting-policy changes.

- [x] Add page-wide tests and observe missing-image failures.
- [x] Add shared image tags and localized homepage social titles/descriptions.
- [x] Add generic static cards to editor/history and a contextual card to the iframe demo.
- [x] Render a deterministic product image using the existing brand mark and inspect it.
- [x] Generate pages; verify all page cards, metadata escaping, image bytes and dimensions, formatting, lint and production build.
- [x] Review changes, commit by function, push and create a PR. Provide the repository image for the user to upload in Social preview settings (user follow-up).

**Simplest implementation:** Static metadata and one shared raster image. No dynamic image service, user-document previews, browser-language rewriting or per-page artwork.
