"""Compare parsed manifests, allowing JSON-equivalent numeric spellings across runtimes."""
import json
from pathlib import Path
import urllib.request
base = Path(__file__).parent
cached = json.loads((base / '2026-10-04-qwen25-cached-manifests.json').read_text())
pinned = json.loads((base / '2026-10-04-qwen25-pinned-metadata-comparison.json').read_text())
report = {'assets': []}
for repo in pinned['repositories']:
    url = f"https://huggingface.co/{repo['repo']}/resolve/{repo['revision']}/tensor-cache.json"
    with urllib.request.urlopen(url, timeout=30) as response:
        remote = json.load(response)
    old = next(a for a in cached['observed']['assets'] if repo['repo'] in a['url'] and a['url'].endswith('tensor-cache.json'))['tensorCache']['manifest']
    differences = []
    def compare(a, b, path):
        if a == b:
            return
        if isinstance(a, dict) and isinstance(b, dict):
            for key in sorted(set(a) | set(b)):
                if key not in a or key not in b:
                    differences.append({'path': path + '.' + key, 'cached': a.get(key), 'remote': b.get(key)})
                else:
                    compare(a[key], b[key], path + '.' + key)
        elif isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
            for i, (left, right) in enumerate(zip(a, b)):
                compare(left, right, f'{path}[{i}]')
        else:
            differences.append({'path': path, 'cached': a, 'remote': b})
    compare(old, remote, '$')
    report['assets'].append({'repo': repo['repo'], 'revision': repo['revision'], 'sameParsedContent': old == remote, 'differenceCount': len(differences), 'differences': differences})
(base / '2026-10-04-qwen25-pinned-manifest-structural.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
