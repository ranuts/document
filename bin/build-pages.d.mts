export interface GeneratedPage {
  rel: string;
  route: string;
  html: string;
  source: string;
  locale: string;
}
export const LOCALES: Record<string, { prefix: string; lang: string; label: string; home: string; dir: string }>;
export const PAGES: Array<{
  slug: string;
  sources: Record<string, string>;
  meta?: Record<string, unknown>;
  stripFirstHeading?: boolean;
}>;
export function generate(opts?: { outDir?: string | null }): GeneratedPage[];
export function check(opts?: { publicDir?: string }): string[];
