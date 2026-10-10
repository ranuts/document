import hashlib
import json
from pathlib import Path
import zipfile
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[2]
directory = root / 'docs/evaluations'
for suffix in ('', '-before', '-diagnostic'):
    report = json.loads((directory / f'2026-10-04-excel-english-sequence-im{suffix}.json').read_text())
    driver = directory / f'probe-excel-english-sequence-im{suffix}.mjs'
    assert hashlib.sha256(driver.read_bytes()).hexdigest() == report['probeSHA256']
    for name, digest in report['sources'].items():
        assert hashlib.sha256((root / name).read_bytes()).hexdigest() == digest
    if suffix == '-before':
        assert not report['passed'] and report['error'] == 'Error: Literal value mismatch'
        continue
    assert report['passed'] and not report['errors'] and len(report['results']) == 1
    row = report['results'][0]
    assert row['after'][1][1]['value'] == '00123' and not row['after'][1][1]['formula']
    assert row['afterUndo'] == row['before'] and row['afterRedo'] == row['after']
    assert row['reopened'] == row['after'] and row['reopenExact']
    assert row['neighborsExact'] and not row['visibleErrors'] and row['previewCount'] == 0
    assert any('B2: "Original target"' in text for text in row['activities'])
    if not suffix:
        assert (root / 'dist/assets' / Path(row['currentPlugin']).name).is_file()
        artifact = directory / '2026-10-04-excel-english-sequence-im.xlsx'
        assert hashlib.sha256(artifact.read_bytes()).hexdigest() == row['nativeSave']['sha256']
        with zipfile.ZipFile(artifact) as archive:
            ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            sheet = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
            cell = sheet.find('.//s:c[@r="B2"]', ns)
            assert cell is not None and cell.get('t') == 's'
            strings = ET.fromstring(archive.read('xl/sharedStrings.xml'))
            index = int(cell.find('s:v', ns).text)
            assert ''.join(strings[index].itertext()) == '00123'
print('PASS: native read/write, history, reopen and saved text type; failed attempt retained')
