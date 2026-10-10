"""Verify corrected Korean mechanics and combined coverage, not quality acceptance."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

root = Path(__file__).parent
prefix = '2026-10-07-gemma4-sampling-korean-corrected'
bindings = json.loads((root / (prefix + '-bindings.json')).read_text())
for name, expected in bindings['evidenceSHA256'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected, name
assert bindings['processExitCode'] == 0 and not bindings['adopted']
assert all(bindings['unchangedAfterRun'].values())
report = json.loads((root / (prefix + '-native.json')).read_text())
fixtures = json.loads((root / '2026-10-07-gemma4-sampling-seven-language-cases.json').read_text())
fixtures = [x for x in fixtures if x['id'].startswith('ko-')]
reviews = json.loads((root / (prefix + '-review.json')).read_text())['reviews']
assert report['browserClosed'] and len(report['cases']) == len(fixtures) == len(reviews) == 3
assert report['modelSHA256'] == '8e30dff3ac4c8434c49a7036fa15564bdbb6044e42bf04550bf1a096ad7e6a52'
for fixture, row, review in zip(fixtures, report['cases'], reviews):
    assert row['prompt'] == fixture and row['variant'] == 'recommended'
    assert row['finished'] and row['contextClosed'] and not row.get('error')
    assert not row['crashed'] and not row['errors'] and not row['chatErrors']
    assert row['selected'] == row['documentBefore'] == fixture['source'] + '\r\n'
    assert row['previewCount'] == 0 and len(row['sdk']) == 1
    probe = row['sdk'][0]
    request = probe['request']
    assert row['counts'][-1] == request and probe['originalMessages'] == request['messages']
    assert (request['temperature'], request['top_p'], request['top_k'], request['seed'], request['max_tokens']) == (1, .95, 64, 42, 512)
    users = [x for x in request['messages'] if x['role'] == 'user']
    assert len(users) == 1
    assert json.loads(users[0]['content'].splitlines()[-1]) == {'task': fixture['task'], 'targetLanguage': fixture['targetLanguage'], 'text': row['selected'].replace('\r\n', '\n'), 'instruction': fixture['instruction']}
    assert not row['documentUnchanged']
    assert row['afterUndo'] == row['documentBefore'] and row['afterRedo'] == row['documentAfter']
    assert json.loads(probe['completion']['choices'][0]['message']['content'])['text'] + '\r\n' == row['documentAfter']
    assert review['id'] == fixture['id']
    assert review['rowCanonicalSHA256'] == hashlib.sha256(json.dumps(row, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
subprocess.run([sys.executable, str(root / 'verify-gemma4-sampling-seven-language.py'), '--finished-attempt'], check=True)
original = json.loads((root / '2026-10-07-gemma4-sampling-seven-language-native.json').read_text())
valid_ids = [x['prompt']['id'] for x in original['cases'] if x.get('finished')] + [x['prompt']['id'] for x in report['cases']]
all_fixtures = json.loads((root / '2026-10-07-gemma4-sampling-seven-language-cases.json').read_text())
assert len(valid_ids) == len(set(valid_ids)) == 21
assert set(valid_ids) == {x['id'] for x in all_fixtures}
print('Corrected 3 Korean executions verified; combined 21 valid task IDs. No semantic acceptance.')
