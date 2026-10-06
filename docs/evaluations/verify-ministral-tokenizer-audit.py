import hashlib
import json
from pathlib import Path
root = Path(__file__).resolve().parents[2]
base = root / 'docs/evaluations'
report = json.loads((base / '2026-10-04-ministral-tokenizer-audit.json').read_text())
assert hashlib.sha256((base / 'probe-ministral-tokenizer-audit.mjs').read_bytes()).hexdigest() == report['probeSHA256']
data = {}
for record in report['files']:
    body = (root / record['artifact']).read_bytes()
    assert len(body) == record['bytes'] and hashlib.sha256(body).hexdigest() == record['sha256']
    data[record['name'], record['file']] = json.loads(body)
m, o = data['mlc', 'tokenizer.json'], data['official', 'tokenizer.json']
for key in m.keys() | o.keys():
    if key not in ['model', 'added_tokens']:
        assert m.get(key) == o.get(key), key
for key in m['model'].keys() | o['model'].keys():
    if key != 'vocab':
        assert m['model'].get(key) == o['model'].get(key), key
v, w = m['model']['vocab'], o['model']['vocab']
differences = {key: [v.get(key), w.get(key)] for key in v.keys() | w.keys() if v.get(key) != w.get(key)}
assert differences == {'<SPECIAL_34>': [None, 34], '<SPECIAL_35>': [None, 35], '[THINK]': [34, None], '[/THINK]': [35, None]}
assert len(v) == len(w) == 131072
for tokens in [m['added_tokens'], o['added_tokens']]:
    mapping = {token['content']: token['id'] for token in tokens}
    assert {key: mapping[key] for key in ['<s>', '</s>', '[INST]', '[/INST]', '[SYSTEM_PROMPT]', '[/SYSTEM_PROMPT]']} == {
        '<s>': 1, '</s>': 2, '[INST]': 3, '[/INST]': 4, '[SYSTEM_PROMPT]': 17, '[/SYSTEM_PROMPT]': 18,
    }
assert [t for t in m['added_tokens'] if t['id'] not in [34, 35]] == [t for t in o['added_tokens'] if t['id'] not in [34, 35]]
cm, co = data['mlc', 'tokenizer_config.json'], data['official', 'tokenizer_config.json']
assert {k for k in cm.keys() | co.keys() if cm.get(k) != co.get(k)} == {'added_tokens_decoder', 'additional_special_tokens'}
print('PASS: pinned tokenizer structures; only special-token 34/35 names differ, ordinary vocab/merges identical')
