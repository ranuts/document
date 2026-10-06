"""Verify captured screenshot provenance/layout; visual inspection is separate."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).parent
r = json.loads((root / '2026-10-04-unicode-saved-render.json').read_text())
source = json.loads((root / '2026-10-04-unicode-im-three-editors.json').read_text())
assert r['status'] == 'captured' and not r['errors'] and len(r['rows']) == 3
assert r['probeSHA256'] == hashlib.sha256((root / 'probe-unicode-saved-render.mjs').read_bytes()).hexdigest()
for row in r['rows']:
    sample = next(x for x in source['results'] if x['type'] == row['type'])
    assert row['artifactSHA256'] == sample['nativeSave']['sha256']
    screenshot = Path(row['screenshotPath']).read_bytes()
    assert screenshot.startswith(b'\x89PNG\r\n\x1a\n')
    assert hashlib.sha256(screenshot).hexdigest() == row['screenshotSHA256']
    if row['type'] != 'pptx':
        assert row['layout']['nativeReady']
    else:
        layout = row['layout']
        shape = next(x for x in layout['shapes'] if x['text'] == source['markers']['pptx'] + '\r\n')
        assert shape['x'] >= 0 and shape['y'] >= 0 and shape['width'] > 0 and shape['height'] > 0
        assert shape['x'] + shape['width'] <= layout['slideWidth']
        assert shape['y'] + shape['height'] <= layout['slideHeight']
        assert 0 < shape['contentHeight'] <= shape['height']
print('Three screenshot hashes and short PPT native layout verified; glyph/visual judgment requires viewing images')
