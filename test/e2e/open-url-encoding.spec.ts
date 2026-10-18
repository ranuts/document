import { createServer } from 'node:http';
import { expect, test } from './lib/l0';
import { buildDocx } from './lib/ooxml';
import { waitForEditorReady } from './actions/editor';

for (const parameter of ['file', 'src']) {
  test(`startup ${parameter} preserves the remote document URL's encoded delimiters`, async ({ page }) => {
    test.setTimeout(120_000);
    const received: string[] = [];
    const bytes = Buffer.from(buildDocx('The exact encoded document URL opened successfully.'));
    // Return a valid document even for a wrong URL, so only the request assertion
    // catches double decoding; native parse errors cannot accidentally catch it.
    const server = createServer((request, response) => {
      received.push(request.url!);
      response.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Disposition',
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': 'attachment; filename="Encoded.docx"',
      });
      response.end(bytes);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;
    const path = '/folder%2Freport%23part%25%E6%96%87.docx?token=one%26two%3Dthree&literal=%252F&space=one%20two';
    try {
      const remote = `http://127.0.0.1:${port}${path}`;
      await page.goto(`/editor?${parameter}=${encodeURIComponent(remote)}`);
      await expect.poll(() => received.length).toBeGreaterThan(0);
      expect(received).toEqual([path]);
      expect((await waitForEditorReady(page)).kind).toBe('word');
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
}
