"""Validate frozen original-policy placement evidence mechanics separately from semantic review."""
import argparse
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
parser = argparse.ArgumentParser(description=__doc__)
mode = parser.add_mutually_exclusive_group()
mode.add_argument('--partial', action='store_true', help='Check only captured rows; cannot certify completion')
parser.add_argument('--receipt', type=Path, help='Partial receipt override for diagnostic counterchecks')
args = parser.parse_args()
fixtures = json.loads((root / '2026-10-07-qwen3-instruct2507-seven-language-cases.json').read_text())
fixtures = [x for x in fixtures if x['id'] in ['zh-CN-summarize', 'en-translate', 'ja-translate']]
fixtures = [(x, variant) for x in fixtures for variant in ['product', 'policy-system']]
assert len(fixtures) == 6
if args.partial:
    workspace = root.resolve().parents[1]
    initial = json.loads((workspace / '.scratch/2026-10-07-qwen3-instruct2507-policy-placement-initial-bindings.json').read_text())
    for name, expected in initial['sha256'].items():
        assert hashlib.sha256((workspace / name).read_bytes()).hexdigest() == expected, name
    receipt = args.receipt or workspace / '.scratch/2026-10-07-qwen3-instruct2507-policy-placement-native.json'
    report = json.loads(receipt.read_text())
    assert 0 < len(report['cases']) <= 6
else:
    assert args.receipt is None, 'Receipt override requires explicit partial mode'
    bindings = json.loads((root / '2026-10-07-qwen3-instruct2507-policy-placement-bindings.json').read_text())
    for name, expected in bindings['evidenceSHA256'].items():
        assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected, name
    report = json.loads((root / '2026-10-07-qwen3-instruct2507-policy-placement-native.json').read_text())
    assert len(report['cases']) == 6
    assert report['browserClosed']
    assert bindings['processExitCode'] == 0
assert report['modelSHA256'] == '8cdb57cbb880d313736a9bc4e3d3d2485f145b5e19cf33783746e753e82641fc'
verified = 0
for (fixture, variant), row in zip(fixtures, report['cases']):
    assert row['prompt'] == fixture and row['variant'] == variant
    assert row['finished'] and row['contextClosed'] and not row.get('error')
    load = row['loads'][0]
    assert load['requested'] == {'n_threads': 4, 'n_ctx': 2048, 'n_gpu_layers': 0, 'reasoning': False}
    assert load['actualThreads'] == 4 and load['multithread']
    assert row['selected'] == row['documentBefore'] == fixture['source'] + '\r\n'
    verified += 1
    assert not row['crashed'] and not row['errors'] and row['previewCount'] == 0
    assert len(row['sdk']) == 1
    probe = row['sdk'][0]
    request = probe['request']
    assert row['counts'][-1] == request
    original = probe['originalMessages']
    assert len(original) == 2 and original[0]['role'] == 'system' and original[1]['role'] == 'user'
    preamble, task_json = original[1]['content'].rsplit('\n', 1)
    expected = original if variant == 'product' else [{'role': 'system', 'content': preamble}, {'role': 'user', 'content': task_json}]
    assert request['messages'] == expected, 'Policy placement must preserve original preamble and task JSON verbatim'
    assert request['response_format']['json_schema']['schema'] == {'type': 'object', 'additionalProperties': False, 'required': ['text'], 'properties': {'text': {'type': 'string'}}}
    assert request['temperature'] == .7 and request['top_p'] == .8 and request['top_k'] == 20
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
        assert json.loads(raw)['text'].replace('\r\n', '\n') + '\n' == row['documentAfter'].replace('\r\n', '\n')
if args.partial:
    print(f"PARTIAL ONLY: {len(report['cases'])}/6 inference rows/mechanics checked. No completion or semantic acceptance.")
else:
    print('Frozen six paired policy-placement requests and native application/history checked; refusals and semantics require separate review.')
