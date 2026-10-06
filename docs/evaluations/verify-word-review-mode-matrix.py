import json,hashlib,pathlib,zipfile,xml.etree.ElementTree as ET
root=pathlib.Path('.')
entries=[]
for tag in ['0_8','1_7','2b','4b','cpu']:
 for mode in ['on','off']:
  p=root/f'docs/evaluations/2026-10-03-word-review-mode-{tag}-{mode}-planner-fixed.json'
  d=json.loads(p.read_text()); wanted=mode=='on'
  assert d['status']=='completed' and d['allPassed'] is True,p
  assert d['requestedMode'] is wanted and d['reviewEnabled'] is wanted,p
  assert d['modeRequest']['previewCount']==0 and not d['modeRequest']['errors'],p
  for state,value in [('toggleEnabled',wanted),('toggleUndo',not wanted),('toggleRedo',wanted)]:
   assert d[state]['global'] is value and d[state]['effective'] is value,p
  row=d['results'][0]
  before=row['before']['paragraphs'][0]['characters']; after=row['after']['paragraphs'][0]['characters']
  expected=([{'c':v['c'],'reviewType':1} for v in before[:6]] if wanted else [])+[{'c':c,'reviewType':2 if wanted else 0} for c in d['replacement']]+[{'c':v['c'],'reviewType':v['reviewType']} for v in before[6:]]
  assert [{'c':v['c'],'reviewType':v['reviewType']} for v in after]==expected,p
  assert row['after']['paragraphs'][1]==row['before']['paragraphs'][1],p
  assert row['afterUndo']['paragraphs']==row['before']['paragraphs'],p
  assert row['afterRedo']['paragraphs']==row['after']['paragraphs'],p
  assert d['beforeSave']['paragraphs']==d['reopened']['paragraphs'],p
  assert d['settingsAfterReopen']['global'] is wanted and d['reviewModeAfterReopen'] is wanted,p
  artifact=root/d['nativeSave']['artifact']; digest=hashlib.sha256(artifact.read_bytes()).hexdigest()
  assert digest==d['nativeSave']['sha256'],p
  with zipfile.ZipFile(artifact) as z:
   settings=ET.fromstring(z.read('word/settings.xml'))
  ns='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
  flag=settings.find(ns+'trackRevisions'); enabled=flag is not None and flag.get(ns+'val','true').lower() not in ['false','0','off']
  assert enabled is wanted,p
  entries.append({'model':d['model'],'engine':d['engine'],'enabled':wanted,'report':str(p),'reportSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'artifactSHA256':digest,'savedXMLTrackingEnabled':enabled,'passed':True})
output={'scope':'Production IM review-mode on/off for all five configured text models, native mode and replacement Undo/Redo, sampled Unicode/tab character revision states, neighbor preservation, native Save/reopen, saved XML tracking flag. Historical row.kind labels say tracked in off reports; requestedMode and native states are authoritative. No full DOCX metadata, physical mobile, tracked Stop or external Word claims.','entries':entries,'allPassed':len(entries)==10 and all(e['passed'] for e in entries)}
output['verifier']={'path':__file__, 'sha256':hashlib.sha256(pathlib.Path(__file__).read_bytes()).hexdigest()}
(root/'docs/evaluations/2026-10-03-word-review-mode-model-matrix.json').write_text(json.dumps(output,indent=2,ensure_ascii=False)+'\n')
print('Independently verified',len(entries),'cases')
