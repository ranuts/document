import json
from pathlib import Path
r=json.loads((Path(__file__).parent/'2026-10-04-cpu-count-im-read-range-literal.json').read_text())
assert r['status']=='completed' and r['bundleUnchanged'] and not r['errors']
assert r['formulaBefore']==r['formulaAfter']=='10+20'
x=r['cases'][0]
assert x['after']==r['before'] and not x['errors'] and x['previews']==0
assert r['literalDOM']['interpretedElements']==0
assert len(r['literalDOM']['texts'])==1
text=r['literalDOM']['texts'][0]
assert '**Cora** [Davi](https://example.invalid) `Mira` <b>raw</b>' in text
for row,cells in enumerate(r['before'],1):
    for col,value in enumerate(cells[:2]):
        assert f'{chr(65+col)}{row}: {json.dumps(value,ensure_ascii=False)}' in text
print('Actual range-result DOM preserves literal Markdown/HTML-like content without interpreting elements')
