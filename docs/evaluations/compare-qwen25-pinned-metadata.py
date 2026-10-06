"""Fetch pinned public manifests and compare canonical JSON to observed cache; no weights."""
import hashlib
import json
from pathlib import Path
import urllib.request
base = Path(__file__).parent
cached = json.loads((base / '2026-10-04-qwen25-cached-metadata-semantic.json').read_text())
prior = json.loads((base / '2026-10-04-qwen25-pinned-metadata-comparison.json').read_text())
report = {'scope': 'Pinned remote tensor manifests compared by canonical parsed JSON, not whitespace-dependent bytes; no shard verification.', 'assets': []}
for repo in prior['repositories']:
    url = f"https://huggingface.co/{repo['repo']}/resolve/{repo['revision']}/tensor-cache.json"
    with urllib.request.urlopen(url, timeout=30) as response:
        body = response.read()
    data = json.loads(body)
    canonical = json.dumps(data, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()
    old = next(a for a in cached['observed']['assets'] if a['url'] == f"https://huggingface.co/{repo['repo']}/resolve/main/tensor-cache.json")
    semantic = hashlib.sha256(canonical).hexdigest()
    report['assets'].append({'url': url, 'revision': repo['revision'], 'sha256': hashlib.sha256(body).hexdigest(), 'semanticSHA256': semantic, 'cachedSemanticSHA256': old['semanticSHA256'], 'sameParsedContent': semantic == old['semanticSHA256']})
report['status'] = 'completed'
(base / '2026-10-04-qwen25-pinned-semantic-comparison.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
