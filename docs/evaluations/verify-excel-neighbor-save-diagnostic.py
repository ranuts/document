"""Independent checks of retained native snapshots and saved artifact identity."""
import hashlib
import json
from pathlib import Path
import zipfile
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[2]
report = json.loads((root / 'docs/evaluations/2026-10-04-excel-neighbor-save-diagnostic.json').read_text())
driver = root / 'docs/evaluations/probe-excel-neighbor-save-diagnostic.mjs'
assert hashlib.sha256(driver.read_bytes()).hexdigest() == report['probeSHA256']
assert report['passed'] and report['errors'] == [] and report['dialogs'] == []
assert len(report['results']) == 1
row = report['results'][0]
values = [['邻居 四季', '17', '34'], ['日本 ä', 'Original target', 'Keep right'], ['91', '92', 'Unchanged END']]
formulas = [['', '', 'B1*2'], ['', '', ''], ['', 'A3+1', '']]
expected = [[{'value': values[r][c], 'formula': formulas[r][c]} for c in range(3)] for r in range(3)]
assert row['before'] == expected and row['afterUndo'] == expected
expected[1][1] = {'value': 'IM_CELL_四季_日本_ä_2026', 'formula': ''}
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
    assert actual == {'C1': 'B1*2', 'B3': 'A3+1'}, actual
print('PASS: exact 3x3 native values/formulas, Undo/Redo, reopen, artifact hash and OOXML formulas')
