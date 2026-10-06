"""Standalone CPU reference, not an application/provider or replacement for browser inference."""
import hashlib,json,pathlib,socket,subprocess,time,urllib.request
root=pathlib.Path(__file__).parent
model=pathlib.Path('.scratch/node_modules/ai-models/qwen2.5-3b-instruct-q4_k_m.gguf')
expected_sha='626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d'
def sha(path):
 digest=hashlib.sha256()
 with pathlib.Path(path).open('rb') as source:
  while chunk:=source.read(4*1024*1024):digest.update(chunk)
 return digest.hexdigest()
assert model.stat().st_size==2104932768 and sha(model)==expected_sha
baseline=json.loads((root/'2026-10-04-qwen25-3b-date-tokens.json').read_text())
cases=baseline['cases']
with socket.socket() as sock:
 sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
origin=f'http://127.0.0.1:{port}'
binary=pathlib.Path('/opt/homebrew/bin/llama-server').resolve()
args=[str(binary),'--model',str(model),'--host','127.0.0.1','--port',str(port),'--ctx-size','4096','--parallel','1','--threads','4','--n-gpu-layers','0','--device','none','--no-op-offload','--no-cache-prompt','--no-webui']
report={'scope':'Independent native llama.cpp CPU reference for four known date-copy fixtures; same minimal message contents and logical schema, distinct GGUF quantization/template/runtime/sampling implementation. Not browser IM, not production architecture or quality certification.','probeSHA256':sha(__file__),'model':{'repository':'Qwen/Qwen2.5-3B-Instruct-GGUF','revision':'7dabda4d13d513e3e842b20f0d435c732f172cbe','file':model.name,'bytes':model.stat().st_size,'sha256':expected_sha},'runtime':{'binary':str(binary),'sha256':sha(binary),'version':subprocess.check_output([str(binary),'--version'],stderr=subprocess.STDOUT,text=True).strip(),'args':args},'cases':cases,'results':[],'errors':[]}
log_path=pathlib.Path('.scratch/qwen25-3b-llamacpp-reference.log')
process=None
try:
 with log_path.open('w') as log:
  process=subprocess.Popen(args,stdout=log,stderr=subprocess.STDOUT)
  deadline=time.monotonic()+180
  while True:
   if process.poll() is not None:raise RuntimeError(f'Server exited {process.returncode}: '+log_path.read_text()[-2500:])
   try:
    with urllib.request.urlopen(origin+'/health',timeout=2) as response:
     if json.load(response).get('status')=='ok':break
   except Exception:
    if time.monotonic()>deadline:raise RuntimeError('Server readiness timed out')
    time.sleep(0.5)
  with urllib.request.urlopen(origin+'/props',timeout=10) as response:report['runtime']['props']=json.load(response)
  for case in cases:
   previous=next(x for x in baseline['results'] if x['id']==case['id'] and x['variant']=='baseline')
   original=previous['inputs'][0]['request']
   schema=json.loads(original['response_format']['schema'])
   for penalty in (1.05,1.0):
    request={'model':model.name,'messages':original['messages'],'temperature':0,'top_p':0.8,'max_tokens':512,'repeat_penalty':penalty,'repeat_last_n':4096,'seed':42,'response_format':{'type':'json_schema','schema':schema},'cache_prompt':False,'stream':False}
    began=time.monotonic()
    payload=urllib.request.Request(origin+'/v1/chat/completions',data=json.dumps(request).encode(),headers={'Content-Type':'application/json'},method='POST')
    try:
     with urllib.request.urlopen(payload,timeout=180) as response:completion=json.load(response)
    except urllib.error.HTTPError as error:
     report['failedRequest']=request
     raise RuntimeError(str(error)+': '+error.read().decode()) from error
    text=completion['choices'][0]['message']['content']
    row={'id':case['id'],'penalty':penalty,'request':request,'completion':completion,'expected':case['expected'],'source':case['source'],'responseSeconds':time.monotonic()-began,'exact':json.loads(text).get('text')==case['expected']}
    report['results'].append(row)
    print(json.dumps({'id':case['id'],'penalty':penalty,'raw':text,'exact':row['exact']},ensure_ascii=False),flush=True)
  report['status']='completed'
except Exception as error:
 report['status']='failed';report['errors'].append(str(error));raise
finally:
 if process is not None:
  process.terminate()
  try:process.wait(timeout=15)
  except subprocess.TimeoutExpired:process.kill();process.wait(timeout=15)
  report['runtime']['exitCode']=process.returncode
 if log_path.exists():report['runtime']['log']=log_path.read_text()
 (root/'2026-10-04-qwen25-3b-llamacpp-reference.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
