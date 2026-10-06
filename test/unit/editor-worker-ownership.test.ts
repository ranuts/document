import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
it.each(['documenteditor', 'spreadsheeteditor', 'presentationeditor'])(
  'leaves root worker ownership with the application: %s',
  (app) => {
    const html = readFileSync(`public/web-apps/apps/${app}/main/index.html`, 'utf8');
    expect(html.includes('function registerServiceWorker()')).toBe(false);
    expect(html.includes('application /sw.js exclusively owns the root scope')).toBe(true);
  },
);
