import hashlib
import json
from pathlib import Path
p = Path(__file__).parent
r = json.loads((p / '2026-10-04-excel-text-preflight-native.json').read_text())
assert r['status'] == 'completed' and not r['errors']
assert r['sourceSHA256'] == hashlib.sha256((p.parents[1] / 'lib/agent-plugin/excel-text-preflight.ts').read_bytes()).hexdigest()
assert [x['name'] for x in r['cases']] == ['normal', 'merged', 'protected']
for x in r['cases']:
    assert x['before'] == x['after'] and x['before']['value'] == '30'
normal, merged, protected = r['cases']
assert normal['error'] is None and not normal['before']['merged'] and not normal['before']['protected']
assert merged['error'] == 'officeMergedTarget' and merged['before']['merged']
assert protected['error'] == 'officeProtectedRange' and protected['before']['protected']
print('Native merged/protected targets reject before mutation; normal target passes without changing format/history')
