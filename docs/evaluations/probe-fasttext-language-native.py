"""Native CLI calibration, not browser adoption or semantic validation."""
import hashlib
import json
import re
import subprocess
import time
from pathlib import Path

root=Path(__file__).parent
binary=Path('/private/tmp/document-language-fasttext/fasttext')
model=Path('/private/tmp/document-language-lid176.ftz')
script=json.loads((root/'2026-10-04-writing-script-guard-controls.json').read_text())
pairs=[{k:r[k] for k in ('id','source','output','reject','reason')} for r in script['rows']]
actual=json.loads((root/'2026-10-04-qwen-thinking-summary.json').read_text())
for r in actual['results']:
    content=re.sub(r'^\s*<think>[\s\S]*?</think>\s*','',r['raw'][0]['text'])
    output=json.loads(content)['text']
    pairs.append(dict(id='actual-'+r['id']+'-'+r['variant'],source=r['source'],output=output,reject=r['id']=='shipment-condition-zh' and r['variant']=='thinking',reason='Previously observed actual writing response; labels concern language only, not fact accuracy'))
short=[('zh','安全检查未通过。'),('ja','検査は未完了です。'),('ko','검사가 끝나지 않았습니다.'),('de','Noch nicht genehmigt.'),('es','No está autorizado.'),('pt','Ainda não autorizado.'),('en','Not yet authorized.')]
controls=[dict(id='short-'+language,text=text,expectedLanguage=language) for language,text in short]
controls += [dict(id='names',text='Alexandria Montgomery, Christopher Richardson',expectedLanguage=None),dict(id='code',text='const documentId = "DOCX_17"; save(documentId);',expectedLanguage=None),dict(id='numeric',text='2036-02-19 17 480 NOK',expectedLanguage=None),dict(id='url',text='https://example.com/report/2036-02-19',expectedLanguage=None)]
controls += [dict(id='multiline-en',text='The inspection is pending.\nThe shipment is not authorized.',expectedLanguage='en'),dict(id='multiline-zh',text='安全检查尚未完成。\n发货尚未获得授权。',expectedLanguage='zh')]
texts=[t for p in pairs for t in (p['source'],p['output'])]+[c['text'] for c in controls]
start=time.perf_counter()
run=subprocess.run([str(binary),'predict-prob',str(model),'-','3'],input='\n'.join(t.replace('\n',' ') for t in texts)+'\n',capture_output=True,text=True,check=True)
elapsed=(time.perf_counter()-start)*1000
lines=run.stdout.splitlines();assert len(lines)==len(texts)
def parse(line):
    tokens=line.split();return [dict(language=tokens[i].removeprefix('__label__'),score=float(tokens[i+1])) for i in range(0,len(tokens),2)]
predictions=[parse(line) for line in lines]
for i,p in enumerate(pairs):p['sourcePredictions']=predictions[2*i];p['outputPredictions']=predictions[2*i+1]
for i,c in enumerate(controls):c['predictions']=predictions[2*len(pairs)+i]
sweep=[]
for confidence in (.5,.7,.8,.9,.95,.99):
    rejected=[p['id'] for p in pairs if p['sourcePredictions'][0]['language']!=p['outputPredictions'][0]['language'] and min(p['sourcePredictions'][0]['score'],p['outputPredictions'][0]['score'])>=confidence]
    sweep.append(dict(confidence=confidence,rejected=rejected,falseRejections=[p['id'] for p in pairs if p['id'] in rejected and not p['reject']],missedMismatches=[p['id'] for p in pairs if p['id'] not in rejected and p['reject']]))
report=dict(scope='Actual official fastText v0.9.2 native CLI + compressed lid176 classifier on existing script controls, prior actual model final responses, and fresh short/names/code/number/URL controls. No browser, worker, offline, confidence calibration or semantic acceptance.',adopted=False,modelURL='https://dl.fbaipublicfiles.com/fasttext/supervised-models/lid.176.ftz',modelBytes=model.stat().st_size,modelSHA256=hashlib.sha256(model.read_bytes()).hexdigest(),sourceRevision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=binary.parent,text=True).strip(),binarySHA256=hashlib.sha256(binary.read_bytes()).hexdigest(),driverSHA256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),elapsedMsIncludingProcessAndLoad=elapsed,pairs=pairs,controls=controls,thresholdSweep=sweep,rawStdout=run.stdout,stderr=run.stderr)
(root/'2026-10-04-fasttext-language-native.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('Model bytes',report['modelBytes'],'total process ms',round(elapsed,2),'classified',len(texts))
for s in sweep:print(s)
for c in controls:print(c['id'],c['predictions'][0])
