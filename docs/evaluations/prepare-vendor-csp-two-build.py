"""Build a pinned archive twice outside the checkout, or verify existing lab artifacts."""
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tarfile

repo = Path.cwd()
root = Path(os.environ.get('TWO_BUILD_ROOT', '/private/tmp/document-two-build-csp'))
revision = os.environ.get('TWO_BUILD_REVISION', '75b6551')
commit = subprocess.check_output(['git', 'rev-parse', revision], text=True).strip()
names = ['documenteditor', 'spreadsheeteditor', 'presentationeditor']

def patch_inputs():
    for name in names:
        entry = root / f'public/web-apps/apps/{name}/main/index.html'
        html = entry.read_text().replace('media="print" onload="this.media=\'all\'"', 'media="all"')
        hashes = ["'sha256-" + base64.b64encode(hashlib.sha256(body.encode()).digest()).decode() + "'"
                  for attrs, body in re.findall(r'<script\b([^>]*)>([\s\S]*?)</script>', html, re.I)
                  if not re.search(r'\bsrc\s*=', attrs, re.I) and body.strip()]
        policy = "default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' " + ' '.join(hashes) + "; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; worker-src 'self' blob:; frame-src 'self' blob:; connect-src 'self' https: http: blob:; object-src 'none'; base-uri 'self'"
        assert '<meta http-equiv="Content-Security-Policy"' not in html
        entry.write_text(html.replace('<head>', '<head>\n<meta http-equiv="Content-Security-Policy" content="' + policy + '">', 1))
        with (root / 'public/_headers').open('a') as out:
            out.write(f'\n/web-apps/apps/{name}/main/index.html\n  Content-Security-Policy: {policy}\n')

if len(sys.argv) < 2 or sys.argv[1] != 'record':
    assert not root.exists(), 'Use a new TWO_BUILD_ROOT; historical artifacts must not be overwritten'
    root.mkdir()
    archive = subprocess.check_output(['git', 'archive', commit])
    with tarfile.open(fileobj=io.BytesIO(archive)) as bundle:
        bundle.extractall(root, filter='data')
    # Installed workspace dependencies are shared, not reinstalled or copied.
    (root / 'node_modules').symlink_to(repo / 'node_modules', target_is_directory=True)
    for modules in (repo / 'packages').glob('*/node_modules'):
        (root / modules.relative_to(repo)).symlink_to(modules, target_is_directory=True)
    env = {**os.environ, 'pnpm_config_verify_deps_before_run': 'warn'}
    for variant in ['baseline', 'candidate']:
        if variant == 'candidate':
            patch_inputs()
        with (root / f'{variant}-build.log').open('w') as log:
            subprocess.run(['pnpm', 'build'], cwd=root, env=env, stdout=log, stderr=subprocess.STDOUT, check=True)
        (root / 'dist').rename(root / variant)

manifest = {'sourceCommit': commit, 'scope': 'Local independent builds; shared installed dependencies and workspace symlinks; no deployed edge or product source changes', 'root': str(root)}
for variant in ['baseline', 'candidate']:
    directory = root / variant
    sw = (directory / 'sw.js').read_bytes()
    core = re.search(rb"const CACHE_VERSION = '([^']+)'", sw)[1].decode()
    vendor = re.search(rb"const VENDOR_VERSION = '([^']+)'", sw)[1].decode()
    # Exactly the platform build.sh full-tree fingerprint, with relative paths.
    tree = subprocess.check_output(['sh', '-c', 'find sdkjs web-apps fonts -type f -exec shasum -a 256 {} + | LC_ALL=C sort'], cwd=directory)
    digest = hashlib.sha256(tree).hexdigest()
    assert digest[:12] == vendor, (variant, digest, vendor)
    headers = (directory / '_headers').read_text()
    entries = []
    for name in names:
        relative = f'web-apps/apps/{name}/main/index.html'
        body = (directory / relative).read_bytes()
        html = body.decode()
        match = re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]+)">', html)
        policy = match[1] if match else None
        if variant == 'candidate':
            assert policy and f'/{relative}\n  Content-Security-Policy: {policy}\n' in headers
            assert 'media="print" onload=' not in html
        else:
            assert policy is None and 'media="print" onload=' in html
        entries.append({'path':relative, 'bytes':len(body), 'sha256':hashlib.sha256(body).hexdigest(), 'policy':policy})
    files = [p for sub in ['sdkjs', 'web-apps', 'fonts'] for p in (directory / sub).rglob('*') if p.is_file()]
    manifest[variant] = {'core':core, 'vendor':vendor, 'fullVendorDigest':digest, 'vendorFiles':len(files), 'vendorBytes':sum(p.stat().st_size for p in files), 'swSha256':hashlib.sha256(sw).hexdigest(), 'headersSha256':hashlib.sha256(headers.encode()).hexdigest(), 'entries':entries}
assert manifest['baseline']['vendor'] != manifest['candidate']['vendor']
assert manifest['baseline']['core'] != manifest['candidate']['core']
(root / 'build-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({v: {'core':manifest[v]['core'], 'vendor':manifest[v]['vendor'], 'vendorFiles':manifest[v]['vendorFiles']} for v in ['baseline','candidate']}))
