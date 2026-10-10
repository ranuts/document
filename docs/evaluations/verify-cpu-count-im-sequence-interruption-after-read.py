import json
from pathlib import Path
p = Path(__file__).parent
before = json.loads((p / '2026-10-04-cpu-count-im-sequence-stop-after-read.json').read_text())
assert before['status'] == 'completed' and not before['errors']
assert before['cases'][0]['stopObservation'][0]['button']
assert before['before'][1][1] == '30' and before['cases'][0]['after'][1][1] == '99'
r = json.loads((p / '2026-10-04-cpu-count-im-sequence-interruption-after-read-verified.json').read_text())
assert r['status'] == 'completed' and r['bundleUnchanged'] and not r['errors']
assert [x['interruption'] for x in r['cases']] == ['stop', 'new', 'switch', 'selection', 'none']
for x in r['cases']:
    assert x['actions'] == [] and x['previews'] == 0
    assert len(x['stopObservation']) == 1 and x['stopObservation'][0]['button']
    assert 'B2: "30"' in x['stopObservation'][0]['activity']
    if x['interruption'] != 'none':
        assert x['after'] == r['before']
        assert 'Result checked' not in x['messages']
    if x['interruption'] == 'stop':
        assert not x['errors'] and any('Stopped.' in text for text in x['statuses'])
    elif x['interruption'] in ('new', 'switch'):
        assert not x['errors'] and not x['statuses'] and not x['activity']
        # body text includes old session titles in the session selector.
        assert not x['replies'] and 'How can I help with your document?' in x['messages']
    elif x['interruption'] == 'selection':
        observation = x['stopObservation'][0]
        assert observation['selectionBefore'] == {'col': 2, 'row': 0}
        assert observation['selectionAfter'] == {'col': 3, 'row': 0}
        assert len(x['errors']) == 1 and 'expired' in x['errors'][0]
    else:
        expected = [row[:] for row in r['before']]
        expected[1][1] = '99'
        assert x['after'] == expected and not x['errors']
        assert 'Result checked' in x['messages']
print('Reproduced pre-fix race; Stop/session/selection changes prevent the next write, normal execution succeeds')
