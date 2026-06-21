import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');
const OUTPUT_FILE = path.resolve(DIST_DIR, 'single-file.html');

function getBase64(file) {
  const bitmap = fs.readFileSync(file);
  return Buffer.from(bitmap).toString('base64');
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimes = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.wasm': 'application/wasm',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.html': 'text/html',
  };
  return mimes[ext] || 'application/octet-stream';
}

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach((f) => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) walkDir(dirPath, callback);
    else callback(path.join(dir, f));
  });
}

function bundle() {
  console.log('Starting Single-File HTML bundling...');
  let html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');

  // 1. Collect all files into VFS
  const vfs = {};
  walkDir(DIST_DIR, (filePath) => {
    const relativePath = path.relative(DIST_DIR, filePath);
    if (relativePath === 'index.html' || relativePath === 'single-file.html' || relativePath === 'sw.js') return;

    console.log(`Bunding: ${relativePath}`);
    const content = getBase64(filePath);
    vfs[`/${relativePath}`] = {
      content,
      mime: getMimeType(filePath),
    };
  });

  // 2. Inject VFS and Request Interceptor
  const interceptorScript = `
<script>
  (function() {
    const VFS = ${JSON.stringify(vfs)};
    
    function base64ToUint8Array(base64) {
      var binary_string = window.atob(base64);
      var len = binary_string.length;
      var bytes = new Uint8Array(len);
      for (var i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
      }
      return bytes;
    }

    // Intercept Fetch
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input.url;
      const path = new URL(url, window.location.origin).pathname;
      const normalizedPath = path.startsWith('./') ? path.substring(1) : path;
      
      if (VFS[normalizedPath]) {
        const file = VFS[normalizedPath];
        const data = base64ToUint8Array(file.content);
        const response = new Response(data, {
          status: 200,
          headers: { 'Content-Type': file.mime }
        });
        return Promise.resolve(response);
      }
      return originalFetch.apply(this, arguments);
    };

    // Intercept XHR
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      this._url = url;
      return originalOpen.apply(this, arguments);
    };

    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function() {
      const path = new URL(this._url, window.location.origin).pathname;
      if (VFS[path]) {
        const file = VFS[path];
        const data = base64ToUint8Array(file.content);
        
        Object.defineProperty(this, 'status', { writable: true, value: 200 });
        Object.defineProperty(this, 'readyState', { writable: true, value: 4 });
        Object.defineProperty(this, 'response', { writable: true, value: data.buffer });
        Object.defineProperty(this, 'responseText', { writable: true, value: new TextDecoder().decode(data) });
        
        if (this.onreadystatechange) this.onreadystatechange();
        if (this.onload) this.onload();
        return;
      }
      return originalSend.apply(this, arguments);
    };
    
    console.log('VFS Interceptor active');
  })();
</script>
`;

  // Insert interceptor at the top of head
  html = html.replace('<head>', '<head>' + interceptorScript);

  // 3. Fix relative paths in HTML to be absolute for the interceptor
  html = html.replace(/(src|href)="\.?\//g, '$1="/');

  fs.writeFileSync(OUTPUT_FILE, html);
  console.log(
    `Successfully generated: ${OUTPUT_FILE} (${(fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2)} MB)`,
  );
}

bundle();
