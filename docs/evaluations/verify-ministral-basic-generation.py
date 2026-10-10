import hashlib
import json
from pathlib import Path
base = Path(__file__).resolve().parent
report = json.loads((base / '2026-10-04-ministral-basic-generation.json').read_text())
cases = json.loads((base / '2026-10-04-ministral-basic-cases.json').read_text())
assert hashlib.sha256((base / 'probe-ministral-basic-generation.mjs').read_bytes()).hexdigest() == report['probeSHA256']
assert report['status'] == 'completed' and report['errors'] == [] and report['bundleBytesUnchanged']
assert report['cases'] == cases and len(report['results']) == 6
for row, case in zip(report['results'], cases):
    assert row['id'] == case['id'] and row['errors'] and row['documentUnchanged'] and row['previewCount'] == 0
    assert len(row['inputs']) == len(row['raw']) == 1
    request = row['inputs'][0]['request']
    assert request['messages'] == [
        {'role': 'system', 'content': 'Follow the user instruction. Return only JSON with one text field.'},
        {'role': 'user', 'content': case['prompt']},
    ]
    assert request['max_tokens'] == 64 and request['temperature'] == 0 and 'response_format' not in request
    assert row['inputs'][0]['chatOpts'] == [{'conv_config': {'system_template': '[SYSTEM_PROMPT]{system_message}[/SYSTEM_PROMPT]'}}]
    assert row['raw'][0]['text'].startswith('```json')
rows = {r['id']: r for r in report['results']}
assert rows['arithmetic']['raw'][0]['text'] == '```json\n{"answer": "4"}\n```'
assert '640.00 euros' in rows['formal-english']['raw'][0]['text']
assert 'ABC' not in rows['copy-ascii']['raw'][0]['text']
print('PASS: six recorded shortest requests and refusals; arithmetic content correct but schema wrong')
