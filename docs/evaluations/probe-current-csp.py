"""Read-only audit of current build; does not certify deployed responses or privacy."""
import hashlib, json, pathlib, re
root = pathlib.Path(__file__).resolve().parents[2]
def read(name):
    return (root / name).read_text()
def policy(html):
    matches = re.findall(r'<meta[^>]+http-equiv="Content-Security-Policy"[^>]+content="([^"]+)"', html, re.I)
    assert len(matches) == 1, matches
    return matches[0]
def directives(value):
    return {item.strip().split()[0]: item.strip().split()[1:] for item in value.split(';') if item.strip()}
files = ['vite.config.ts', 'public/_headers', 'sws.toml', 'bin/editor-csp.mjs', 'dist/editor.html']
workers = list((root / 'dist/assets').glob('webllm.worker-*.js'))
assert len(workers) == 1
worker = workers[0]
files.append(str(worker.relative_to(root)))
shell = policy(read('dist/editor.html'))
s = directives(shell)
assert s['script-src-attr'] == ["'none'"]
assert "'unsafe-eval'" not in s['script-src']
assert "'unsafe-inline'" not in s['script-src']
assert s['object-src'] == ["'none'"]
for attrs, body in re.findall(r'<script\b([^>]*)>([\s\S]*?)</script>', read('dist/editor.html'), re.I):
    if not re.search(r'\bsrc\s*=', attrs, re.I) and body.strip():
        digest = hashlib.sha256(body.encode()).digest()
        import base64
        assert "'sha256-" + base64.b64encode(digest).decode() + "'" in s['script-src']
worker_policy = re.search(r'const MODEL_WORKER_CSP\s*=\s*\n?\s*"([^"]+)"', read('vite.config.ts')).group(1)
assert worker_policy in read('public/_headers')
assert worker_policy in read('sws.toml')
assert worker_policy in worker.read_text()
assert directives(worker_policy)['script-src'] == ["'self'", "'wasm-unsafe-eval'"]
assert {'https:', 'http:'}.issubset(s['connect-src'])
report = {
    'scope': 'Current source contracts and built bytes only; no response-header runtime, deployed edge, external-request or device acceptance.',
    'sourceCommit': __import__('subprocess').check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip(),
    'files': {name: hashlib.sha256((root/name).read_bytes()).hexdigest() for name in files},
    'shellPolicy': shell, 'workerPolicy': worker_policy,
    'checks': {'shellInlineHashesMatch': True, 'shellArbitraryInlineAndEvalDisallowed': True,
               'workerSourceHostingAndFingerprintMatch': True},
    'privacyAccepted': False,
    'remaining': ['Broad HTTP/HTTPS connect permissions are not an exfiltration barrier.',
                  'Native vendor dynamic compilation and blob Workers require their own scoped evidence.',
                  'Current deployed response policies and physical mobile devices remain unverified.']
}
print(json.dumps(report, ensure_ascii=False, indent=2))
