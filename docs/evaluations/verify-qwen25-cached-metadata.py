import hashlib
import json
from pathlib import Path
base = Path(__file__).parent
reports = []
for suffix, driver in [('metadata', 'metadata'), ('metadata-semantic', 'metadata-semantic'), ('manifests', 'manifests')]:
    r = json.loads((base / f'2026-10-04-qwen25-cached-{suffix}.json').read_text())
    assert r['status'] == 'completed' and not r['errors']
    assert r['probeSHA256'] == hashlib.sha256((base / f'probe-qwen25-cached-{driver}.mjs').read_bytes()).hexdigest()
    assert len(r['observed']['assets']) == 8
    reports.append(r)
assets = reports[-1]['observed']['assets']
assert all({a['url']: a['sha256'] for a in r['observed']['assets']} == {a['url']: a['sha256'] for a in assets} for r in reports)
tokenizers = [a for a in assets if 'tokenizer' in a]
assert len(tokenizers) == 2 and tokenizers[0]['sha256'] == tokenizers[1]['sha256']
configs = [dict(a['config']) for a in assets if 'config' in a]
assert {c.pop('quantization') for c in configs} == {'q4f16_1', 'q4f32_1'}
assert configs[0] == configs[1] and configs[0]['repetition_penalty'] == 1.05
pinned = json.loads((base / '2026-10-04-qwen25-pinned-metadata-comparison.json').read_text())
assert pinned['status'] == 'completed' and not pinned['errors'] and len(pinned['assets']) == 6
assert all(a['matchesCached'] for a in pinned['assets'] if a['filename'] != 'tensor-cache.json')
structure = json.loads((base / '2026-10-04-qwen25-pinned-manifest-structural.json').read_text())
assert len(structure['assets']) == 2 and all(a['sameParsedContent'] and not a['differences'] for a in structure['assets'])
assert {a['revision'] for a in structure['assets']} == {a['revision'] for a in pinned['repositories']}
print('Eight stable cached metadata/library entries; pinned config/tokenizers match bytes and both manifests match parsed content. Weight shards unverified.')
