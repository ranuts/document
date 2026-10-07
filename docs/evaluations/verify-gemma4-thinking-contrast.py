"""Verify frozen thinking contrast mechanics without asserting semantic quality."""
import argparse
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
workspace = root.resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--partial', action='store_true')
args = parser.parse_args()
prefix = '2026-10-07-gemma4-thinking-contrast'
if args.partial:
    bindings = json.loads((workspace / '.scratch' / (prefix + '-initial-bindings.json')).read_text())
    for name, expected in bindings['sha256'].items():
        assert hashlib.sha256((workspace / name).read_bytes()).hexdigest() == expected, name
    report = json.loads((workspace / '.scratch' / (prefix + '-native.json')).read_text())
else:
    bindings = json.loads((root / (prefix + '-bindings.json')).read_text())
    for name, expected in bindings['evidenceSHA256'].items():
        assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected, name
    report = json.loads((root / (prefix + '-native.json')).read_text())
    assert report['browserClosed'] and len(report['cases']) == 2
    assert bindings['processExitCode'] == 1 and not bindings['adopted']
fixture = next(x for x in json.loads((root / '2026-10-07-gemma4-sampling-seven-language-cases.json').read_text()) if x['id'] == 'ko-summarize')
assert report['modelSHA256'] == '8e30dff3ac4c8434c49a7036fa15564bdbb6044e42bf04550bf1a096ad7e6a52'
assert 0 < len(report['cases']) <= 2
for row, variant in zip(report['cases'], ['baseline', 'thinking']):
    thinking = variant == 'thinking'
    assert row['variant'] == variant and row['prompt'] == fixture
    assert row['contextClosed'] and not row['crashed'] and not row['errors']
    assert row['selected'] == row['documentBefore'] == fixture['source'] + '\r\n'
    load = row['loads'][0]
    assert load['requested'] == {'n_threads': 4, 'reasoning': thinking, 'default_template_kwargs': {'enable_thinking': thinking}}
    assert load['actualThreads'] == 4 and load['multithread']
    if not row.get('finished'):
        assert variant == 'thinking'
        assert row['error'] == 'TimeoutError: page.waitForFunction: Timeout 240000ms exceeded.'
        assert 'sdk' not in row and 'counts' not in row and 'documentAfter' not in row
        continue
    assert len(row['sdk']) == 1
    probe = row['sdk'][0]
    request = probe['request']
    assert row['counts'][-1] == request and probe['originalMessages'] == request['messages']
    assert request['chat_template_kwargs'] == {'enable_thinking': thinking}
    assert (request['temperature'], request['top_p'], request['top_k'], request['seed'], request['max_tokens']) == (1, .95, 64, 42, 512)
    user = [x for x in request['messages'] if x['role'] == 'user']
    assert len(user) == 1
    assert json.loads(user[0]['content'].splitlines()[-1]) == {'task': fixture['task'], 'targetLanguage': fixture['targetLanguage'], 'text': row['selected'].replace('\r\n', '\n'), 'instruction': fixture['instruction']}
    if row['documentUnchanged']:
        assert row['documentAfter'] == row['documentBefore']
    else:
        assert row['afterUndo'] == row['documentBefore'] and row['afterRedo'] == row['documentAfter']
        assert json.loads(probe['completion']['choices'][0]['message']['content'])['text'] + '\r\n' == row['documentAfter']
print(('PARTIAL only: ' if args.partial else 'Completed evidence: ') + str(len(report['cases'])) + ' rows retained: baseline mechanics checked; thinking timeout missing SDK snapshots. No semantic acceptance.')
