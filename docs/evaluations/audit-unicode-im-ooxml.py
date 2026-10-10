"""Inspect saved synthetic native artifacts; no rendering/font acceptance."""
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as E

root = Path(__file__).parent
source_path = root / '2026-10-04-unicode-im-three-editors.json'
source = json.loads(source_path.read_text())
ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      's': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
      'p': 'http://schemas.openxmlformats.org/presentationml/2006/main'}
report = {'scope': 'Saved sample package/XML and literal structure only; not rendered appearance, all metadata or universal format compatibility.',
          'sourceReportSHA256': hashlib.sha256(source_path.read_bytes()).hexdigest(),
          'auditSHA256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'results': []}
assert source['passed'] and len(source['results']) == 3
for row in source['results']:
    saved = row['nativeSave']
    path = Path(saved['artifactPath'])
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    assert digest == saved['sha256'] and len(data) == saved['bytes']
    marker = source['markers'][row['type']]
    result = {'type': row['type'], 'artifactSHA256': digest}
    with ZipFile(path) as z:
        assert z.testzip() is None
        xml = {name: E.fromstring(z.read(name)) for name in z.namelist() if name.endswith(('.xml', '.rels'))}
        result['parsedXMLParts'] = len(xml)
        assert '[Content_Types].xml' in xml and '_rels/.rels' in xml
        if row['type'] == 'docx':
            document = xml['word/document.xml']
            text = ''.join(node.text or '' for node in document.findall('.//w:t', ns))
            assert text == marker
            runs = document.findall('.//w:r[w:t]', ns)
            result['textRunCount'] = len(runs)
            result['directRunFonts'] = [node.attrib for node in document.findall('.//w:rFonts', ns)]
        elif row['type'] == 'xlsx':
            sheet = xml['xl/worksheets/sheet1.xml']
            cells = sheet.findall('.//s:sheetData/s:row/s:c', ns)
            assert len(cells) == 1 and cells[0].get('r') == 'B2' and cells[0].get('t') == 's'
            assert not sheet.findall('.//s:f', ns)
            index = int(cells[0].find('s:v', ns).text)
            strings = xml['xl/sharedStrings.xml'].findall('s:si', ns)
            assert ''.join(n.text or '' for n in strings[index].findall('.//s:t', ns)) == marker
            result['target'] = 'B2'
            result['formulaCount'] = 0
        else:
            slide = xml['ppt/slides/slide1.xml']
            shapes = slide.findall('.//p:spTree/p:sp', ns)
            matching = [shape for shape in shapes if ''.join(n.text or '' for n in shape.findall('.//a:t', ns)) == marker]
            assert len(matching) == 1
            assert sum(bool(shape.findall('.//a:t', ns)) for shape in shapes) == 1
            shape = matching[0]
            transform = shape.find('p:spPr/a:xfrm', ns)
            off = transform.find('a:off', ns); ext = transform.find('a:ext', ns)
            size = xml['ppt/presentation.xml'].find('p:sldSz', ns)
            x, y = int(off.get('x')), int(off.get('y'))
            width, height = int(ext.get('cx')), int(ext.get('cy'))
            sw, sh = int(size.get('cx')), int(size.get('cy'))
            assert width > 0 and height > 0 and x >= 0 and y >= 0 and x + width <= sw and y + height <= sh
            result['boxEMU'] = [x, y, width, height]
            result['slideEMU'] = [sw, sh]
            body = shape.find('p:txBody/a:bodyPr', ns)
            result['bodyProperties'] = body.attrib
            result['autoFit'] = [node.tag.split('}')[-1] for node in body]
            result['directFontSizes'] = [n.get('sz') for n in shape.findall('.//a:rPr', ns) if n.get('sz')]
            result['fontSizeInherited'] = not bool(result['directFontSizes'])
        result['literalExact'] = True
        result['zipCRCPassed'] = True
    report['results'].append(result)
report['passed'] = True
(root / '2026-10-04-unicode-im-ooxml.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print('Three saved sample packages: CRC/XML/literal checks pass; PPT saved box within slide; no rendering claim')
