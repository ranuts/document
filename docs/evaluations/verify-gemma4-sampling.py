"""Verify recorded sampling contrast mechanics, not semantic correctness."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
bindings = json.loads((root / '2026-10-07-gemma4-sampling-bindings.json').read_text())
for name, expected in bindings['evidenceSHA256'].items():
    assert hashlib.sha256((root / name).read_bytes()).hexdigest() == expected, name
report = json.loads((root / '2026-10-07-gemma4-sampling-native.json').read_text())
assert report['browserClosed']
assert report['modelSHA256'] == '8e30dff3ac4c8434c49a7036fa15564bdbb6044e42bf04550bf1a096ad7e6a52'
assert len(report['cases']) == 2
requests = []
for row, variant in zip(report['cases'], ['product', 'recommended']):
    assert row['variant'] == variant and row['finished'] and row['contextClosed']
    assert not row.get('error') and not row['errors'] and not row['chatErrors']
    assert not row['crashed'] and row['previewCount'] == 0
    assert len(row['sdk']) == 1
    request = row['sdk'][0]['request']
    assert row['counts'][-1] == request
    assert request['seed'] == 42 and request['max_tokens'] == 512
    assert row['sdk'][0]['originalMessages'] == request['messages']
    if not row['documentUnchanged']:
        assert row['afterUndo'] == row['documentBefore']
        assert row['afterRedo'] == row['documentAfter']
        assert json.loads(row['sdk'][0]['completion']['choices'][0]['message']['content'])['text'] + '\r\n' == row['documentAfter']
    requests.append(request)
assert requests[0]['temperature'] == 0 and requests[0]['top_p'] == .8
assert requests[1]['temperature'] == 1 and requests[1]['top_p'] == .95 and requests[1]['top_k'] == 64
assert {k:v for k,v in requests[0].items() if k not in ['temperature','top_p','top_k']} == {k:v for k,v in requests[1].items() if k not in ['temperature','top_p','top_k']}
print('Two recorded requests differ only in sampling settings; native mechanics verified. Semantic judgment is separate.')
