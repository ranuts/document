import copy
import hashlib
import json
from pathlib import Path
base = Path(__file__).resolve().parent
baseline = json.loads((base / '2026-10-04-ministral-writing-semantic-pairs.json').read_text())
report = json.loads((base / '2026-10-04-ministral-writing-template-override.json').read_text())
assert hashlib.sha256((base / 'probe-ministral-writing-template-override.mjs').read_bytes()).hexdigest() == report['probeSHA256']
assert report['status'] == 'completed' and report['errors'] == [] and report['bundleBytesUnchanged']
assert report['modelId'] == baseline['modelId'] and report['cases'] == baseline['cases']
assert report['bundleHashes'] == baseline['bundleHashes']
override = [{'conv_config': {'system_template': '[SYSTEM_PROMPT]{system_message}[/SYSTEM_PROMPT]'}}]
assert len(report['results']) == 6
for before, after in zip(baseline['results'], report['results']):
    assert before['id'] == after['id']
    expected = copy.deepcopy(before['inputs'])
    assert len(expected) == 1 and 'chatOpts' not in expected[0]
    expected[0]['chatOpts'] = override
    assert after['inputs'] == expected
    assert after['errors'] and after['documentUnchanged'] and after['previewCount'] == 0
assert sum(event['kind'] == 'reload' for event in report['templateOverrides']) == 1
assert sum(event['kind'] == 'chatCompletionNonStreaming' for event in report['templateOverrides']) == 6
assert all(event['after'] == override and 'before' not in event for event in report['templateOverrides'])
print('PASS: initial load and six requests use only template override; all refusals preserve source')
