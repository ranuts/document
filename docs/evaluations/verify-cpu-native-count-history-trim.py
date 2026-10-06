import hashlib
import json
from pathlib import Path

p = Path(__file__).parent
r = json.loads((p / '2026-10-04-cpu-native-count-history-trim.json').read_text())
assert r['status'] == 'completed' and r['phase'] == 'verified' and not r['errors']
assert r['probeSHA256'] == hashlib.sha256((p / 'probe-cpu-native-count-history-trim.mjs').read_bytes()).hexdigest()
source = Path(r['archivePath'])
assert r['archiveSHA256'] == hashlib.sha256(source.read_bytes()).hexdigest()
original = json.loads(source.read_text())['results'][0]['requests'][0]['request']
z = r['result']
t = r['partial']['trim']
assert t['archiveBefore'] == t['archiveAfter'] and z['removed'] == 1
assert len(t['attempts']) == 2
first, last = t['attempts']
assert first['measured']['prompt_tokens'] + first['options']['max_tokens'] + 1 > first['measured']['context_tokens']
assert last['measured']['prompt_tokens'] + last['options']['max_tokens'] + 1 <= last['measured']['context_tokens']
messages = z['finalOptions']['messages']
assert messages[0] == original['messages'][0] and messages[-1] == original['messages'][-1]
assert messages[2]['tool_calls'][0]['id'] == messages[3]['tool_call_id'] == 'old_call'
assert messages[1:-1] == json.loads(t['archiveBefore'])[1]
assert z['reply']['usage']['prompt_tokens'] == z['measured']['prompt_tokens']
assert z['tooLong']['prompt_tokens'] + z['tooLongOptions']['max_tokens'] + 1 > z['tooLong']['context_tokens']
print('Native-count trim preserves full current request, system, complete old tool turn and archive; final generation usage matches')
