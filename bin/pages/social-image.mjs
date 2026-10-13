import { ORIGIN } from './constants.mjs';

/** One public product image shared by all static page cards. */
export function socialImageTags() {
  const image = `${ORIGIN}/social/document-editor-v1.png`;
  const alt = 'Online Document Editor: Word, Excel, PowerPoint and PDF; local editing, open source and no signup.';
  return `    <meta property="og:image" content="${image}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${alt}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${image}" />
    <meta name="twitter:image:alt" content="${alt}" />`;
}
