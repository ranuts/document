"""Verify observed local engine retry mechanics, not semantic model quality."""
import json
from pathlib import Path

root = Path(__file__).parent
for backend in ('gpu', 'cpu'):
    report = json.loads((root / f'2026-10-04-settings-load-stop-retry-{backend}.json').read_text())
    assert report['passed'] and not report['errors'] and not report['visibleErrors']
    assert report['cpu'] == (backend == 'cpu')
    assert report['before']['held'] > 0 and report['before']['constructed'] > 0
    stopped, late = report['afterStop'], report['afterLate']
    assert stopped['terminated'] >= 1 and stopped['stopHidden'] and not stopped['loadDisabled']
    assert stopped['note'] == late['note'] == 'Stopped.'
    assert stopped['constructed'] == late['constructed'] and not report['stopErrors']
    assert ('CPU' if backend == 'cpu' else 'WebGPU') in report['engine']
    assert ('0.6B' if backend == 'cpu' else report['model']) in report['engine']
    assert report['reply'].strip().casefold() == 'hello.'
print('GPU and CPU observed initialization Stop/late-message/retry/hello checks passed')
