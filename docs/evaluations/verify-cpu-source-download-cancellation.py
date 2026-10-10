import json
from pathlib import Path
p = Path(__file__).parent
red = json.loads((p / '2026-10-04-cpu-source-download-cancellation-red.json').read_text())
assert all(not x['calls'][0]['hasSignal'] for x in red['results'])
for name in ['green', 'typed', 'combined']:
    r = json.loads((p / f'2026-10-04-cpu-source-download-cancellation-{name}.json').read_text())
    assert [x['phase'] for x in r['results']] == ['metadata', 'cache-head', 'model-head']
    for x in r['results']:
        assert x['result'] == {'state': 'rejected', 'name': 'AbortError'}
        assert len(x['calls']) == 1 and x['calls'][0]['hasSignal']
        assert x['calls'][0]['headers'] == {'X-Test': 'marker'} and x['deletes'] == 0
print('Source SDK metadata/cache HEAD/model HEAD cancellation forwards signal and preserves cache')
