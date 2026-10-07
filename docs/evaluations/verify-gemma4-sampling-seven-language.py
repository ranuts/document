"""Validate frozen transfer evidence mechanics separately from semantic review."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
bindings = json.loads((root / '2026-10-07-gemma4-sampling-seven-language-bindings.json').read_text())
for name, expected in bindings['evidenceSHA256'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected, name
fixtures = json.loads((root / '2026-10-07-gemma4-sampling-seven-language-cases.json').read_text())
report = json.loads((root / '2026-10-07-gemma4-sampling-seven-language-native.json').read_text())
assert len(fixtures) == len(report['cases']) == 21
assert report['browserClosed'] and bindings['processExitCode'] == 0
assert report['modelSHA256'] == '8e30dff3ac4c8434c49a7036fa15564bdbb6044e42bf04550bf1a096ad7e6a52'
for fixture, row in zip(fixtures, report['cases']):
    assert row['prompt'] == fixture and row['variant'] == 'recommended'
    assert row['finished'] and row['contextClosed'] and not row.get('error')
    assert not row['crashed'] and not row['errors'] and row['previewCount'] == 0
    assert len(row['sdk']) == 1
    probe = row['sdk'][0]
    request = probe['request']
    assert row['counts'][-1] == request
    assert probe['originalMessages'] == request['messages']
    assert request['temperature'] == 1 and request['top_p'] == .95 and request['top_k'] == 64
    assert request['seed'] == 42 and request['max_tokens'] == 512
    users = [message for message in request['messages'] if message['role'] == 'user']
    assert len(users) == 1
    task = json.loads(users[0]['content'].splitlines()[-1])
    assert task == {'task': fixture['task'], 'targetLanguage': fixture['targetLanguage'], 'text': fixture['source'], 'instruction': fixture['instruction']}
    if row['documentUnchanged']:
        assert row['documentAfter'] == row['documentBefore']
    else:
        assert row['afterUndo'] == row['documentBefore']
        assert row['afterRedo'] == row['documentAfter']
        raw = probe['completion']['choices'][0]['message']['content']
        assert json.loads(raw)['text'] + '\r\n' == row['documentAfter']
print('Frozen 21 task requests and native application/history checked; refusals and semantics require separate review.')
