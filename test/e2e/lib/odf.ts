import { makeStoredZip } from './ooxml';

const NS = [
  'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"',
  'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"',
  'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"',
  'xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"',
  'office:version="1.2"',
].join(' ');

const manifest = (mime: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:media-type="${mime}"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/></manifest:manifest>`;

export const ODF_FIXTURES = [
  {
    ext: 'odt',
    label: 'ODT (OpenDocument Text)',
    mime: 'application/vnd.oasis.opendocument.text',
    body: '<office:text><text:p>ODF round trip paragraph</text:p></office:text>',
  },
  {
    ext: 'ods',
    label: 'ODS (OpenDocument Spreadsheet)',
    mime: 'application/vnd.oasis.opendocument.spreadsheet',
    body: '<office:spreadsheet><table:table table:name="Sheet1"><table:table-row><table:table-cell office:value-type="string"><text:p>ODF round trip cell</text:p></table:table-cell></table:table-row></table:table></office:spreadsheet>',
  },
  {
    ext: 'odp',
    label: 'ODP (OpenDocument Presentation)',
    mime: 'application/vnd.oasis.opendocument.presentation',
    body: '<office:presentation><draw:page draw:name="page1"><draw:frame><draw:text-box><text:p>ODF round trip slide</text:p></draw:text-box></draw:frame></draw:page></office:presentation>',
  },
] as const;

export const buildOdf = (doc: (typeof ODF_FIXTURES)[number]): Uint8Array =>
  makeStoredZip([
    // mimetype first, as the ODF package spec requires.
    { name: 'mimetype', data: doc.mime },
    { name: 'META-INF/manifest.xml', data: manifest(doc.mime) },
    {
      name: 'content.xml',
      data: `<?xml version="1.0" encoding="UTF-8"?><office:document-content ${NS}><office:body>${doc.body}</office:body></office:document-content>`,
    },
  ]);
