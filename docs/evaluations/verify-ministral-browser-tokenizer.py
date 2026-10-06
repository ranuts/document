import hashlib
import json
from pathlib import Path
root = Path(__file__).resolve().parents[2]
base = root / 'docs/evaluations'
report = json.loads((base / '2026-10-04-ministral-browser-tokenizer.json').read_text())
assert hashlib.sha256((base / 'probe-ministral-browser-tokenizer.mjs').read_bytes()).hexdigest() == report['probeSHA256']
sdk = (root / 'packages/agent-core/node_modules/@mlc-ai/web-llm/lib/index.js').read_bytes().decode()
assert hashlib.sha256(sdk.encode()).hexdigest() == report['sdkSHA256']
assert hashlib.sha256((sdk + '\nexport const DiagnosticTokenizer = libExports.Tokenizer;\n').encode()).hexdigest() == report['instrumentedSHA256']
for file in report['files']:
    assert hashlib.sha256((root / file['path']).read_bytes()).hexdigest() == file['sha256']
assert report['completed'] and report['errors'] == [] and len(report['results']) == 12
assert len(report['fixtures']) == 6
for text in report['fixtures']:
    rows = [row for row in report['results'] if row['text'] == text]
    assert len(rows) == 2 and {row['name'] for row in rows} == {'mlc', 'official'}
    assert all(row['decoded'] == text and row['vocabSize'] == 131072 for row in rows)
    if text != '[THINK]secret[/THINK]':
        assert rows[0]['ids'] == rows[1]['ids']
special = next(row for row in report['results'] if row['name'] == 'mlc' and row['text'] == '[THINK]secret[/THINK]')
assert special['ids'] == [34, 54870, 35]
boundaries = next(row for row in report['results'] if row['name'] == 'mlc' and row['text'].startswith('<s>'))
assert boundaries['ids'] == [1, 17, 6775, 18, 3, 1054, 1052, 1048, 4, 2]
print('PASS: twelve real-browser tokenization roundtrips; ordinary and boundary IDs match')
