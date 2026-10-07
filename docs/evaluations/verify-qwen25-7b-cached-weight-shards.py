"""Verify all pinned cached shard identities; no inference quality acceptance."""
import argparse
import hashlib
import json
from pathlib import Path
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--partial', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parent
workspace = root.parents[1]
prefix = '2026-10-07-qwen25-7b-cached-weight-shards'
report_path = workspace / '.scratch' / (prefix + '.json') if args.partial else root / (prefix + '.json')
report = json.loads(report_path.read_text())
artifact = json.loads((root / '2026-10-07-qwen25-7b-gpu-artifact.json').read_text())
assert report['probeSHA256'] == hashlib.sha256((root / (prefix + '.mjs')).read_bytes()).hexdigest()
assert len(report['assets']) <= len(artifact['tensorShards']) == 88
for observed, expected in zip(report['assets'], artifact['tensorShards']):
    assert observed['url'] == artifact['modelURL'] + expected['dataPath']
    assert observed['expectedBytes'] == observed['bytes'] == expected['nbytes']
    assert observed['expectedMD5'] == observed['md5'] == expected['md5sum']
    assert observed['match'] and not observed.get('missing')
if not args.partial:
    assert report['status'] == 'matched' and report['contextClosed'] and not report['errors']
    assert len(report['assets']) == 88
    assert sum(row['bytes'] for row in report['assets']) == artifact['totalShardBytes']
print(('PARTIAL ONLY' if args.partial else 'Complete cached shard audit') + f": {len(report['assets'])}/88; no semantic acceptance.")
