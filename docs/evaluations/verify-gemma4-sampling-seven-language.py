"""Validate frozen transfer evidence mechanics separately from semantic review."""
import argparse
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
parser = argparse.ArgumentParser(description=__doc__)
mode = parser.add_mutually_exclusive_group()
mode.add_argument('--partial', action='store_true', help='Check only captured rows; cannot certify completion')
mode.add_argument('--finished-attempt', action='store_true', help='Verify terminal failed attempt, preserving zero-inference setup failures')
parser.add_argument('--receipt', type=Path, help='Partial receipt override for diagnostic counterchecks')
args = parser.parse_args()
fixtures = json.loads((root / '2026-10-07-gemma4-sampling-seven-language-cases.json').read_text())
assert len(fixtures) == 21
if args.partial:
    workspace = root.resolve().parents[1]
    initial = json.loads((workspace / '.scratch/2026-10-07-gemma4-sampling-seven-language-initial-bindings.json').read_text())
    for name, expected in initial['sha256'].items():
        assert hashlib.sha256((workspace / name).read_bytes()).hexdigest() == expected, name
    receipt = args.receipt or workspace / '.scratch/2026-10-07-gemma4-sampling-seven-language-native.json'
    report = json.loads(receipt.read_text())
    assert 0 < len(report['cases']) <= 21
else:
    assert args.receipt is None, 'Receipt override requires explicit partial mode'
    bindings = json.loads((root / '2026-10-07-gemma4-sampling-seven-language-bindings.json').read_text())
    for name, expected in bindings['evidenceSHA256'].items():
        assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected, name
    report = json.loads((root / '2026-10-07-gemma4-sampling-seven-language-native.json').read_text())
    assert len(report['cases']) == 21
    assert report['browserClosed']
    assert bindings['processExitCode'] == (1 if args.finished_attempt else 0)
assert report['modelSHA256'] == '8e30dff3ac4c8434c49a7036fa15564bdbb6044e42bf04550bf1a096ad7e6a52'
verified = 0
setup_failures = 0
for fixture, row in zip(fixtures, report['cases']):
    assert row['prompt'] == fixture and row['variant'] == 'recommended'
    if (args.partial or args.finished_attempt) and not row.get('finished'):
        assert row['contextClosed'] and not row['crashed'] and not row['errors']
        assert row['selected'] == row['documentBefore'] == row['documentAfter'] == '\r\n'
        assert row['documentUnchanged'] and row['sdk'] == [] and row['counts'] == []
        assert row['error'] == 'Error: Unexpected bounded CPU request'
        assert row['chatErrors'], 'Missing no-selection rejection evidence'
        setup_failures += 1
        continue
    assert row['finished'] and row['contextClosed'] and not row.get('error')
    assert row['selected'] == row['documentBefore'] == fixture['source'] + '\r\n'
    verified += 1
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
    assert task == {'task': fixture['task'], 'targetLanguage': fixture['targetLanguage'], 'text': row['selected'].replace('\r\n', '\n'), 'instruction': fixture['instruction']}
    if row['documentUnchanged']:
        assert row['documentAfter'] == row['documentBefore']
    else:
        assert row['afterUndo'] == row['documentBefore']
        assert row['afterRedo'] == row['documentAfter']
        raw = probe['completion']['choices'][0]['message']['content']
        assert json.loads(raw)['text'] + '\r\n' == row['documentAfter']
if args.partial:
    print(f"PARTIAL ONLY: {len(report['cases'])}/21 recorded rows: {verified} inference requests/mechanics checked, {setup_failures} empty-source setup failures (zero inference). No completion or semantic acceptance.")
elif args.finished_attempt:
    assert setup_failures == bindings['emptySourceSetupFailures'] == 3
    assert verified == bindings['validInferenceRows'] == 18
    reviews = json.loads((root / '2026-10-07-gemma4-sampling-seven-language-review.json').read_text())['reviews']
    assert len(reviews) == 21
    for row, review in zip(report['cases'], sorted(reviews, key=lambda r: next(i for i, f in enumerate(fixtures) if f['id'] == r['id']))):
        assert review['id'] == row['prompt']['id']
        assert hashlib.sha256(json.dumps(row, sort_keys=True, ensure_ascii=False).encode()).hexdigest() == review['rowCanonicalSHA256']
    print('Finished FAILED attempt: 18 inference requests/mechanics verified; 3 empty-source setup failures retained. No semantic acceptance.')
else:
    print('Frozen 21 task requests and native application/history checked; refusals and semantics require separate review.')
