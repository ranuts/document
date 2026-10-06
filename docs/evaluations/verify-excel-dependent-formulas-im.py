"""Independent checks of retained native snapshots and saved artifact identity."""
import hashlib
import json
from pathlib import Path
import zipfile
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[2]
report = json.loads((root / 'docs/evaluations/2026-10-04-excel-dependent-formulas-im.json').read_text())
driver = root / 'docs/evaluations/probe-excel-dependent-formulas-im.mjs'
assert hashlib.sha256(driver.read_bytes()).hexdigest() == report['probeSHA256']
assert report['passed'] and report['errors'] == [] and report['dialogs'] == []
assert len(report['results']) == 1
row = report['results'][0]
values = [['邻居 四季', '17', '34'], ['日本 ä', '5', '15'], ['91', '92', '16']]
formulas = [['', '', 'B1*2'], ['', '', 'B2*3'], ['', 'A3+1', 'C2+1']]
expected = [[{'value': values[r][c], 'formula': formulas[r][c]} for c in range(3)] for r in range(3)]
assert row['before'] == expected and row['afterUndo'] == expected
expected[1][1]['value'] = '7'
expected[1][2]['value'] = '21'
expected[2][2]['value'] = '22'
for key in ['after', 'afterRedo', 'reopened']:
    assert row[key] == expected, key
assert row['visibleErrors'] == [] and row['previewCount'] == 0
assert row['saveButtonBefore']['disabled'] is False
saved = row['nativeSave']
artifact = root / saved['artifactPath']
assert saved['failure'] is None
assert artifact.stat().st_size == saved['bytes']
assert hashlib.sha256(artifact.read_bytes()).hexdigest() == saved['sha256']
with zipfile.ZipFile(artifact) as archive:
    assert archive.testzip() is None
    sheet = ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    actual = {cell.attrib['r']: cell.find('s:f', ns).text for cell in sheet.findall('.//s:c', ns) if cell.find('s:f', ns) is not None}
    assert actual == {'C1': 'B1*2', 'C2': 'B2*3', 'B3': 'A3+1', 'C3': 'C2+1'}, actual
    cells = {cell.attrib['r']: cell for cell in sheet.findall('.//s:c', ns)}
    for address, value in {'B2': '7', 'C2': '21', 'C3': '22'}.items():
        assert cells[address].get('t', 'n') == 'n', address
        assert cells[address].find('s:v', ns).text == value, address
print('PASS: dependent formula chain, exact 3x3 native values/formulas, Undo/Redo, reopen, artifact hash and OOXML formulas')
