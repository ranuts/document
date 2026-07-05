/**
 * Privacy-friendly page analytics via Cloudflare Web Analytics.
 *
 * Deliberately NOT Google Analytics: this project's whole pitch is local-only,
 * no-server privacy, so we avoid Google's tracking scripts and cookies. The
 * Cloudflare beacon is cookieless and needs no consent banner (GDPR-friendly).
 *
 * The beacon loads only when BOTH hold:
 *   1. A token is configured via VITE_CF_BEACON_TOKEN. Unset -> disabled, zero
 *      external requests (so forks / local dev stay tracking-free by default).
 *   2. The app is the top-level standalone page — never when embedded in a host
 *      site's iframe, which would attribute the host's visitors to us and leak
 *      analytics into pages that only wanted the editor.
 *
 * The token is a public client-side value (it ships in the page HTML by design),
 * so injecting it at build time from an env var is safe.
 */

const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

const EMBED_QUERY_KEYS = ['embed', 'embedded'];

/** Mirror of embed-api's detection: iframe-embedded or an ?embed=/?embedded= flag. */
function isEmbedded(): boolean {
  if (window.parent !== window) {
    return true;
  }
  const params = new URLSearchParams(window.location.search);
  return EMBED_QUERY_KEYS.some((key) => {
    const value = params.get(key);
    return value === '' || value === '1' || value === 'true';
  });
}

export function initAnalytics(): void {
  const token = import.meta.env.VITE_CF_BEACON_TOKEN;
  if (!token) {
    return; // analytics disabled until a token is configured
  }
  if (isEmbedded()) {
    return; // never track inside a host page's iframe
  }

  const script = document.createElement('script');
  script.defer = true;
  script.src = BEACON_SRC;
  script.setAttribute('data-cf-beacon', JSON.stringify({ token }));
  document.head.appendChild(script);
}
