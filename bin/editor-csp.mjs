import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Final HTML bytes define the allowed bootstrap; never permit arbitrary inline scripts. */
export function secureEditorHtml(html) {
  if (/http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(html)) throw new Error('Editor CSP already exists');
  if (!/<head\b[^>]*>/i.test(html)) throw new Error('Editor HTML needs a head insertion point');
  const hashes = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => !/\bsrc\s*=/i.test(match[1]) && match[2].trim())
    .map((match) => `'sha256-${createHash('sha256').update(match[2]).digest('base64')}'`);
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'wasm-unsafe-eval' ${[...new Set(hashes)].join(' ')}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "frame-src 'self' blob:",
    // The editor supports user-supplied remote document and artifact URLs.
    // Fetch permission does not grant those hosts permission to execute scripts.
    // Embedded editor images are read with fetch(data:) before decoding.
    "connect-src 'self' https: http: blob: data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return html.replace(
    /<head\b[^>]*>/i,
    (head) => `${head}\n<meta http-equiv="Content-Security-Policy" content="${policy}">`,
  );
}
export async function stampEditorCsp(directory) {
  const path = join(directory, 'editor.html');
  await writeFile(path, secureEditorHtml(await readFile(path, 'utf8')));
}
if (process.argv[1]?.endsWith('/editor-csp.mjs')) await stampEditorCsp(process.argv[2] ?? 'dist');
