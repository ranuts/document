"""Verify current-source native writer and current-build IM evidence."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
native = json.loads((root / 'docs/evaluations/2026-10-04-excel-text-write-native.json').read_text())
assert native['status'] == 'completed' and not native['errors']
for name, digest in native['hashes'].items():
    assert hashlib.sha256((root / f'lib/agent-plugin/{name}.ts').read_bytes()).hexdigest() == digest
assert len(native['cases']) == 12
for case in native['cases']:
    assert case['groupIndex'] == -1 and not case['busy']
    assert case['backupDepthAfter'] == case['backupDepthBefore']
    assert case['oldFuturePresent'] == (case['mode'] == 'cancel')
    if case['mode'] == 'success':
        assert not case.get('failure')
        assert case['after'] == case['redo'] == {'value': '00123', 'format': case['originalFormat']}
        assert case['undo'] == case['before']
    else:
        assert case.get('failure')
        if case['mode'].startswith('postComplete'):
            assert case['after'] == {'value': '00123', 'format': case['originalFormat']}
            assert case['foreignFormat'] == ('0.0000' if case['mode'].endswith('Stop') else '0.000')
        else:
            assert case['after'] == case['before']
        if case['mode'] == 'foreign':
            assert case['foreignFormat'] == ('0%' if case['originalFormat'] == 'General' else '0.00')
        if case['mode'] == 'foreignStop':
            assert case['foreignFormat'] == '0.0' and case['failure']['name'] == 'AbortError'
im = json.loads((root / 'docs/evaluations/2026-10-04-cpu-count-im-sequence-literal-text.json').read_text())
assert im['status'] == 'completed' and not im['errors'] and im['bundleUnchanged']
assert hashlib.sha256((root / 'dist/assets' / im['plugin']).read_bytes()).hexdigest() == im['pluginSHA256']
assert len(im['cases']) == 3
for case in im['cases']:
    text = '"00123"' in case['request']
    expected = {'value': '00123' if text else '99', 'format': case['originalFormat'], 'type': 1 if text else 0}
    assert case['cell'] == case['redo'] == expected
    assert case['undo'] == {'value': '30', 'format': case['originalFormat'], 'type': 0}
    assert not case['errors'] and case['previews'] == 0
    assert any('Result checked' in activity for activity in case['activity'])
    assert case['after'][0] == ['Name', 'Value', 'OUTSIDE']
    assert case['after'][1][0] == 'Cora' and case['after'][2][1] == '10' and case['after'][3][1] == '20'
assert im['nativeSave']['bytes'] > 0 and not im['nativeSave']['failure']
assert hashlib.sha256((root / im['nativeSave']['artifactPath']).read_bytes()).hexdigest() == im['nativeSave']['sha256']
assert im['reopened'] == {'value': '00123', 'format': '0.00', 'type': 1}
print('Verified 12 current-source native cases, 3 actual IM cases, and native Save/reopen.')
