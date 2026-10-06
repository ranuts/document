from pathlib import Path
import subprocess, hashlib, os

# Throwaway numeric representation experiment. Never edits source files.
plugins = list(Path('dist/assets').glob('agent-plugin-*.js'))
engines = [p for p in Path('dist/assets').glob('esm-*.js') if 'createChatCompletion(e){' in p.read_text()]
assert len(plugins) == len(engines) == 1
originals = {p: p.read_bytes() for p in plugins + engines}
try:
    plugin = plugins[0]
    body = originals[plugin].decode()
    marker = 'if(n.throwIfAborted(),a.toolCalls.length'
    assert body.count(marker) == 1
    diagnostic = '''
const __maskedRaw=a.text;
(window.__writingRaw??=[]).push({maskedText:__maskedRaw,text:a.text,stopReason:a.stopReason,usage:a.usage,slots:window.__numericSlots});
if(window.__numericSlots?.length){
 const __parsed=JSON.parse(a.text);
 if(typeof __parsed.text!=='string')throw Error('Experiment invalid text');
 for(const __slot of window.__numericSlots){
  if(__parsed.text.split(__slot.marker).length!==2)throw Error('Experiment missing or duplicate numeric placeholder');
  __parsed.text=__parsed.text.replace(__slot.marker,__slot.literal);
 }
 if(/\\[\\[(?:DATE|NUMBER)_[A-Z]+\\]\\]/.test(__parsed.text))throw Error('Experiment unknown numeric placeholder');
 a.text=JSON.stringify(__parsed);
 window.__writingRaw[window.__writingRaw.length-1].text=a.text;
}
'''
    plugin.write_text(body.replace(marker, diagnostic + marker))
    engine = engines[0]
    body = originals[engine].decode()
    marker = 'createChatCompletion(e){'
    assert body.count(marker) == 1
    transformation = '''
window.__cpuRuntime={threads:this.getNumThreads(),multithread:this.isMultithread(),isolated:crossOriginIsolated,hardwareConcurrency:navigator.hardwareConcurrency};
window.__numericSlots=[];
for(const __message of e.messages||[]){
 if(__message.role!=='user'||typeof __message.content!=='string')continue;
 const __split=__message.content.lastIndexOf('\\n');
 let __request;try{__request=JSON.parse(__message.content.slice(__split+1));}catch{continue;}
 if(typeof __request.text!=='string'||!['rewrite','summarize','translate'].includes(__request.task))continue;
 __request.text=__request.text.replace(/\\d{4}-\\d{2}-\\d{2}|\\d+(?:[.,]\\d+)*/g,__literal=>{
  const __marker='[['+(__literal.includes('-')?'DATE':'NUMBER')+'_'+String.fromCharCode(65+window.__numericSlots.length)+']]';
  window.__numericSlots.push({marker:__marker,literal:__literal});return __marker;
 });
 __message.content=__message.content.slice(0,__split+1)+'Keep every [[DATE_*]] and [[NUMBER_*]] placeholder exactly once and unchanged.\\n'+JSON.stringify(__request);
}
'''
    engine.write_text(body.replace(marker, marker + transformation))
    env = dict(os.environ, CPU_WRITING_PORT='5193', CPU_WRITING_PROFILE='.scratch/ai-offline/profile', CPU_WRITING_REPORT='docs/evaluations/2026-10-03-cpu-writing-slots.json', CPU_WRITING_EXPERIMENT='numeric-placeholder representation; input transformed and output restored before unchanged production validators')
    subprocess.run(['node', 'docs/evaluations/probe-cpu-four-thread-writing.mjs'], env=env, check=True)
finally:
    for path, original in originals.items():
        path.write_bytes(original)
        assert path.read_bytes() == original
        print('restored', path, hashlib.sha256(original).hexdigest(), flush=True)
