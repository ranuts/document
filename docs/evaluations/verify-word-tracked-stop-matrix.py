import json,hashlib,pathlib
entries=[]
for tag in ['1_7','0_8','2b','4b','cpu-wait-fixed']:
 p=pathlib.Path(f'docs/evaluations/2026-10-03-word-im-tracked-unicode-stop-{tag}.json')
 d=json.loads(p.read_text()); before=d['results'][0]['before']
 assert d['status']=='completed' and d['allPassed'] is True,p
 assert d['afterStop']['paragraphs']==before['paragraphs']==d['afterLate']['paragraphs'],p
 assert all(c['reviewType']==1 for c in d['beforeStop']['paragraphs'][0]['characters'][:6]),p
 assert all(c['reviewType']==0 for c in before['paragraphs'][0]['characters'][:6]),p
 assert d['preparation']=={'prepared':1,'resumed':1},p
 assert d['exactHistoryRestored'] and d['priorUndoExact'] and d['priorRedoWorks'] and d['reviewModeRetained'],p
 assert not d['nativeState']['busy'] and not d['nativeState']['paste'] and not d['nativeState']['temporaryHtml'],p
 nxt=d['nextIM'];assert nxt['nextUndo']['paragraphs']==nxt['nextBefore']['paragraphs'],p
 assert nxt['nextRedo']['paragraphs']==nxt['nextAfter']['paragraphs'],p
 base=nxt['nextBefore']['paragraphs'][0]['characters']
 expected=[{'c':v['c'],'reviewType':1} for v in base[:6]]+[{'c':c,'reviewType':2} for c in d['replacement']]+[{'c':v['c'],'reviewType':v['reviewType']} for v in base[6:]]
 assert [{'c':v['c'],'reviewType':v['reviewType']} for v in nxt['nextAfter']['paragraphs'][0]['characters']]==expected,p
 assert nxt['nextAfter']['paragraphs'][1]==nxt['nextBefore']['paragraphs'][1],p
 assert nxt['noNewErrors'] and not d['errors'],p
 entries.append({'model':d['model'],'engine':d['engine'],'report':str(p),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'passed':True})
output={'scope':'Actual IM tracked Unicode/tab replacement in native pre_Paste preparation, controlled held callback, Stop before insertion, late callback, strict native history identity check and prior Redo, subsequent IM write and native Undo/Redo; five configured text models. No foreign edit, physical OOM, tracked Save-after-Stop or other cancellation phase claim.','entries':entries,'allPassed':len(entries)==5}
pathlib.Path('docs/evaluations/2026-10-03-word-tracked-stop-model-matrix.json').write_text(json.dumps(output,indent=2,ensure_ascii=False)+'\n')
print('Independently verified',len(entries),'tracked Stop cases')
