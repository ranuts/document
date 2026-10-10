import hashlib
import json
from pathlib import Path

p = Path(__file__).parent
r = json.loads((p / '2026-10-04-cpu-native-count-app-request.json').read_text())
assert r['status'] == 'completed' and r['phase'] == 'verified' and not r['errors']
assert r['probeSHA256'] == hashlib.sha256((p / 'probe-cpu-native-count-app-request.mjs').read_bytes()).hexdigest()
source = Path(r['archivePath'])
assert r['archiveSHA256'] == hashlib.sha256(source.read_bytes()).hexdigest()
q = json.loads(source.read_text())['results'][0]['requests'][0]['request']
x = r['result']['results'][1]
assert x['id'] == 'actual-app-sdk-request'
assert x['options'] == {**q, 'stream': False}
assert x['first'] == x['second'] and x['first']['prompt_tokens'] == 162
assert x['reply']['usage']['prompt_tokens'] == 162 and x['countActions'] == ['count_chat', 'count_chat']
print('Captured complete app SDK request preserved except blocking stream mode; native count matches actual prompt usage 162')
