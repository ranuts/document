import json
from pathlib import Path
r = json.loads((Path(__file__).parent / '2026-10-04-cpu-count-im-sequence-worksheet-switch.json').read_text())
assert r['status'] == 'completed' and r['bundleUnchanged'] and not r['errors']
assert len(r['before']) == 2 and r['before'][0][1][1] == '30' and r['before'][1][1][1] == 'SECOND'
assert [x['interruption'] for x in r['cases']] == ['sheet', 'none']
switched, normal = r['cases']
for x in r['cases']:
    assert x['actions'] == [] and x['previews'] == 0
    assert len(x['stopObservation']) == 1 and 'B2: "30"' in x['stopObservation'][0]['activity']
assert switched['stopObservation'][0]['sheetBefore'] == 0
assert switched['stopObservation'][0]['sheetAfter'] == 1
assert switched['after'] == r['before']
assert len(switched['errors']) == 1 and 'expired' in switched['errors'][0]
assert 'Result checked' not in switched['messages']
expected = [[row[:] for row in sheet] for sheet in r['before']]
expected[0][1][1] = '99'
assert normal['after'] == expected and not normal['errors']
assert 'Result checked' in normal['messages']
print('Actual worksheet change prevents subsequent write; normal sequence only changes original-sheet B2')
