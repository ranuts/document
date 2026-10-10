"""Verify frozen rewrite contrast mechanics; no semantic acceptance."""
import argparse
import hashlib
import json
import re
from pathlib import Path
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--partial', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parent
workspace = root.parents[1]
prefix = '2026-10-07-qwen25-7b-fixed-examples-headers'
request_prefix = '2026-10-07-qwen25-7b-fixed-examples'
read = lambda name: json.loads((root / name).read_text())
requests = read(request_prefix + '-requests.json')
original = [row for row in read('2026-10-07-qwen25-7b-gpu-native.json')['cases'] if row['prompt']['id'].endswith('-rewrite')]
examples = read('2026-10-04-writing-demonstration-examples.json')
policy = re.search(r"'(Rewrite source[^']+)'", (root / 'probe-gpu-writing-demonstrations.mjs').read_text()).group(1)
compact = lambda value: json.dumps(value, ensure_ascii=False, separators=(',', ':'))
assert len(requests) == 21 and len(original) == 7 and len(examples) == 4
for source, triplet in zip(original, [requests[i:i+3] for i in range(0, 21, 3)]):
    baseline = source['sdk'][0]['request']
    task = json.loads(baseline['messages'][1]['content'].rsplit('\n', 1)[1])
    for row, variant in zip(triplet, ['product', 'minimal', 'examples']):
        assert row['id'] == source['prompt']['id'] and row['variant'] == variant
        expected = json.loads(json.dumps(baseline))
        if variant != 'product':
            messages = [{'role': 'system', 'content': policy}]
            if variant == 'examples':
                for example in examples:
                    messages.extend([{'role': 'user', 'content': compact(example['input'])}, {'role': 'assistant', 'content': compact(example['output'])}])
            messages.append({'role': 'user', 'content': compact({k: task[k] for k in ['text', 'instruction']})})
            expected['messages'] = messages
        assert row['request'] == expected
if args.partial:
    initial = json.loads((workspace / '.scratch' / (prefix + '-initial-bindings.json')).read_text())
    for name, digest in initial['sha256'].items():
        assert hashlib.sha256((workspace / name).read_bytes()).hexdigest() == digest, name
    report = json.loads((workspace / '.scratch' / (prefix + '-native.json')).read_text())
else:
    binding = read(prefix + '-bindings.json')
    for name, digest in binding['evidenceSHA256'].items():
        assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest, name
    assert binding['processExitCode'] == 0
    report = read(prefix + '-native.json')
    assert report['finished'] and report['contextClosed'] and not report.get('error') and not report['errors']
    assert len(report['outputs']) == 21 and not report['workerErrors']
    assert report['workerResponseHeaders']['cross-origin-embedder-policy'] == 'require-corp'
    library = report['artifact']['library']
    assert any(row.get('url') == library['url'] and row.get('bytes') == library['bytes'] and row.get('sha256') == library['sha256'] for row in report['libraryReads'])
assert report['requests'] == requests and len(report['outputs']) <= 21
assert report['artifact'] == read('2026-10-07-qwen25-7b-gpu-artifact.json')
for observed, expected in zip(report['outputs'], requests):
    assert report['loaded'] and not observed['error']
    assert {key: observed[key] for key in ['id', 'language', 'variant', 'request']} == expected
    assert observed['completion']['model'] == 'Qwen2.5-7B-Instruct-q4f16_1-MLC'
print(('PARTIAL ONLY' if args.partial else 'Completed contrast mechanics') + f": {len(report['outputs'])}/21 outputs; no native or semantic acceptance.")
