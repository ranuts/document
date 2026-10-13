# Product sharing cards

## Problem and scope

The live homepage already had OG text metadata, but no `og:image` or `twitter:image`, and used the small `summary` card. Its product copy omitted PDF, optional AI, WebMCP and PWA. The editor had no sharing metadata.

The site generator produces 177 public pages in seven languages. The two templates now emit one shared product image and `summary_large_image`. Each page keeps its own canonical URL, language, title and description. Homepage social titles/descriptions are localized separately from search metadata.

The editor and local history use static generic product cards, retain `noindex`, and never derive sharing content from file names, query parameters or browser storage. The public iframe demo has its own title and URL. The real HTTP 404, legacy redirect and vendor pages are outside the promotional surface.

## Artwork

- Website: `public/social/document-editor-v1.png`, 1200 x 630, approximately 44 KB.
- Repository: `public/social/document-editor-github-v1.png`, 1280 x 640, approximately 45 KB.
- Source SVGs and `bin/build-social-image.mjs` use the existing product mark. There is no new runtime dependency.
- The user will upload the repository image in GitHub's Social preview settings; the website tags do not control GitHub's card.

## Verification

- Before implementation, all 188 social-card assertions failed on the old tags/copy or missing image.
- After implementation, all 5300 unit tests in 173 files passed, including the 188 sharing checks and existing canonical/hreflang/generated-page contracts.
- Three request-based E2E checks passed against the production build: initial HTML metadata for all 177 routes without JavaScript, PNG response type/signature/dimensions, and generic noindex editor/history cards.
- Inverse deployment check: temporarily remove the built PNG; the image E2E fails on its response content type. Restore it and rerun successfully.
- Production build, lint/type checking, repository formatting and diff whitespace checks passed. Both images were visually inspected.

## Deployment acceptance

Recheck the deployed image URL and metadata after merging, then check a real X link card. A local request with a Twitterbot user agent verifies static delivery, not an actual request from X's crawler or X's cached-card refresh.

## CI follow-up: delayed Pages check

On revision `24e9c69`, all standard, Pages-semantics and Docker E2E checks passed. The real preview smoke exited after five minutes because the Pages check was still absent; a Pages check appeared later and reported a build failure. These are distinct failures: the smoke did not reach deployment testing, and the provider's detailed build log was not available through the GitHub check output.

The five-minute missing-check limit was intended to detect fork heads that cannot deploy without a maintainer mirror. It also applied to same-repository branches, incorrectly rejecting delayed checks. Restrict that early limit to fork heads. Same-repository previews now retain the existing 45-minute overall bound; concluded deployment failures still fail immediately, and the 60-minute job timeout is unchanged.

The user then supplied the actual Pages log: cloning started at `2026-10-13T05:57:39Z` and failed around `06:14:18Z` with `RPC failed; curl 92 HTTP/2 ... CANCEL`, `early EOF` and `fetch-pack: invalid index-pack output`. The provider never reached build or deploy. This confirms a repository-transfer failure, separate from the smoke gate's premature missing-check verdict. Retry the deployment; do not change application build settings based on a clone error. The failure message now requests the provider log rather than inferring its root cause from another environment's green build.

Two new shell-execution regression cases failed before the fix: a same-repository check appearing after the fork grace window and a missing same-repository check lasting the full deployment window. They pass after the fix. Existing fork missing-check, API-error and appeared-check behavior remains covered; add a concluded-failure case to ensure this does not bypass the gate.
