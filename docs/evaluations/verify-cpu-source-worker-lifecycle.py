import json
from pathlib import Path
p = Path(__file__).parent
red = json.loads((p / '2026-10-04-cpu-source-worker-lifecycle-red.json').read_text())
green = json.loads((p / '2026-10-04-cpu-source-worker-lifecycle-green.json').read_text())
assert red['retirement']['before']['state'] == red['retirement']['late']['state'] == 'pending'
assert red['abort']['result']['state'] == 'pending'
assert any('message.replace' in x for x in red['errors'])
assert not green['errors']
for k, fields in [('retirement', ['before', 'late']), ('abort', ['result', 'late'])]:
    assert green[k]['terminated'] == 1
    for f in fields:
        assert green[k][f]['state'] == 'rejected'
        assert 'worker terminated' in green[k][f]['error'] if k == 'retirement' else 'Diagnostic native failure' in green[k][f]['error']
print('Compiled source proxy: pending and late requests reject on retirement or object-valued native abort')
