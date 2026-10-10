"""Mixed-content abstention calibration, not a semantic acceptance gate."""
import hashlib
import json
import subprocess
from pathlib import Path
root=Path(__file__).parent
prior_path=root/'2026-10-04-fasttext-language-native.json'
prior=json.loads(prior_path.read_text())
quote='资料记载英文口号“Safety inspection before shipment”。其余内容说明接待流程、会场安排、会议时间与座位顺序。会议负责人要求引用原文以便保持与现有宣传材料一致。相关背景无需写入摘要。'
fresh=[
 dict(id='quote-exact',source=quote,output='Safety inspection before shipment',languageMismatch=False,semanticDefect=None,reason='Retain quoted foreign-language content verbatim'),
 dict(id='quote-paraphrase',source=quote,output='Inspect for safety before shipping.',languageMismatch=False,semanticDefect=None,reason='Faithful English paraphrase of intentional English content, not conversion of Chinese narrative'),
 dict(id='quote-reversed-fact',source=quote,output='Ship before the safety inspection.',languageMismatch=False,semanticDefect=True,reason='English already intentional but order reversed; language conformity is not fact verification'),
 dict(id='copied-unsupported-action',source='会议讨论了两个方案：“立即批准发货”和“等待安全检查”。会议最终选择等待，未批准发货。后续流程需根据安全检查结果确定，不能自行提前实施。',output='立即批准发货',languageMismatch=False,semanticDefect=True,reason='Exact source substring changes discussed possibility into command; copied span is not semantic approval'),
 dict(id='names-reordered',source='参会人包括 Alexandria Montgomery、Christopher Richardson。其他信息介绍会议室位置、签到方式与资料分发流程。人员姓名应保持登记拼写；其余背景与名单无关。',output='Christopher Richardson, Alexandria Montgomery',languageMismatch=False,semanticDefect=None,reason='Reordered names-only output retains intentional mixed source'),
 dict(id='latin-prose-change',source='Esta entrega depende de una inspección de seguridad y todavía no ha sido autorizada.',output='This shipment requires a safety inspection and has not been authorized.',languageMismatch=True,semanticDefect=None,reason='Unrequested Spanish to English prose conversion'),
 dict(id='short-english-change',source='这批货物必须等待安全检查通过，当前发货仍未获准，也没有开始运送。',output='Not authorized yet.',languageMismatch=True,semanticDefect=None,reason='Short English drift may have lower classifier certainty'),
 dict(id='mixed-paraphrase',source='安装要求写明：“Keep the valve closed”。其他内容讨论仓库位置、签到流程和设备编号，应从摘要中省略无关背景。',output='The valve must remain shut.',languageMismatch=False,semanticDefect=None,reason='Faithful English rewording of original English installation instruction'),
]
texts=[x for p in fresh for x in (p['source'],p['output'])]
run=subprocess.run(['/private/tmp/document-language-fasttext/fasttext','predict-prob','/private/tmp/document-language-lid176.ftz','-','3'],input='\n'.join(texts)+'\n',text=True,capture_output=True,check=True)
lines=run.stdout.splitlines();assert len(lines)==16
for i,p in enumerate(fresh):
 for offset,key in [(0,'sourcePredictions'),(1,'outputPredictions')]:
  tokens=lines[2*i+offset].split();p[key]=[dict(language=tokens[j].removeprefix('__label__'),score=float(tokens[j+1])) for j in range(0,len(tokens),2)]
pairs=[dict(p,languageMismatch=p['reject'],semanticDefect=None) for p in prior['pairs']]+fresh
for p in pairs:
 source=p['sourcePredictions'][0];output=p['outputPredictions'][0]
 strong=min(source['score'],output['score'])>=.8
 p['wholeTextVerdict']='reject' if strong and source['language']!=output['language'] else 'abstain' if not strong else 'same-label'
 retained=p['output'].strip() in p['source']
 p['candidateVerdict']='abstain-retained-span' if retained else p['wholeTextVerdict']
 # No branch means semantically accepted; all results remain only language observations.
report=dict(scope='Actual fastText native fresh mixed-content controls plus previously bound classifier predictions; whole-text .8 vs exact-retained-substring abstention. No semantic acceptance, optimization on heldout set, product guard or document edits.',adopted=False,priorReportSHA256=hashlib.sha256(prior_path.read_bytes()).hexdigest(),driverSHA256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),modelBytes=prior['modelBytes'],modelSHA256=prior['modelSHA256'],sourceRevision=prior['sourceRevision'],pairs=pairs,controls=[],freshRawStdout=run.stdout,knownMixedControls=[p['id'] for p in fresh],falseRejections=[p['id'] for p in pairs if p['candidateVerdict']=='reject' and not p['languageMismatch']],missedMismatches=[p['id'] for p in pairs if p['candidateVerdict']!='reject' and p['languageMismatch']])
(root/'2026-10-04-fasttext-language-mixed.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print('false rejections',report['falseRejections']);print('missed mismatches',report['missedMismatches'])
for p in fresh:print(p['id'],p['sourcePredictions'][0],p['outputPredictions'][0],p['candidateVerdict'])
