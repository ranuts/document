from pathlib import Path
import subprocess,hashlib
plugins=list(Path('dist/assets').glob('agent-plugin-*.js'))
assert len(plugins)==1
engines=[p for p in Path('dist/assets').glob('esm-*.js') if 'createChatCompletion(e){' in p.read_text()]
assert len(engines)==1
originals={p:p.read_bytes() for p in plugins+engines}
try:
    p=plugins[0];s=originals[p].decode();marker='if(n.throwIfAborted(),a.toolCalls.length';assert s.count(marker)==1
    p.write_text(s.replace(marker,'(window.__writingRaw??=[]).push({text:a.text,stopReason:a.stopReason,usage:a.usage});'+marker))
    p=engines[0];s=originals[p].decode();marker='createChatCompletion(e){';assert s.count(marker)==1
    p.write_text(s.replace(marker,marker+'window.__cpuRuntime={threads:this.getNumThreads(),multithread:this.isMultithread(),isolated:crossOriginIsolated,hardwareConcurrency:navigator.hardwareConcurrency};'))
    subprocess.run(['node','docs/evaluations/probe-cpu-four-thread-writing.mjs'],check=True)
finally:
    for p,data in originals.items():
        p.write_bytes(data)
        assert p.read_bytes()==data
        print('restored',p,hashlib.sha256(data).hexdigest(),flush=True)
