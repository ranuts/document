import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasBeacon } from '../../lib/analytics';

/**
 * The analytics beacon has three independent off-switches (no token, embed
 * mode, an edge-injected beacon already present). The third one exists because
 * Cloudflare's Pages dashboard can inline its own beacon into every HTML
 * response: with a token configured on top of that, every view would be
 * counted twice. Verified on production 2026-08-17 that the edge injection is
 * real and ignores embed mode, so this guard is not hypothetical.
 */
const BEACON = 'https://static.cloudflareinsights.com/beacon.min.js';

async function loadAnalytics(token?: string) {
  vi.resetModules();
  vi.stubEnv('VITE_CF_BEACON_TOKEN', token ?? '');
  return import('../../lib/analytics');
}

const beaconTags = () => document.head.querySelectorAll('script[src*="cloudflareinsights"]').length;

beforeEach(() => {
  document.head.querySelectorAll('script').forEach((s) => s.remove());
  window.history.pushState({}, '', '/');
});

afterEach(() => {
  vi.unstubAllEnvs();
  document.head.querySelectorAll('script').forEach((s) => s.remove());
  window.history.pushState({}, '', '/');
});

describe('hasBeacon', () => {
  it('detects a beacon by src or by the data-cf-beacon attribute', () => {
    expect(hasBeacon()).toBe(false);

    const bySrc = document.createElement('script');
    bySrc.src = `${BEACON}/v1234`;
    document.head.appendChild(bySrc);
    expect(hasBeacon()).toBe(true);
    bySrc.remove();

    // The edge sometimes inlines the loader without a matching src.
    const byAttr = document.createElement('script');
    byAttr.setAttribute('data-cf-beacon', '{"token":"edge"}');
    document.head.appendChild(byAttr);
    expect(hasBeacon()).toBe(true);
  });
});

describe('initAnalytics', () => {
  it('does nothing without a token (forks and local dev stay request-free)', async () => {
    const { initAnalytics } = await loadAnalytics();
    initAnalytics();
    expect(beaconTags()).toBe(0);
  });

  it('injects the beacon with the token on a standalone page', async () => {
    const { initAnalytics } = await loadAnalytics('tok123');
    initAnalytics();
    expect(beaconTags()).toBe(1);
    const script = document.head.querySelector('script[src*="cloudflareinsights"]')!;
    expect(script.getAttribute('data-cf-beacon')).toBe(JSON.stringify({ token: 'tok123' }));
  });

  it.each(['?embed=1', '?embed=true', '?embed', '?embedded=1'])(
    "stays out of embed mode (%s): a host page's visitors are not ours",
    async (search) => {
      window.history.pushState({}, '', `/editor${search}`);
      const { initAnalytics } = await loadAnalytics('tok123');
      initAnalytics();
      expect(beaconTags()).toBe(0);
    },
  );

  it('does not add a second beacon when the edge already injected one', async () => {
    const edge = document.createElement('script');
    edge.src = `${BEACON}/v4513226`;
    document.head.appendChild(edge);

    const { initAnalytics } = await loadAnalytics('tok123');
    initAnalytics();
    // Still exactly the edge's one — no double counting.
    expect(beaconTags()).toBe(1);
    expect(document.head.querySelector('script[data-cf-beacon]')).toBeNull();
  });
});
