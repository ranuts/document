"""Throwaway script guard calibration; never a complete language detector."""
import hashlib
import json
import unicodedata
from pathlib import Path

root = Path(__file__).parent
fixtures = [
    dict(id='zh-to-danish', source='Mira提议运送阀门，但仅限安全检查通过后。检查尚未完成，发货尚未获得授权。', output='Mira forespiller at sende ventiler, men kun efter sikkerhedskontrolle.', reject=True, reason='Chinese prose replaced with other-language prose'),
    dict(id='zh-to-english', source='备件到货后方可维修，备件仍未到货，目前维修尚未开始，请保留这些必要条件。', output='Repair will begin once spare parts arrive; work has not started.', reject=True, reason='Chinese prose replaced with English'),
    dict(id='en-to-zh', source='The repair requires spare parts to arrive first, and the work has not started.', output='维修需等待备件到货，目前工作尚未开始。', reject=True, reason='English prose replaced with Chinese'),
    dict(id='zh-faithful', source='备件到货后方可维修，备件仍未到货，目前维修尚未开始，请保留这些必要条件。', output='备件未到，维修未开始，须待备件到货。', reject=False, reason='Chinese retained'),
    dict(id='en-faithful', source='The repair requires spare parts to arrive first, and the work has not started.', output='Repair awaits spare parts; work has not started.', reject=False, reason='English retained'),
    dict(id='zh-names-only', source='参会人员包括 Alexandria Montgomery、Christopher Richardson。会议议题涵盖设备安全检查、维修前提与尚未开始的工作安排。记录还列出了会议室位置、交通方式、签到顺序、座位安排以及会议结束后的资料分发流程，这些信息与人员名单无关。请以登记表中的正式拼写为准。', output='Alexandria Montgomery、Christopher Richardson', reject=False, reason='Instruction: retain only original names; intentional mixed source and names-only summary'),
    dict(id='zh-quoted-english', source='记录包含一句原始口号：“Safety inspection before shipment”。其余内容介绍场地布置、灯光安排、座位编号、接待流程和餐饮管理。这些背景没有改变口号的内容，最终记录应以现场展示的文字为准。相关负责人确认口号的拼写已逐字核对，宣传材料将沿用同一版本。', output='Safety inspection before shipment', reject=False, reason='Instruction: summarize by retaining only the original slogan, omit unrelated Chinese narrative'),
    dict(id='ja-han-summary', source='安全検査は未完了です。出荷はまだ承認されていません。別の会議で倉庫について相談します。', output='安全検査未完了、出荷未承認。', reject=False, reason='Japanese summary may naturally consist of Han characters'),
    dict(id='ko-faithful', source='부품이 도착한 후에만 수리할 수 있습니다. 부품은 아직 도착하지 않았고 작업도 시작되지 않았습니다.', output='부품 미도착으로 수리 작업은 아직 시작되지 않았습니다.', reject=False, reason='Korean retained'),
    dict(id='de-to-en', source='Die Reparatur kann erst beginnen, wenn die Ersatzteile eintreffen. Die Arbeit hat noch nicht begonnen.', output='Repair awaits spare parts; work has not started.', reject=True, reason='German replaced with English: same script'),
    dict(id='es-to-pt', source='La reparación depende de la llegada de las piezas; el trabajo no ha comenzado.', output='A reparação depende das peças; o trabalho ainda não começou.', reject=True, reason='Spanish replaced with Portuguese: same script'),
    dict(id='pt-faithful', source='A reparação depende da chegada das peças e o trabalho ainda não começou.', output='A reparação aguarda peças; o trabalho ainda não começou.', reject=False, reason='Portuguese retained'),
]

def counts(text):
    latin = sum(('LATIN' in unicodedata.name(c, '')) for c in text)
    cjk = sum(0x3400 <= ord(c) <= 0x9fff or 0x3040 <= ord(c) <= 0x30ff or 0xac00 <= ord(c) <= 0xd7af for c in text)
    return latin, cjk

rows = []
for fixture in fixtures:
    sl, sc = counts(fixture['source'])
    ol, oc = counts(fixture['output'])
    # Candidate intentionally follows the current translation guard's two script buckets.
    # Require ample evidence to avoid classifying tiny strings; calibrate, do not adopt.
    rejected = (sc >= 20 and sc / max(1, sl + sc) >= .8 and ol >= 20 and oc == 0) or (sl >= 20 and sl / max(1, sl + sc) >= .8 and oc >= 10 and ol == 0)
    rows.append({**fixture, 'sourceCounts': [sl, sc], 'outputCounts': [ol, oc], 'candidateRejected': rejected, 'correct': rejected == fixture['reject']})
report = {'scope': 'Predeclared synthetic positive/negative script controls, no actual model inference. Broad Latin vs CJK buckets, .8 source dominance, minimum lengths, complete dominant-script disappearance. Not a language detector, accuracy ranking or production gate.', 'adopted': False, 'driverSHA256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'rows': rows, 'falseRejections': [r['id'] for r in rows if r['candidateRejected'] and not r['reject']], 'missedMismatches': [r['id'] for r in rows if not r['candidateRejected'] and r['reject']]}
report['thresholdSweep'] = []
for threshold in (.5, .6, .7, .8, .9):
    false_rejections, missed = [], []
    for row in rows:
        sl, sc = row['sourceCounts']; ol, oc = row['outputCounts']
        rejected = (sc >= 20 and sc / max(1, sl + sc) >= threshold and ol >= 20 and oc == 0) or (sl >= 20 and sl / max(1, sl + sc) >= threshold and oc >= 10 and ol == 0)
        if rejected and not row['reject']: false_rejections.append(row['id'])
        if not rejected and row['reject']: missed.append(row['id'])
    report['thresholdSweep'].append({'dominanceThreshold': threshold, 'falseRejections': false_rejections, 'missedMismatches': missed})
assert report['missedMismatches'] == ['de-to-en', 'es-to-pt']
assert not report['falseRejections']
assert report['thresholdSweep'][0]['falseRejections'] == ['zh-names-only', 'zh-quoted-english']
(root / '2026-10-04-writing-script-guard-controls.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print('At .8:', report['falseRejections'], report['missedMismatches']); print('Sweep:', report['thresholdSweep'])
