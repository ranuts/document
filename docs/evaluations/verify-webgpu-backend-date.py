"""Validate backend diagnostic evidence; date copy is not writing acceptance."""
import argparse
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--partial', action='store_true')
args = parser.parse_args()
prefix = '2026-10-07-webgpu-backend-date'
if args.partial:
    report = json.loads((root.resolve().parents[1] / '.scratch' / (prefix + '-native.json')).read_text())
else:
    bindings = json.loads((root / (prefix + '-bindings.json')).read_text())
    for name, expected in bindings['evidenceSHA256'].items():
        assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected, name
    report = json.loads((root / (prefix + '-native.json')).read_text())
    assert report['closed'] and len(report['runs']) == 2
requests = json.loads((root / (prefix + '-requests.json')).read_text())
assert report['modelId'] == 'Qwen2.5-3B-Instruct-q4f32_1-MLC'
finished = 0
for variant, row in zip(['default', 'swiftshader'], report['runs']):
    assert row['variant'] == variant and row['requests'] == requests and row['contextClosed']
    assert not row['errors']
    assert row['adapter']['architecture'] == ('metal-3' if variant == 'default' else 'swiftshader')
    assert row['adapter']['vendor'] == ('apple' if variant == 'default' else 'google')
    assert row['adapter']['isFallbackAdapter'] == (variant == 'swiftshader')
    if row.get('finished'):
        assert not row.get('error') and len(row['outputs']) == len(requests) == 2
        assert row['modelRecord']['model_id'] == report['modelId']
        for out in row['outputs']:
            assert not out['error'] and out['completion']['model'] == report['modelId']
            assert out['completion']['choices'][0]['finish_reason'] == 'stop'
            assert isinstance(json.loads(out['completion']['choices'][0]['message']['content'])['text'], str)
        finished += 1
    else:
        assert row.get('error'), 'Failure without retained reason'
if finished == 2:
    assert report['runs'][0]['modelRecord'] == report['runs'][1]['modelRecord']
    assert report['runs'][0]['version'] == report['runs'][1]['version']
print(('PARTIAL ONLY: ' if args.partial else 'Terminal evidence: ') + f'{finished} completed backend runs. No writing-quality acceptance.')
