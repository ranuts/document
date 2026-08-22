export interface GeneratedPage {
  rel: string;
  route: string;
  html: string;
  source: string;
  locale: string;
  /**
   * 'home' builds its own hero from home.json; 'landing' pages lead with a CTA;
   * 'doc' pages are prose rendered from a repository markdown file.
   */
  kind: 'home' | 'landing' | 'doc';
}
export const LOCALES: Record<string, { prefix: string; lang: string; label: string; home: string; dir: string }>;
export const LANDING_SLUGS: string[];
export const PAGES: Array<{
  slug: string;
  kind?: 'landing' | 'doc';
  sources: Record<string, string>;
  meta?: Record<string, unknown>;
  stripFirstHeading?: boolean;
}>;
export function generate(opts?: { outDir?: string | null }): GeneratedPage[];
export function check(opts?: { publicDir?: string }): string[];
