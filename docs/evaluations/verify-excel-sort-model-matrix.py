import json,hashlib,pathlib,zipfile,xml.etree.ElementTree as ET
entries=[]
ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
for tag in ['1_7','0_8','2b','4b','cpu']:
 for language in ['zh','en']:
  p=pathlib.Path(f'docs/evaluations/2026-10-03-excel-sort-{tag}-{language}-plan-fixed-save.json')
  d=json.loads(p.read_text());assert d['status']=='completed' and d['allPassed'],p
  assert not d['errors'] and len(d['results'])==2,p
  for descending,row in zip([False,True],d['results']):
   expected=[['Alex','30'],['Chen','20'],['Bo','10']] if descending else [['Bo','10'],['Chen','20'],['Alex','30']]
   assert [r[:2] for r in row['after'][1:4]]==expected,p
   assert row['before'][0]==row['after'][0],p
   assert all(r<4 and c<2 or value==row['before'][r][c] for r,line in enumerate(row['after']) for c,value in enumerate(line)),p
   assert row['afterUndo']==row['before'] and row['afterRedo']==row['after'],p
   assert row['previewCount']==0 and not row['visibleErrors'],p
  assert d['beforeSave']==d['results'][1]['after']==d['reopened'],p
  artifact=pathlib.Path(d['nativeSave']['artifact']);digest=hashlib.sha256(artifact.read_bytes()).hexdigest();assert digest==d['nativeSave']['sha256'],p
  with zipfile.ZipFile(artifact) as z:
   shared=[]
   if 'xl/sharedStrings.xml' in z.namelist():
    shared=[''.join(t.text or '' for t in v.findall('.//s:t',ns)) for v in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',ns)]
   cells={}
   for cell in ET.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//s:c',ns):
    value=cell.find('s:v',ns);text=value.text if value is not None else ''
    if cell.get('t')=='s':text=shared[int(text)]
    elif cell.get('t')=='inlineStr':text=''.join(t.text or '' for t in cell.findall('.//s:t',ns))
    cells[cell.get('r')]=text
   expected={'A1':'Name','B1':'Amount','A2':'Alex','B2':'30','A3':'Chen','B3':'20','A4':'Bo','B4':'10','D2':'Outside range','A5':'Below range'}
   assert all(cells.get(k)==v for k,v in expected.items()),p
  entries.append({'model':d['model'],'language':language,'directions':2,'report':str(p),'reportSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'artifactSHA256':digest,'passed':True})
output={'scope':'Five text models, Chinese and English exact complete numeric sorting commands, ascending/descending 20 operations; native A1:D5 values, header and outside cells, native Undo/Redo, Save/reopen and XLSX XML sampled values. No general natural-language intent, formula/style fidelity, filters/tables, offline or mobile claim.','entries':entries,'allPassed':len(entries)==10}
pathlib.Path('docs/evaluations/2026-10-03-excel-sort-model-matrix.json').write_text(json.dumps(output,indent=2,ensure_ascii=False)+'\n')
print('Verified',len(entries),'reports, 20 sort operations')
